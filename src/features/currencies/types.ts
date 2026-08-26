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

  /** What one unit of the local currency buys of this one.
   *
   *  Required by the server unless this is the local currency itself, and
   *  written in the same transaction as the currency — so the catalog can never
   *  hold an active currency nothing is able to convert. */
  rate?: number

  /** Backdates the opening rate, for a catalog being brought in line with books
   *  that already exist. Defaults to now. */
  effective_at?: string
}

/** The code is set once at creation — the backend rejects any update carrying
 *  it, so it can't be part of this payload. */
export type UpdateCurrencyPayload = Partial<Omit<CreateCurrencyPayload, 'code'>>
