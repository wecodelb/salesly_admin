import { useRef, useState } from 'react'
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Modal } from '@/shared/components/Modal/Modal'
import { Button } from '@/shared/components/Button'
import { apiErrorMessage } from '@/core/api/api-error'
import { save } from '@/features/reports/excel-export'
import type { ImportResult } from '../api/products-api'
import { useBrands, useCategories, useCurrencies, useImportItems, useUoms } from '../hooks/use-products'
import { IMPORT_COLUMNS, ImportFileError, importFileName, type ImportRow } from '../product-import'
import { importProblems, readImportWorkbook } from '../product-import-read'
import { writeImportWorkbook } from '../product-import-write'
import type { AdminItem } from '../types'
import { ImportSummary, Step } from './ProductImportParts'

interface Props {
  open: boolean
  onClose: () => void
  /** The whole catalogue, for the "with my products" download. */
  products: AdminItem[]
}

type Picked = { name: string; rows: ImportRow[] }
type Problem = { row: number | null; text: string }

/** Problems shown before "and N more": enough to start fixing, short enough to read. */
const SHOWN_PROBLEMS = 60

/**
 * Load products from a spreadsheet, in three steps on one screen: download
 * the template, fill it in, upload it.
 *
 * The template comes two ways. Empty, for a new catalogue. Or holding every
 * product already in the system, for changing prices across the board: edit
 * the cells, upload the same file, and only the rows that changed are written.
 *
 * Nothing is sent until the file has been read here. A file that is not the
 * template is turned away on the spot with the heading it is missing, rather
 * than after a round trip.
 */
