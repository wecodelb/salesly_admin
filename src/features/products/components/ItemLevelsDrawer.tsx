import { useEffect, useState, type KeyboardEvent } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { apiErrorMessage } from '@/core/api/api-error'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { useItemLevels, useSaveItemLevel } from '../hooks/use-products'
import {
  formatQty,
  levelBreach,
  levelLabel,
  levelPill,
  type AdminItem,
  type ItemLevel,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  /** Null while the drawer is sliding shut. */
  item?: AdminItem | null
}

const HEAD_CELL =
  'px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]'
const NUM_CELL = 'whitespace-nowrap px-3 py-3 text-right tabular-nums'
const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/** What one row's two boxes currently hold, as typed. */
interface Draft {
  min: string
  max: string
}

/**
 * A blank box is no level at all, which the API takes as an explicit null and
 * is a different instruction from a level of zero.
 *
 * `ok` is kept apart from the value because a blank box and a typo both parse
 * to null, and only one of them is something somebody meant.
 */
function parseLevel(value: string): { ok: boolean; value: number | null } {
  const trimmed = value.trim()
  if (trimmed === '') return { ok: true, value: null }
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return { ok: false, value: null }
  return { ok: true, value: parsed }
}

/** Stored level → what the box shows. */
function toInput(value: number | null | undefined): string {
  return value == null ? '' : String(value)
}

/**
 * The floor and ceiling for one product, warehouse by warehouse — set in the
 * row they belong to.
 *
 * Every warehouse in the company is already listed here with its stock beside
 * it, so the levels are edited in place rather than through a form above the
 * grid: choosing a warehouse from a dropdown to describe a row that is already
 * on screen is a step which only ever existed to feed the form. The judgement
 * is still never about a single warehouse — setting a depot's floor to ten is a
 * statement about what the rest of the company is holding — and editing in the
 * grid is what keeps all of it in view while that judgement is made.
 *
 * A row commits as a unit, on Enter or on its own tick, never a box at a time.
 * The server refuses a minimum above a maximum, so saving each box as it lost
 * focus would reject the halfway state of every widening edit: raising a 10–20
 * pair to 30–40 fails the moment the 30 lands alone.
 *
 * Both levels are in base units — the unit stock is counted in, not the carton
 * the screen happens to sell by — and either may be left blank, which is what
 * the salesman's "no limit" means: nothing to breach.
 */
