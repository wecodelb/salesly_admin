// Contract from backend part 2 (GET/POST/DELETE /exchange-rates — append-only,
// no update, so past invoices can always be reprinted at the rate that
// produced them) and (GET/POST/PATCH/DELETE /currencies).
export type { Currency } from '@/features/products/types'

export type SymbolPosition = 'before' | 'after'

export interface ExchangeRate {
  id: number
  currency_id: number
  currency?: { id: number; code: string; symbol: string | null } | null
  rate: number
  effective_at: string | null
  /** Only ever filled in by rows recorded while an end date was still asked
   *  for; a rate now runs until the next one supersedes it. Kept because the
   *  API still returns it and the history reads it as a fallback window. */
  effective_to: string | null
  created_by?: number | null
  created_by_name?: string | null
  created_at?: string
}

export interface CreateExchangeRatePayload {
  currency_id: number
  rate: number
  effective_at: string
}

export interface CreateCurrencyPayload {
  code: string
  name: string
  symbol?: string | null
  decimal_places?: number
  symbol_position?: SymbolPosition
  is_base?: boolean
}

/** The code is set once at creation — the backend rejects any update carrying
 *  it, so it can't be part of this payload. */
export type UpdateCurrencyPayload = Partial<Omit<CreateCurrencyPayload, 'code'>>