export function ProductImportModal({ open, onClose, products }: Props) {
  const { data: units = [] } = useUoms()
  const { data: categories = [] } = useCategories()
  const { data: brands = [] } = useBrands()
  const { data: currencies = [] } = useCurrencies()
  const importItems = useImportItems()

  const fileInput = useRef<HTMLInputElement>(null)
  const [downloading, setDownloading] = useState<'empty' | 'full' | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [picked, setPicked] = useState<Picked | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [problems, setProblems] = useState<Problem[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = () => {
    setPicked(null)
    setFileError(null)
    setProblems([])
    setResult(null)
    setNotice(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  const close = () => {
    reset()
    onClose()
  }

  const download = async (withProducts: boolean) => {
    setDownloading(withProducts ? 'full' : 'empty')
    setNotice(null)
    try {
      const { buffer, dropped } = await writeImportWorkbook(withProducts ? products : [], {
        units: units.map((u) => u.name),
        categories: categories.map((c) => c.name),
        brands: brands.map((b) => b.name),
        currencies: currencies.filter((c) => c.is_active).map((c) => c.code),
      })
      save(buffer, importFileName(withProducts))
      if (dropped > 0) {
        setNotice(
          `${dropped} packaging${dropped > 1 ? 's' : ''} did not fit: the sheet holds two per product. Importing this file back would remove ${dropped > 1 ? 'them' : 'it'}.`,
        )
      }
    } catch {
      setNotice('The template could not be built. Try again.')
    } finally {
      setDownloading(null)
    }
  }

  const pick = async (file: File | undefined) => {
    if (!file) return
    setFileError(null)
    setProblems([])
    setResult(null)
    setPicked(null)
    try {
      const rows = await readImportWorkbook(await file.arrayBuffer())
      setPicked({ name: file.name, rows })
    } catch (e) {
      setFileError(e instanceof ImportFileError ? e.message : 'This file could not be read. Save it as .xlsx and try again.')
    }
  }

  const submit = async () => {
    if (!picked) return
    setProblems([])
    try {
      setResult(await importItems.mutateAsync(picked.rows))
    } catch (e) {
      const errors = (e as { response?: { status?: number; data?: { data?: Record<string, string[]> } } })?.response
      if (errors?.status === 422 && errors.data?.data && typeof errors.data.data === 'object') {
        setProblems(importProblems(errors.data.data, picked.rows))
      } else {
        setFileError(apiErrorMessage(e, 'The import failed. Nothing was changed.'))
      }
    }
  }

  const required = IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.header)

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import products"
      size="lg"
      footer={
        result ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              icon={<Upload size={16} />}
              disabled={!picked || problems.length > 0}
              loading={importItems.isPending}
              onClick={submit}
            >
              {picked ? `Import ${picked.rows.length} product${picked.rows.length === 1 ? '' : 's'}` : 'Import'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <ImportSummary result={result} />
      ) : (
        <div className="space-y-5">
          <Step n={1} title="Download the template">
            <p className="text-sm text-[var(--text-secondary)] mb-3">
              Start from the empty template for new products, or from your catalogue to change existing ones.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                icon={<Download size={16} />}
                loading={downloading === 'empty'}
                disabled={downloading !== null}
                onClick={() => download(false)}
              >
                Empty template
              </Button>
              <Button
                variant="outline"
                icon={<FileSpreadsheet size={16} />}
                loading={downloading === 'full'}
                disabled={downloading !== null || products.length === 0}
                onClick={() => download(true)}
              >
                Template with my {products.length} products
              </Button>
            </div>
            {notice && <p className="mt-2 text-xs text-[var(--accent-amber)]">{notice}</p>}
          </Step>

          <Step n={2} title="Fill it in exactly as it is">
            <ul className="text-sm text-[var(--text-secondary)] list-disc pl-5 space-y-1">
              <li>Keep the headings in rows 1 and 2 as they are. One product per row, from row 3.</li>
              <li>
                Required: <span className="font-medium text-[var(--text-primary)]">{required.join(', ')}</span>. Every
                heading has a note saying what goes under it, and the &ldquo;How to fill&rdquo; tab explains each column.
              </li>
              <li>
                The <span className="font-medium text-[var(--text-primary)]">Code</span> decides: a code you already
                have updates that product, a new code creates one. Nothing is deleted.
              </li>
              <li>New categories, brands and units are created by name. Stock is not imported.</li>
            </ul>
          </Step>

          <Step n={3} title="Upload the filled file">
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="w-full rounded-[var(--radius-card)] border-2 border-dashed border-[var(--border-default)] hover:border-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/5 transition-colors px-4 py-5 flex items-center gap-3 text-left cursor-pointer"
            >
              <FileSpreadsheet size={22} className="text-[var(--accent-primary)] flex-shrink-0" />
              {picked ? (
                <span className="text-sm">
                  <span className="font-medium text-[var(--text-primary)]">{picked.name}</span>
                  <span className="text-[var(--text-secondary)]">
                    {' '}
                    · {picked.rows.length} product{picked.rows.length === 1 ? '' : 's'} read. Click to pick another file.
                  </span>
                </span>
              ) : (
                <span className="text-sm text-[var(--text-secondary)]">Choose the .xlsx file you filled in</span>
              )}
            </button>

            {fileError && (
              <p className="mt-3 flex gap-2 text-sm text-[var(--accent-red)]">
                <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                {fileError}
              </p>
            )}

            {problems.length > 0 && (
              <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--accent-red)]/40 bg-[var(--accent-red)]/5">
                <p className="px-3 py-2 text-sm font-medium text-[var(--accent-red)] flex gap-2 border-b border-[var(--accent-red)]/20">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  Nothing was imported. Fix {problems.length === 1 ? 'this' : `these ${problems.length} problems`} in
                  the file, then upload it again.
                </p>
                <ul className="max-h-56 overflow-y-auto px-3 py-2 space-y-1 text-sm">
                  {problems.slice(0, SHOWN_PROBLEMS).map((p, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="font-mono text-xs text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">
                        {p.row ? `Row ${p.row}` : ''}
                      </span>
                      <span className="text-[var(--text-primary)]">{p.text}</span>
                    </li>
                  ))}
                  {problems.length > SHOWN_PROBLEMS && (
                    <li className="text-[var(--text-muted)]">and {problems.length - SHOWN_PROBLEMS} more…</li>
                  )}
                </ul>
              </div>
            )}
          </Step>
        </div>
      )}
    </Modal>
  )
}
