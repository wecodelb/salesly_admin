import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { Select } from '@/shared/components/Select'
import { Button } from '@/shared/components/Button'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { useAreas } from '@/features/areas/hooks/use-areas'
import { useCreateWarehouse, useUpdateWarehouse, useWarehouses } from '../hooks/use-warehouses'
import {
  VOLUME_UNIT,
  WEIGHT_UNIT,
  hasSystemOwnedIdentity,
  type UpdateWarehousePayload,
  type Warehouse,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  warehouse?: Warehouse | null // null/undefined = create mode
}

interface FormState {
  code: string
  name: string
  location: string
  areaId: string
  isMain: boolean
  /** Kept as typed strings so a half-erased figure doesn't snap back to 0 under
   *  the cursor, and so an empty box stays empty rather than becoming a zero
   *  ceiling. */
  maxWeight: string
  maxVolume: string
}

const EMPTY: FormState = {
  code: '',
  name: '',
  location: '',
  areaId: '',
  isMain: false,
  maxWeight: '',
  maxVolume: '',
}

const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/** A blank box is no ceiling at all, which is a different instruction from a
 *  ceiling of zero — so it goes up as an explicit null. */
function capacityOrNull(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

function capacityError(value: string): string | undefined {
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return 'Enter a number, or leave it blank for no ceiling'
  if (parsed < 0) return 'A ceiling cannot be negative'
  return undefined
}

/**
 * Opening a warehouse, and editing one.
 *
 * A depot is only half editable here, and the split is not arbitrary: its code
 * and name were written when the salesman's account was created and are how
 * every other screen recognises his stock, while what his vehicle can carry and
 * where it parks are facts about the world that change and somebody has to be
 * able to record. The backend enforces exactly that split; this form shows it
 * rather than letting a field be typed into and refused on save.
 */
export function WarehouseFormDrawer({ open, onClose, warehouse }: Props) {
  const isEdit = !!warehouse
  const systemOwned = !!warehouse && hasSystemOwnedIdentity(warehouse)
  const { run } = useActionProgress()
  const { data: warehouses = [] } = useWarehouses()
  const { data: areas = [] } = useAreas()
  const createWarehouse = useCreateWarehouse()
  const updateWarehouse = useUpdateWarehouse()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Which row holds the flag today, so that ticking the box can say out loud
  // what it is about to take it off.
  const currentMain = useMemo(
    () => warehouses.find((w) => w.is_main && w.id !== warehouse?.id) ?? null,
    [warehouses, warehouse],
  )

  useEffect(() => {
    if (!open) return
    setForm(
      warehouse
        ? {
            code: warehouse.code,
            name: warehouse.name,
            location: warehouse.location ?? '',
            areaId: warehouse.area_id != null ? String(warehouse.area_id) : '',
            isMain: warehouse.is_main,
            maxWeight: warehouse.max_weight != null ? String(warehouse.max_weight) : '',
            maxVolume: warehouse.max_volume != null ? String(warehouse.max_volume) : '',
          }
        : EMPTY,
    )
    setErrors({})
  }, [open, warehouse])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'

    const weight = capacityError(form.maxWeight)
    if (weight) e.maxWeight = weight
    const volume = capacityError(form.maxVolume)
    if (volume) e.maxVolume = volume

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const code = form.code.trim()
    const name = form.name.trim()
    const location = form.location.trim()
    const areaId = form.areaId === '' ? null : Number(form.areaId)
    const maxWeight = capacityOrNull(form.maxWeight)
    const maxVolume = capacityOrNull(form.maxVolume)

    // Only what actually moved goes up. On a depot that is what keeps the code
    // and name out of the payload entirely — resending them unchanged would
    // pass, but the request has no business carrying fields this screen does
    // not let anybody edit.
    const payload: UpdateWarehousePayload = {}
    if (isEdit && warehouse) {
      if (!systemOwned && code !== warehouse.code) payload.code = code
      if (!systemOwned && name !== warehouse.name) payload.name = name
      if (location !== (warehouse.location ?? '')) payload.location = location
      if (areaId !== (warehouse.area_id ?? null)) payload.area_id = areaId
      if (form.isMain !== warehouse.is_main) payload.is_main = form.isMain
      if (maxWeight !== warehouse.max_weight) payload.max_weight = maxWeight
      if (maxVolume !== warehouse.max_volume) payload.max_volume = maxVolume

      if (Object.keys(payload).length === 0) {
        onClose()
        return
      }
    }

    const saved = await run(
      {
        label: isEdit ? 'Saving warehouse' : 'Creating warehouse',
        detail: name,
        success: `${name} has been saved.`,
      },
      () =>
        isEdit && warehouse
          ? updateWarehouse.mutateAsync({ id: warehouse.id, payload })
          : createWarehouse.mutateAsync({
              code,
              name,
              location,
              area_id: areaId,
              is_main: form.isMain,
              max_weight: maxWeight,
              max_volume: maxVolume,
            }),
    )

    if (saved !== null) onClose()
  }

  const saving = createWarehouse.isPending || updateWarehouse.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? (systemOwned ? 'Edit depot' : 'Edit warehouse') : 'New warehouse'}
      width="w-[480px]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create warehouse'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-4">
          <h3 className={HEADING} style={HEADING_GLOW}>
            Identity
          </h3>

          {systemOwned && (
            <div className="flex items-start gap-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] px-3.5 py-2.5">
              <Lock size={14} aria-hidden className="mt-0.5 flex-shrink-0 text-[var(--text-muted)]" />
              <p className="text-sm text-[var(--text-secondary)]">
                This depot belongs to{' '}
                <span className="font-medium text-[var(--text-primary)]">
                  {warehouse?.salesman?.name ?? 'a salesman'}
                </span>{' '}
                and is named after him — it was created with his account, so its code and name are
                fixed. What it can carry and where it parks are still yours to set.
              </p>
            </div>
          )}

          {/* Two to a row: these are short fields that read as a pair — what it
              is called and what it is called by, then where it sits and how to
              find it once you are there. One per line made a five-field form
              scroll. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Code"
              value={form.code}
              onChange={(e) => set('code', e.target.value)}
              error={errors.code}
              placeholder="MAIN"
              disabled={systemOwned}
            />
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              error={errors.name}
              placeholder="Main Warehouse"
              disabled={systemOwned}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Chosen, not typed: free text turned one place into "Beirut",
                "beirut" and "BEY" depending on who filled the form, and nothing
                could be grouped or filtered by it afterwards. */}
            <SearchableSelect
              label="Location zone"
              value={form.areaId}
              onChange={(v) => set('areaId', v)}
              options={areas.map((a) => ({ value: String(a.id), label: `${a.name} (${a.code})` }))}
              placeholder="No zone"
              searchPlaceholder="Search zones…"
            />
            <Input
              label="Address (optional)"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              placeholder="Street, building, floor"
            />
          </div>
        </section>

        {/* A depot travels with a salesman and is never anybody's default
            source, so the flag is simply not on offer for one. */}
        {!systemOwned && (
          <section className="flex flex-col gap-4">
            <h3 className={HEADING} style={HEADING_GLOW}>
              Main warehouse
            </h3>
            <Select
              label="Is this the company's main warehouse?"
              value={form.isMain ? 'yes' : 'no'}
              onChange={(e) => set('isMain', e.target.value === 'yes')}
              // Untickable once it holds the flag: clearing it would leave the
              // company with no default source at all, and the failure would
              // surface as a load that cannot be raised rather than here.
              disabled={warehouse?.is_main}
              options={[
                { value: 'no', label: 'No — documents name their source' },
                { value: 'yes', label: 'Yes — documents fall back to it' },
              ]}
            />
            {warehouse?.is_main ? (
              <p className="-mt-2 text-xs text-[var(--text-muted)]">
                Every document that names no source comes out of this warehouse. Make another one
                the main warehouse and the flag moves off this one by itself.
              </p>
            ) : form.isMain && currentMain ? (
              <p className="-mt-2 text-xs text-[var(--accent-amber)]">
                {currentMain.name} is the main warehouse today. Saving this moves the flag over —
                only one warehouse can hold it.
              </p>
            ) : (
              <p className="-mt-2 text-xs text-[var(--text-muted)]">
                The main warehouse is where goods come from when a document doesn't say. Only one
                warehouse can be it.
              </p>
            )}
          </section>
        )}

        <section className="flex flex-col gap-4">
          <h3 className={HEADING} style={HEADING_GLOW}>
            What it can carry
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={`Max weight (${WEIGHT_UNIT})`}
              type="number"
              min={0}
              step="any"
              value={form.maxWeight}
              onChange={(e) => set('maxWeight', e.target.value)}
              error={errors.maxWeight}
              placeholder="No ceiling"
            />
            <Input
              label={`Max volume (${VOLUME_UNIT})`}
              type="number"
              min={0}
              step="any"
              value={form.maxVolume}
              onChange={(e) => set('maxVolume', e.target.value)}
              error={errors.maxVolume}
              placeholder="No ceiling"
            />
          </div>
          <p className="-mt-2 text-xs text-[var(--text-muted)]">
            Leave either blank for no ceiling, which is what a building that has never run out of
            floor should say. A figure here is what the depot screens warn against when a load goes
            past it — a warning and never a refusal, since the man strapping the last pallet on can
            see the vehicle.
          </p>
        </section>
      </div>
    </SideDrawer>
  )
}
