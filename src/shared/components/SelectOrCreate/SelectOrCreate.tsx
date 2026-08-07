import { useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { Select } from '@/shared/components/Select'
import { Input } from '@/shared/components/Input'

interface Option {
  value: string
  label: string
}

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  error?: string
  /** Placeholder for the create field, e.g. "e.g. Beverages". */
  createPlaceholder?: string
  /** Resolve with the new row's id to have it selected automatically. */
  onCreate: (name: string) => Promise<string | number | void>
  creating?: boolean
  /** Tooltip on the + button, e.g. "Add a category". */
  createHint?: string
}

/**
 * Pick an existing option, or add a missing one without leaving the form.
 *
 * Creating and selecting are the same intent — you add a category *because*
 * you want this product in it — so the + swaps the picker for a name field
 * rather than sitting beside a second, permanently-visible input. On success
 * the new row is selected, which is what you were going to do next anyway.
 */
export function SelectOrCreate({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  createPlaceholder,
  onCreate,
  creating = false,
  createHint,
}: Props) {
  const [isCreating, setIsCreating] = useState(false)
  const [draft, setDraft] = useState('')

  const cancel = () => {
    setIsCreating(false)
    setDraft('')
  }

  const confirm = async () => {
    const name = draft.trim()
    if (!name) return

    const created = await onCreate(name)
    if (created != null) onChange(String(created))
    cancel()
  }

  if (isCreating) {
    return (
      <div>
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-1.5">
          New {label.toLowerCase()}
        </label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={createPlaceholder}
              aria-label={`New ${label.toLowerCase()} name`}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void confirm()
                }
                if (e.key === 'Escape') cancel()
              }}
            />
          </div>
          <button
            type="button"
            title="Save"
            aria-label={`Save new ${label.toLowerCase()}`}
            disabled={!draft.trim() || creating}
            onClick={() => void confirm()}
            className="p-2.5 rounded-[var(--radius-btn)] bg-[var(--accent-primary)] text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Check size={15} />
          </button>
          <button
            type="button"
            title="Cancel"
            aria-label="Cancel"
            onClick={cancel}
            className="p-2.5 rounded-[var(--radius-btn)] border border-[var(--border-default)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-end gap-2">
        <div className="flex-1 min-w-0">
          <Select
            label={label}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            options={options}
            placeholder={placeholder}
            error={error}
          />
        </div>
        <button
          type="button"
          title={createHint ?? `Add a ${label.toLowerCase()}`}
          aria-label={createHint ?? `Add a ${label.toLowerCase()}`}
          onClick={() => setIsCreating(true)}
          className={[
            'p-2.5 rounded-[var(--radius-btn)] border border-[var(--border-default)]',
            'text-[var(--text-muted)] hover:text-[var(--accent-primary)]',
            'hover:border-[var(--accent-primary)] hover:bg-[var(--bg-surface-raised)]',
            'transition-colors cursor-pointer flex-shrink-0',
            // Nudge up past the error line so it stays level with the select.
            error ? 'mb-6' : '',
          ].join(' ')}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}
