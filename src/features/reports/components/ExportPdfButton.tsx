import { useCallback, useEffect, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { Printer } from 'lucide-react'

import { useAuthStore } from '@/core/auth/auth-store'
import { Button } from '@/shared/components/Button'
import { ReportDocument } from './ReportDocument'
import type { ReportDocument as Doc } from '../report-types'
import '../report-print.css'

interface Props<Row> {
  /**
   * The document to print, built when the button is clicked rather than on
   * every render. A list screen showing five hundred rows should not pay to
   * lay out a PDF nobody has asked for.
   */
  build: () => Doc<Row>
  /** Nothing worth printing yet — still loading, or the read failed. */
  disabled?: boolean
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
}

/**
 * Export this screen as a PDF.
 *
 * Printing rather than generating a file is the same trade the Reports page
 * makes: it costs one click in the browser's dialog and buys real vector text
 * somebody can search, headings that repeat on every page, and — the part that
 * matters most here — a single document layout shared by every screen. A
 * customers PDF run from the Customers page and one run from Reports come out
 * of the same component, so they cannot drift into looking like two systems.
 *
 * What prints is what the screen is showing: the caller passes its filtered
 * rows, so the PDF and the table can never disagree about which customers are
 * in it.
 */
export function ExportPdfButton<Row>({
  build,
  disabled,
  label = 'Export PDF',
  variant,
}: Props<Row>) {
  const company = useAuthStore((s) => s.user?.company)
  const [printing, setPrinting] = useState<{ doc: Doc<Row>; at: Date } | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  // The document is torn down when the dialog closes rather than on the line
  // after print(): browsers disagree about whether window.print() blocks, and
  // unmounting too early prints a blank page in the ones that don't.
  useEffect(() => {
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    return () => window.removeEventListener('afterprint', done)
  }, [])

  const print = useCallback(() => {
    let doc: Doc<Row>
    try {
      doc = build()
    } catch (error) {
      // A builder that throws used to make this button do nothing whatsoever:
      // no print, no dialog, no message. That is the hardest possible failure
      // to report or diagnose — "I click it and nothing happens" — so it says
      // so on screen instead, and leaves the reason in the console.
      console.error('Export failed while building the document', error)
      setFailed(error instanceof Error ? error.message : 'Unknown error')
      return
    }

    setFailed(null)
    // flushSync, not a plain setState: window.print() runs synchronously on the
    // next line and would otherwise find nothing in the DOM to print.
    flushSync(() => setPrinting({ doc, at: new Date() }))
    window.print()
  }, [build])

  return (
    <>
      <Button
        icon={<Printer size={16} />}
        onClick={print}
        disabled={disabled}
        variant={variant}
      >
        {label}
      </Button>

      {failed && (
        <span
          role="alert"
          title={failed}
          className="text-xs text-[var(--accent-red)] max-w-[220px] truncate"
        >
          Couldn't build the PDF — {failed}
        </span>
      )}

      {/* Portalled to the body. The print rules lay the document out against
          the page, and left inside a header's action bar it would be positioned
          against whichever ancestor happens to be `relative`. */}
      {printing &&
        createPortal(
          <ReportDocument
            doc={printing.doc}
            companyName={company || 'Salesly'}
            generatedAt={printing.at}
            className="is-print-only"
          />,
          document.body,
        )}
    </>
  )
}
