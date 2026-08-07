import { useRef } from 'react'
import { ExternalLink, Paperclip, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/shared/components/Button'
import { MAX_ATTACHMENT_BYTES, formatBytes, type CustomerAttachment } from '../types'

interface Props {
  /** Files already stored against the customer — edit mode only. */
  existing?: CustomerAttachment[]
  onExistingRemove?: (id: number) => void
  /** Newly picked files, still local until the drawer uploads them. */
  files: File[]
  onFilesChange: (files: File[]) => void
  disabled?: boolean
}

/**
 * Picks and lists a customer's attachments. Purely presentational — the drawer
 * owns every mutation. The 2 MB cap is the backend's, mirrored here so the
 * total is visible while picking instead of coming back as a 422.
 */
export function AttachmentsField({
  existing = [],
  onExistingRemove,
  files,
  onFilesChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const existingBytes = existing.reduce((sum, a) => sum + a.size_bytes, 0)
  const pickedBytes = files.reduce((sum, f) => sum + f.size, 0)
  const usedBytes = existingBytes + pickedBytes
  const over = usedBytes > MAX_ATTACHMENT_BYTES
  const fill = Math.min(usedBytes / MAX_ATTACHMENT_BYTES, 1)

  const pick = (list: FileList | null) => {
    if (list) onFilesChange([...files, ...Array.from(list)])
    // Clearing the input means picking the same file twice still fires change.
    if (inputRef.current) inputRef.current.value = ''
  }

  const removeFile = (i: number) => onFilesChange(files.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--text-primary)]">Files</span>
        <Button
          variant="secondary"
          size="sm"
          icon={<Plus size={14} />}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Add files
        </Button>
      </div>

      {/* No file-input component exists in shared/, so the real input stays
          hidden and the styled button drives it. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => pick(e.target.files)}
      />

      {existing.length === 0 && files.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">
          No attachments yet — trade licence, signed contract, shop photo.
        </p>
      )}

      {existing.map((a) => (
        <div
          key={a.id}
          className="flex items-center gap-2 rounded-[var(--radius-btn)] border border-[var(--border-subtle)] px-3 py-2"
        >
          <Paperclip size={14} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="flex-1 truncate text-sm text-[var(--text-primary)]">{a.name}</span>
          <span className="flex-shrink-0 text-xs font-mono text-[var(--text-muted)]">
            {formatBytes(a.size_bytes)}
          </span>
          {a.url && (
            <a
              href={a.url}
              target="_blank"
              rel="noreferrer"
              title="Open in a new tab"
              className="flex-shrink-0 p-1 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--bg-surface-raised)] transition-colors"
            >
              <ExternalLink size={14} />
            </a>
          )}
          {onExistingRemove && (
            <button
              type="button"
              title="Remove"
              disabled={disabled}
              onClick={() => onExistingRemove(a.id)}
              className="flex-shrink-0 p-1 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {files.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="flex items-center gap-2 rounded-[var(--radius-btn)] border border-dashed border-[var(--border-default)] px-3 py-2"
        >
          <Paperclip size={14} className="text-[var(--text-muted)] flex-shrink-0" />
          <span className="flex-1 truncate text-sm text-[var(--text-primary)]">{f.name}</span>
          <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">Not uploaded yet</span>
          <span className="flex-shrink-0 text-xs font-mono text-[var(--text-muted)]">
            {formatBytes(f.size)}
          </span>
          <button
            type="button"
            title="Remove"
            disabled={disabled}
            onClick={() => removeFile(i)}
            className="flex-shrink-0 p-1 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <div className="flex flex-col gap-1.5">
        <div className="h-1.5 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
          <div
            className={[
              'h-full rounded-full transition-all',
              over
                ? 'bg-[var(--accent-red)]'
                : fill > 0.75
                  ? 'bg-[var(--accent-amber)]'
                  : 'bg-[var(--accent-green)]',
            ].join(' ')}
            style={{ width: `${Math.round(fill * 100)}%` }}
          />
        </div>
        <p
          className={[
            'text-xs',
            over ? 'text-[var(--accent-red)]' : 'text-[var(--text-muted)]',
          ].join(' ')}
        >
          {formatBytes(usedBytes)} of {formatBytes(MAX_ATTACHMENT_BYTES)} used
        </p>
        {over && (
          <p className="text-xs text-[var(--accent-red)]">
            That is {formatBytes(usedBytes - MAX_ATTACHMENT_BYTES)} over the{' '}
            {formatBytes(MAX_ATTACHMENT_BYTES)} a customer may hold. Remove a file before saving.
          </p>
        )}
      </div>
    </div>
  )
}
