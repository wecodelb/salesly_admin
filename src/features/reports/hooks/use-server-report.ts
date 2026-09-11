import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  fetchInventory,
  fetchLoads,
  fetchSalesAnalysis,
  fetchUnloads,
  type InventoryParams,
  type MovementParams,
  type SalesParams,
} from '../api/reports-api'
import type { ReportResult } from '../server-report-doc'

export type ReportRequest =
  | { engine: 'sales'; params: SalesParams }
  | { engine: 'inventory'; params: InventoryParams }
  | { engine: 'loads'; params: MovementParams }
  | { engine: 'unloads'; params: MovementParams }

async function run(request: ReportRequest): Promise<ReportResult> {
  switch (request.engine) {
    case 'sales':
      return { engine: 'sales', data: await fetchSalesAnalysis(request.params) }
    case 'inventory':
      return { engine: 'inventory', data: await fetchInventory(request.params) }
    case 'loads':
      return { engine: 'loads', data: await fetchLoads(request.params) }
    case 'unloads':
      return { engine: 'unloads', data: await fetchUnloads(request.params) }
  }
}

/**
 * One report, re-read whenever what it asks changes.
 *
 * The last answer stays on screen while the next one loads, so changing a
 * filter dims the table for a moment rather than blanking it — the reader
 * keeps their place, and sees what changed when the new figures land.
 */
export function useServerReport(request: ReportRequest) {
  return useQuery({
    queryKey: ['server-report', request.engine, request.params],
    queryFn: () => run(request),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
