import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { ExportPdfButton } from './ExportPdfButton'
import type { ReportDocument as Doc } from '../report-types'

/**
 * The button every list screen exports through.
 *
 * Two things here are easy to get wrong and invisible when they are: the
 * document must exist in the DOM at the moment print() is called, and it must
 * not exist at any other moment. Get the first wrong and the PDF is blank; get
 * the second wrong and every screen in the console permanently carries a hidden
 * copy of its own table.
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
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState({ user: null })
})

const build = vi.fn(() => doc)
const button = () => screen.getByRole('button', { name: /export pdf/i })
const printed = () => document.querySelector('.report-doc.is-print-only')

describe('ExportPdfButton', () => {
  beforeEach(() => build.mockClear())

  it('renders no document at all until it is asked to', () => {
    // Otherwise every list screen in the console carries a hidden second copy
    // of its own table, laid out on every keystroke of the search box.
    render(<ExportPdfButton build={build} />)

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

    render(<ExportPdfButton build={build} />)
    await userEvent.click(button())

    expect(print).toHaveBeenCalledOnce()
    expect(build).toHaveBeenCalledOnce()
  })

  it('takes the document down again when the dialog closes', async () => {
    render(<ExportPdfButton build={build} />)
    await userEvent.click(button())
    expect(printed()).not.toBeNull()

    // afterprint fires outside React, so the teardown it triggers needs act().
    act(() => window.dispatchEvent(new Event('afterprint')))

    expect(printed()).toBeNull()
  })

  it('marks the document print-only, so it never shows on screen', async () => {
    render(<ExportPdfButton build={build} />)
    await userEvent.click(button())

    expect(printed()!.classList.contains('is-print-only')).toBe(true)
  })

  it('heads the page with the distributor, not with Salesly', async () => {
    // A report headed with the app's name reads as somebody else's paperwork.
    useAuthStore.setState({
      user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' },
    })
    render(<ExportPdfButton build={build} />)
    await userEvent.click(button())

    expect(printed()!.textContent).toContain('Nestle Lebanon')
  })

  it('falls back to Salesly rather than printing a blank masthead', async () => {
    // Sessions that predate the login storing a company name still have to
    // produce a headed page.
    render(<ExportPdfButton build={build} />)
    await userEvent.click(button())

    expect(printed()!.textContent).toContain('Salesly')
  })

  it('does nothing while the screen has nothing worth printing', async () => {
    render(<ExportPdfButton build={build} disabled />)

    expect(button()).toBeDisabled()
    await userEvent.click(button())

    expect(print).not.toHaveBeenCalled()
    expect(build).not.toHaveBeenCalled()
  })

  it('builds the document afresh on every click', async () => {
    // The rows change under it as filters move; a document captured once would
    // print whatever the screen showed the first time anybody exported.
    render(<ExportPdfButton build={build} />)

    await userEvent.click(button())
    act(() => window.dispatchEvent(new Event('afterprint')))
    await userEvent.click(button())

    expect(build).toHaveBeenCalledTimes(2)
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

    render(<ExportPdfButton build={boom} />)
    await userEvent.click(button())

    expect(print).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/rate is not a number/)
  })

  it('leaves the reason in the console for whoever has to fix it', async () => {
    const boom = vi.fn(() => {
      throw new Error('boom')
    })
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportPdfButton build={boom} />)
    await userEvent.click(button())

    expect(logged).toHaveBeenCalled()
  })

  it('clears the message once an export succeeds', async () => {
    let explode = true
    const flaky = vi.fn(() => {
      if (explode) throw new Error('boom')
      return doc
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    render(<ExportPdfButton build={flaky} />)
    await userEvent.click(button())
    expect(screen.getByRole('alert')).toBeInTheDocument()

    explode = false
    await userEvent.click(button())

    expect(screen.queryByRole('alert')).toBeNull()
    expect(print).toHaveBeenCalledOnce()
  })
})
