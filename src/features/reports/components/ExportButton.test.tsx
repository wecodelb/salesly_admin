import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { ExportButton } from './ExportButton'
import type { ReportDocument as Doc } from '../report-types'

const downloadExcel = vi.fn(async (..._args: unknown[]) => 'customers.xlsx')
vi.mock('../excel-export', () => ({ downloadExcel: (...args: unknown[]) => downloadExcel(...args) }))

/**
 * The button every list screen exports through.
 *
 * Two formats out of one document. For the PDF, two things are easy to get
 * wrong and invisible when they are: the document must exist in the DOM at the
 * moment print() is called, and it must not exist at any other moment. For the
 * workbook, the document handed over must be the one built at the click.
 */

interface Row {
  name: string
}

const doc: Doc<Row> = {
  title: 'Customers',
  subtitle: '2 of 10 customers · Owing',
  columns: [{ header: 'Customer', value: (r) => r.name }],
  groups: [{ key: 'all', title: '', rows: [{ name: 'Corner Shop' }] }],
}

let print: ReturnType<typeof vi.fn>

beforeEach(() => {
  print = vi.fn()
  vi.stubGlobal('print', print)
  useAuthStore.setState({ user: null })
  downloadExcel.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

const build = vi.fn(() => doc)
const trigger = () => screen.getByRole('button', { name: /^export/i })
const printed = () => document.querySelector('.report-doc.is-print-only')

async function exportAs(format: RegExp) {
  await userEvent.click(trigger())
  await userEvent.click(screen.getByRole('menuitem', { name: format }))
}

describe('the menu', () => {
  beforeEach(() => build.mockClear())

  it('offers both formats, and only once it is opened', async () => {
    render(<ExportButton build={build} />)
    expect(screen.queryByRole('menu')).toBeNull()

    await userEvent.click(trigger())

    expect(screen.getByRole('menuitem', { name: /pdf/i })).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /excel/i })).toBeInTheDocument()
    expect(trigger()).toHaveAttribute('aria-expanded', 'true')
  })

  it('builds nothing just for being opened', async () => {
    // Opening the menu is not asking for a file.
    render(<ExportButton build={build} />)
    await userEvent.click(trigger())

    expect(build).not.toHaveBeenCalled()
  })

  it('closes on Escape and hands focus back to the button', async () => {
    render(<ExportButton build={build} />)
    await userEvent.click(trigger())
    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger()).toHaveFocus()
  })

  it('works from the keyboard alone', async () => {
    render(<ExportButton build={build} />)
    await userEvent.click(trigger())

    expect(screen.getByRole('menuitem', { name: /pdf/i })).toHaveFocus()
    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: /excel/i })).toHaveFocus()
  })

  it('closes when somebody clicks elsewhere', async () => {
    render(
      <>
        <ExportButton build={build} />
        <p>elsewhere</p>
      </>,
    )
    await userEvent.click(trigger())
    await userEvent.click(screen.getByText('elsewhere'))

    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('cannot be opened while the screen has nothing worth exporting', async () => {
    render(<ExportButton build={build} disabled />)

    expect(trigger()).toBeDisabled()
    await userEvent.click(trigger())

    expect(screen.queryByRole('menu')).toBeNull()
    expect(build).not.toHaveBeenCalled()
  })
})

