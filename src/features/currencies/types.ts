// Contract from backend part 2 (GET/POST/DELETE /exchange-rates — append-only,
// no update, so past invoices can always be reprinted at the rate that
// produced them) and (GET/POST/PATCH/DELETE /currencies).
export type { Currency } from '@/features/products/types'

export interface ExchangeRate {
  id: number
  currency_id: number
  currency?: { id: number; code: string; symbol: string | null } | null
  rate: number
  effective_at: string | null
  created_at?: string
}

export interface CreateExchangeRatePayload {
  currency_id: number
  rate: number
  effective_at: string
}
