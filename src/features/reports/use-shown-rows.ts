import { useCallback, useRef } from 'react'

/**
 * The rows a screen's table is actually showing, in the order it shows them.
 *
 * A page knows which rows survived its filters, but not how the table then
 * sorted them — that state lives inside DataTable, because sorting is a
 * property of the table rather than of the page. Export needs both: a PDF whose
 * rows are ordered differently from the table it was run from cannot be checked
 * against the screen, which is most of what people do with a printed table.
 *
 * Kept in a ref rather than state on purpose. The value is only ever read at
 * the moment somebody clicks Export, and holding it in state would re-render
 * every page on every sort for a value nothing renders.
 */
export function useShownRows<T>(fallback: T[]) {
  const shown = useRef<T[] | null>(null)

  const onVisibleRows = useCallback((rows: T[]) => {
    shown.current = rows
  }, [])

  /**
   * What to print. Falls back to the page's own filtered rows for the moment
   * before the table has reported — and for the screens whose export does not
   * come from a DataTable at all.
   */
  const rows = useCallback(() => shown.current ?? fallback, [fallback])

  return { rows, onVisibleRows }
}
