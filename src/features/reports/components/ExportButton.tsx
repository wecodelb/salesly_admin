import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react'

import { useAuthStore } from '@/core/auth/auth-store'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { ReportDocument } from './ReportDocument'
import { downloadExcel } from '../excel-export'
import type { ReportDocument as Doc } from '../report-types'
import '../report-print.css'

interface Props<Row> {
  /**
   * The document to export, built when a format is chosen rather than on every
   * render. A list screen showing five hundred rows should not pay to lay out
   * a file nobody has asked for.
   */
  build: () => Doc<Row>
  /** Nothing worth exporting yet — still loading, or the read failed. */
  disabled?: boolean
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  /**
   * Where the PDF comes from. `portal` (the default) mounts a print-only copy
   * of the document for the list screens, which do not show one. `screen` is
   * for a page whose report is already on screen: it prints that, rather than
   * laying out a second copy beside it that would print twice.
   */
  pdf?: 'portal' | 'screen'
}

type Format = 'pdf' | 'excel'

const FORMATS: { format: Format; title: string; hint: string }[] = [
  { format: 'pdf', title: 'PDF document', hint: 'Print-ready pages to file or send' },
  { format: 'excel', title: 'Excel workbook', hint: 'Real numbers, live totals, filters' },
]

/**
 * Export this screen — as a PDF to file, or as an Excel workbook to work with.
 *
 * Both come out of the one document the screen builds, so the two formats can
 * never disagree about which rows are in it: what is exported is what the
 * screen is showing, filters and all.
 *
 * The PDF is the browser's own print-to-PDF: real vector text and headings that
 * repeat on every page, laid out by the same component whichever screen it was
 * run from. The workbook is generated here, in the browser, with the figures as
 * numbers rather than text so the office can sort, filter and add them up.
 */
export function ExportButton<Row>({
  build,
  disabled,
  label = 'Export',
  variant,
  pdf = 'portal',
}: Props<Row>) {
  const company = useAuthStore((s) => s.user?.company) || 'Salesly'
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<Format | null>(null)
  const [printing, setPrinting] = useState<{ doc: Doc<Row>; at: Date } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  // The printed document is torn down when the dialog closes rather than on
  // the line after print(): browsers disagree about whether window.print()
  // blocks, and unmounting too early prints a blank page in the ones that don't.
  useEffect(() => {
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    // Focus the first choice, so the menu works from the keyboard at once.
    itemRefs.current[0]?.focus()
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const make = useCallback((): Doc<Row> | null => {
    try {
      return build()
    } catch (error) {
      // A builder that throws used to make the button do nothing whatsoever —
      // the hardest failure there is to report. It says so on screen instead,
      // and leaves the reason in the console.
      console.error('Export failed while building the document', error)
      setFailed(error instanceof Error ? error.message : 'Unknown error')
      return null
    }
  }, [build])

  const choose = useCallback(
    async (format: Format) => {
      setOpen(false)
      const doc = make()
      if (!doc) return
      setFailed(null)

      if (format === 'pdf') {
        if (pdf === 'screen') {
          window.print()
          return
        }
        // flushSync, not a plain setState: window.print() runs synchronously on
        // the next line and would otherwise find nothing in the DOM to print.
        flushSync(() => setPrinting({ doc, at: new Date() }))
        window.print()
        return
      }

      setBusy('excel')
      try {
        const fileName = await downloadExcel(doc, { company, generatedAt: new Date() })
        toast.success('Excel workbook ready', fileName)
      } catch (error) {
        console.error('Export failed while writing the workbook', error)
        setFailed(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setBusy(null)
      }
    },
    [company, make, toast, pdf],
  )

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter(Boolean) as HTMLButtonElement[]
    const at = items.indexOf(document.activeElement as HTMLButtonElement)

    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(at + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(at - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className="relative inline-flex items-center gap-2">
      <Button
        ref={triggerRef}
        icon={<Download size={16} />}
        variant={variant}
        disabled={disabled}
        loading={busy !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {busy === 'excel' ? 'Building…' : label}
        <ChevronDown
          size={14}
          aria-hidden
          className={['-mr-1 opacity-60 transition-transform', open ? 'rotate-180' : ''].join(' ')}
        />
      </Button>

      {open && (
        <div
          role="menu"
          aria-label="Export format"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-full z-50 mt-2 w-72 origin-top-right rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-1.5 shadow-[var(--shadow-modal)]"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Export what's on screen as
          </p>
          {FORMATS.map((item, i) => {
            const Icon = item.format === 'pdf' ? FileText : FileSpreadsheet
            return (
              <button
                key={item.format}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                role="menuitem"
                type="button"
                onClick={() => void choose(item.format)}
                className="group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[var(--bg-surface-raised)] focus:bg-[var(--bg-surface-raised)] focus:outline-none"
              >
                <span
                  className={[
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105',
                    item.format === 'pdf'
                      ? 'bg-red-50 text-red-600 dark:bg-red-900/25 dark:text-red-400'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400',
                  ].join(' ')}
                >
                  <Icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </span>
                  <span className="block text-xs text-[var(--text-muted)]">{item.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}

      {failed && (
        <span
          role="alert"
          title={failed}
          className="max-w-[220px] truncate text-xs text-[var(--accent-red)]"
        >
          Couldn't export — {failed}
        </span>
      )}

      {/* Portalled to the body. The print rules lay the document out against
          the page, and left inside a header's action bar it would be positioned
          against whichever ancestor happens to be `relative`. */}
      {printing &&
        createPortal(
          <ReportDocument
            doc={printing.doc}
            companyName={company}
            generatedAt={printing.at}
            className="is-print-only"
          />,
          document.body,
        )}
    </div>
  )
}