export function ItemLevelsDrawer({ open, onClose, item }: Props) {
  const { can } = usePermissions()
  const canManage = can(PERMISSIONS.PREFERENCES_MANAGE)

  const itemId = open && item ? item.id : null
  const { data: rows = [], isLoading, isError, refetch } = useItemLevels(itemId)
  const saveLevel = useSaveItemLevel(item?.id ?? 0)

  // Only touched rows hold a draft; the rest read straight from the server, so
  // a refetch quietly updates them instead of fighting stale local copies.
  const [drafts, setDrafts] = useState<Record<number, Draft>>({})
  const [errors, setErrors] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setDrafts({})
    setErrors({})
    setSavingId(null)
  }, [open, item])

  const draftFor = (row: ItemLevel): Draft => {
    const id = row.warehouse?.id
    return (
      (id != null ? drafts[id] : undefined) ?? {
        min: toInput(row.min_qty),
        max: toInput(row.max_qty),
      }
    )
  }

  /** Typed values differ from what the server holds. */
  const isDirty = (row: ItemLevel): boolean => {
    const id = row.warehouse?.id
    if (id == null) return false
    const draft = drafts[id]
    if (!draft) return false
    return draft.min !== toInput(row.min_qty) || draft.max !== toInput(row.max_qty)
  }

  const edit = (row: ItemLevel, patch: Partial<Draft>) => {
    const id = row.warehouse?.id
    if (id == null) return
    const next = { ...draftFor(row), ...patch }
    setDrafts((d) => ({ ...d, [id]: next }))
    // The message described the value that has just been replaced.
    setErrors((e) => (e[id] ? { ...e, [id]: '' } : e))
  }

  const revert = (row: ItemLevel) => {
    const id = row.warehouse?.id
    if (id == null) return
    setDrafts(({ [id]: _dropped, ...rest }) => rest)
    setErrors(({ [id]: _cleared, ...rest }) => rest)
  }

  const commit = async (row: ItemLevel) => {
    const id = row.warehouse?.id
    if (id == null || !item || !canManage || !isDirty(row)) return

    const draft = draftFor(row)
    const min = parseLevel(draft.min)
    const max = parseLevel(draft.max)

    // The same refusals the backend gives, made before the request rather than
    // after it.
    let message = ''
    if (!min.ok || !max.ok) message = 'Enter a number, or leave it blank for no limit.'
    else if ((min.value ?? 0) < 0 || (max.value ?? 0) < 0) message = 'A level cannot be negative.'
    else if (min.value != null && max.value != null && min.value > max.value)
      message = 'The low level cannot be above the max.'

    if (message) {
      setErrors((e) => ({ ...e, [id]: message }))
      return
    }

    setSavingId(id)
    try {
      await saveLevel.mutateAsync({
        // Both keys always go up: the boxes were seeded from what is stored, so
        // an emptied one is somebody clearing a level and has to arrive as a
        // null rather than as an omission the server reads as "leave it alone".
        warehouse_id: id,
        min_qty: min.value,
        max_qty: max.value,
      })
      // Drop the draft so the row falls back to the refetched server values,
      // which carry the breach flags this screen colours by.
      setDrafts(({ [id]: _saved, ...rest }) => rest)
      setErrors(({ [id]: _cleared, ...rest }) => rest)
    } catch (err) {
      setErrors((e) => ({ ...e, [id]: apiErrorMessage(err) }))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={item ? `Item levels — ${item.name}` : 'Item levels'}
      width="w-[640px]"
      footer={
        <Button variant="ghost" onClick={onClose} disabled={savingId !== null}>
          Close
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <h3 className={HEADING} style={HEADING_GLOW}>
          Every warehouse
        </h3>

        <p className="text-xs text-[var(--text-muted)]">
          {canManage
            ? 'Type a level straight into the row, then press Enter or tick it. Both are in base units and both may be left blank, which means no limit — nothing to be under or over. Zero is a level in its own right: it says this warehouse should not be carrying the line at all.'
            : 'Levels are set by someone with permission to manage preferences. What each warehouse is supposed to hold is below.'}
        </p>

        {isError ? (
          <ErrorState
            title="Couldn't load levels"
            message="The warehouses and their levels for this product couldn't be read."
            onRetry={() => refetch()}
          />
        ) : isLoading ? (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-default)]">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-3 py-3.5 last:border-0"
              >
                <div className="h-4 flex-1 animate-pulse rounded bg-[var(--border-default)]" />
                <div className="h-4 w-12 animate-pulse rounded bg-[var(--border-subtle)]" />
                <div className="h-4 w-10 animate-pulse rounded bg-[var(--border-subtle)]" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-default)] bg-[var(--bg-surface-raised)]">
                  <th scope="col" className={`text-left ${HEAD_CELL}`}>
                    Warehouse
                  </th>
                  <th scope="col" className={`text-right ${HEAD_CELL}`}>
                    On hand
                  </th>
                  <th scope="col" className={`text-right ${HEAD_CELL}`}>
                    Low
                  </th>
                  <th scope="col" className={`text-right ${HEAD_CELL}`}>
                    Max
                  </th>
                  <th scope="col" className={`text-left ${HEAD_CELL}`} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const id = row.warehouse?.id
                  const { belowMin, aboveMax } = levelBreach(row)
                  const pill = levelPill(row)
                  const draft = draftFor(row)
                  const dirty = isDirty(row)
                  const error = id != null ? errors[id] : undefined
                  const saving = id != null && savingId === id
                  const editable = canManage && id != null

                  const boxClass = [
                    'h-9 w-24 rounded-[var(--radius-btn)] border px-2 text-right text-sm tabular-nums transition-colors',
                    'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
                    'focus:bg-[var(--bg-surface)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]',
                    'disabled:opacity-60',
                    error
                      ? 'border-[var(--accent-red)] bg-[var(--accent-red)]/5'
                      : dirty
                        ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5'
                        : 'border-transparent bg-transparent hover:border-[var(--border-default)]',
                  ].join(' ')

                  // Enter is the whole point of typing into the row; Escape puts
                  // back what the server holds without a trip to the mouse.
                  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void commit(row)
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      revert(row)
                    }
                  }

                  return (
                    <tr
                      key={id ?? i}
                      className={[
                        'border-b border-[var(--border-subtle)] last:border-0',
                        dirty ? 'bg-[var(--accent-primary)]/5' : '',
                      ].join(' ')}
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[var(--text-primary)]">
                            {row.warehouse?.name ?? 'Unknown location'}
                          </span>
                          {row.warehouse?.is_depot && <StatusPill status="live" label="Depot" />}
                        </div>
                        {row.warehouse?.is_depot && row.warehouse.salesman?.name && (
                          <div className="text-xs text-[var(--text-secondary)]">
                            {row.warehouse.salesman.name}
                          </div>
                        )}
                        {error && (
                          <div className="mt-1 text-xs text-[var(--accent-red)]">{error}</div>
                        )}
                      </td>
                      {/* The figure the two levels are judged against, so it
                          carries the colour rather than the levels do. */}
                      <td
                        className={[
                          NUM_CELL,
                          'font-medium',
                          belowMin
                            ? 'text-[var(--accent-red)]'
                            : aboveMax
                              ? 'text-[var(--accent-amber)]'
                              : 'text-[var(--text-primary)]',
                        ].join(' ')}
                      >
                        {formatQty(row.qty)}
                      </td>

                      {editable ? (
                        <>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={draft.min}
                              disabled={saving}
                              onChange={(e) => edit(row, { min: e.target.value })}
                              onKeyDown={onKeyDown}
                              placeholder="No limit"
                              aria-label={`Low level for ${row.warehouse?.name ?? 'this warehouse'}`}
                              aria-invalid={error ? true : undefined}
                              className={boxClass}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={draft.max}
                              disabled={saving}
                              onChange={(e) => edit(row, { max: e.target.value })}
                              onKeyDown={onKeyDown}
                              placeholder="No limit"
                              aria-label={`Max level for ${row.warehouse?.name ?? 'this warehouse'}`}
                              aria-invalid={error ? true : undefined}
                              className={boxClass}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td
                            className={[
                              NUM_CELL,
                              row.min_qty == null
                                ? 'text-[var(--text-muted)]'
                                : 'text-[var(--text-secondary)]',
                            ].join(' ')}
                          >
                            {levelLabel(row.min_qty)}
                          </td>
                          <td
                            className={[
                              NUM_CELL,
                              row.max_qty == null
                                ? 'text-[var(--text-muted)]'
                                : 'text-[var(--text-secondary)]',
                            ].join(' ')}
                          >
                            {levelLabel(row.max_qty)}
                          </td>
                        </>
                      )}

                      {/* One cell, three states: what the row is doing, what it
                          is waiting for, or what it reads as when at rest. */}
                      <td className="px-3 py-3">
                        {saving ? (
                          <span className="inline-flex items-center gap-2 text-xs text-[var(--text-muted)]">
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Saving
                          </span>
                        ) : dirty ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void commit(row)}
                              title="Save this row (Enter)"
                              aria-label={`Save levels for ${row.warehouse?.name ?? 'this warehouse'}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-btn)] bg-[var(--accent-primary)] text-white transition-colors hover:bg-[#0b3577]"
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => revert(row)}
                              title="Discard this row's changes (Esc)"
                              aria-label={`Discard changes for ${row.warehouse?.name ?? 'this warehouse'}`}
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-btn)] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-surface-raised)] hover:text-[var(--text-primary)]"
                            >
                              <RotateCcw size={15} />
                            </button>
                          </span>
                        ) : (
                          pill && <StatusPill status={pill.status} label={pill.label} />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SideDrawer>
  )
}