describe('as a PDF', () => {
  beforeEach(() => build.mockClear())

  it('renders no document at all until it is asked to', () => {
    // Otherwise every list screen in the console carries a hidden second copy
    // of its own table, laid out on every keystroke of the search box.
    render(<ExportButton build={build} />)

    expect(printed()).toBeNull()
    expect(build).not.toHaveBeenCalled()
  })

  it('has the document in the DOM before print() is called, not after', async () => {
    // The whole thing hinges on this: print() runs synchronously, so a document
    // that only appears on the next render prints a blank page.
    print.mockImplementation(() => {
      expect(printed()).not.toBeNull()
      expect(printed()!.textContent).toContain('Corner Shop')
    })

    render(<ExportButton build={build} />)
    await exportAs(/pdf/i)

    expect(print).toHaveBeenCalledOnce()
    expect(build).toHaveBeenCalledOnce()
    expect(downloadExcel).not.toHaveBeenCalled()
  })

  it('takes the document down again when the dialog closes', async () => {
    render(<ExportButton build={build} />)
    await exportAs(/pdf/i)
    expect(printed()).not.toBeNull()

    // afterprint fires outside React, so the teardown it triggers needs act().
    act(() => window.dispatchEvent(new Event('afterprint')))

    expect(printed()).toBeNull()
  })

  it('marks the document print-only, so it never shows on screen', async () => {
    render(<ExportButton build={build} />)
    await exportAs(/pdf/i)

    expect(printed()!.classList.contains('is-print-only')).toBe(true)
  })

  it('heads the page with the distributor, not with Salesly', async () => {
    // A report headed with the app's name reads as somebody else's paperwork.
    useAuthStore.setState({
      user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' },
    })
    render(<ExportButton build={build} />)
    await exportAs(/pdf/i)

    expect(printed()!.textContent).toContain('Nestle Lebanon')
  })

  it('falls back to Salesly rather than printing a blank masthead', async () => {
    render(<ExportButton build={build} />)
    await exportAs(/pdf/i)

    expect(printed()!.textContent).toContain('Salesly')
  })

  it('builds the document afresh on every export', async () => {
    // The rows change under it as filters move; a document captured once would
    // print whatever the screen showed the first time anybody exported.
    render(<ExportButton build={build} />)

    await exportAs(/pdf/i)
    act(() => window.dispatchEvent(new Event('afterprint')))
    await exportAs(/pdf/i)

    expect(build).toHaveBeenCalledTimes(2)
  })
})

describe('as an Excel workbook', () => {
  beforeEach(() => build.mockClear())

  it('hands the document built at the click to the workbook writer', async () => {
    useAuthStore.setState({
      user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' },
    })
    render(<ExportButton build={build} />)
    await exportAs(/excel/i)

    await waitFor(() => expect(downloadExcel).toHaveBeenCalledOnce())
    const [sent, options] = downloadExcel.mock.calls[0] as [Doc<Row>, { company: string }]
    expect(sent).toBe(doc)
    expect(options.company).toBe('Nestle Lebanon')
    expect(print).not.toHaveBeenCalled()
    expect(printed()).toBeNull()
  })

  it('says so on screen when the workbook cannot be written', async () => {
    downloadExcel.mockRejectedValueOnce(new Error('disk full'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportButton build={build} />)
    await exportAs(/excel/i)

    expect(await screen.findByRole('alert')).toHaveTextContent(/disk full/)
  })
})

describe('when the document cannot be built', () => {
  it('says so on screen instead of doing nothing at all', async () => {
    // The worst failure this button had: a builder that throws made the click
    // a no-op — no print, no dialog, no message, nothing in the UI to report.
    const boom = vi.fn(() => {
      throw new Error('rate is not a number')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportButton build={boom} />)
    await exportAs(/pdf/i)

    expect(print).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/rate is not a number/)
  })

  it('leaves the reason in the console for whoever has to fix it', async () => {
    const boom = vi.fn(() => {
      throw new Error('boom')
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportButton build={boom} />)
    await exportAs(/excel/i)

    expect(logged).toHaveBeenCalled()
    expect(downloadExcel).not.toHaveBeenCalled()
  })

  it('clears the message once an export succeeds', async () => {
    let explode = true
    const flaky = vi.fn(() => {
      if (explode) throw new Error('boom')
      return doc
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportButton build={flaky} />)
    await exportAs(/pdf/i)
    expect(screen.getByRole('alert')).toBeInTheDocument()

    explode = false
    await exportAs(/pdf/i)

    expect(screen.queryByRole('alert')).toBeNull()
    expect(print).toHaveBeenCalledOnce()
  })
})
