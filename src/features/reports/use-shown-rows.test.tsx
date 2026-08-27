import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { DataTable, type Column } from '@/shared/components/DataTable/DataTable'
import { useShownRows } from './use-shown-rows'

/**
 * The rows an export actually prints.
 *
 * Filtering is only half of "print what is shown". The sort lives inside
 * DataTable — it is a property of the table, not of the page — so a page that
 * prints its own filtered array puts the rows in a different order from the
 * table they were exported from. A printed table that cannot be followed down
 * the screen beside it is most of the way to useless.
 */

interface Row extends Record<string, unknown> {
  name: string
  qty: number
}

const ROWS: Row[] = [
  { name: 'Beta', qty: 30 },
  { name: 'Alpha', qty: 10 },
  { name: 'Gamma', qty: 20 },
]

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'qty', header: 'Qty', sortable: true },
]

/** A page in miniature: a table, and a button that prints what it shows. */
function Harness({ data = ROWS }: { data?: Row[] }) {
  const { rows, onVisibleRows } = useShownRows(data)

  return (
    <>
      <button onClick={() => screen.getByTestId('out').setAttribute(
        'data-rows',
        rows().map((r) => r.name).join(','),
      )}>
        export
      </button>
      <span data-testid="out" data-rows="" />
      <DataTable columns={columns} data={data} onVisibleRows={onVisibleRows} />
    </>
  )
}

const exported = () => screen.getByTestId('out').getAttribute('data-rows')

const clickExport = () => userEvent.click(screen.getByRole('button', { name: 'export' }))

describe('useShownRows', () => {
  it('gives the page its own rows before the table has said anything', async () => {
    // The fallback matters: a page must be able to export the moment it paints,
    // not only after the table has reported.
    render(<Harness />)
    await clickExport()

    expect(exported()).toBe('Beta,Alpha,Gamma')
  })

  it('follows the table once a column is sorted', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByText('Name'))
    await clickExport()

    expect(exported()).toBe('Alpha,Beta,Gamma')
  })

  it('follows it back when the sort is reversed', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByText('Name'))
    await userEvent.click(screen.getByText('Name'))
    await clickExport()

    expect(exported()).toBe('Gamma,Beta,Alpha')
  })

  it('sorts numbers as numbers, and prints them that way', async () => {
    render(<Harness />)

    await userEvent.click(screen.getByText('Qty'))
    await clickExport()

    expect(exported()).toBe('Alpha,Gamma,Beta')
  })

  it('keeps up when the rows underneath it change', async () => {
    // A filter narrowing the list must reach the export too, not leave it
    // printing the rows the table was showing a moment ago.
    const { rerender } = render(<Harness />)
    await clickExport()
    expect(exported()).toBe('Beta,Alpha,Gamma')

    rerender(<Harness data={[{ name: 'Alpha', qty: 10 }]} />)
    await clickExport()

    expect(exported()).toBe('Alpha')
  })

  it('reports the sorted order, not merely the sorted table', async () => {
    // Guards the wiring rather than the sort: DataTable could sort its own
    // markup correctly and still hand the page the untouched array.
    render(<Harness />)

    await userEvent.click(screen.getByText('Qty'))
    const onScreen = [...document.querySelectorAll('tbody tr')].map(
      (tr) => tr.querySelector('td')?.textContent,
    )
    await clickExport()

    expect(onScreen).toEqual(['Alpha', 'Gamma', 'Beta'])
    expect(exported()).toBe(onScreen.join(','))
  })
})
