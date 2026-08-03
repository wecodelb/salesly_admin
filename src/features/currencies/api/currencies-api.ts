import { apiClient } from '@/core/api/client'
import { ENDPOINTS } from '@/core/api/endpoints'
import type { Currency } from '@/features/products/types'
import type {
  CreateCurrencyPayload,
  CreateExchangeRatePayload,
  ExchangeRate,
  UpdateCurrencyPayload,
} from '../types'

interface Envelope<T> {
  status: string
  message: string | null
  data: T
}

interface ListData<T> {
  data: T[]
}

export async function fetchCurrencies(): Promise<Currency[]> {
  const res = await apiClient.get<Envelope<ListData<Currency>>>(ENDPOINTS.CURRENCIES)
  return res.data.data?.data ?? []
}

/** Returns the created row so the caller can chain its first rate onto it. */
export async function createCurrency(payload: CreateCurrencyPayload): Promise<Currency> {
  const res = await apiClient.post<Envelope<{ data: Currency }>>(ENDPOINTS.CURRENCIES, payload)
  return res.data.data.data
}

export async function updateCurrency(id: number, payload: UpdateCurrencyPayload): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.CURRENCIES}/${id}`, payload)
}

export async function setBaseCurrency(id: number): Promise<void> {
  await apiClient.patch(`${ENDPOINTS.CURRENCIES}/${id}`, { is_base: true })
}

export async function fetchExchangeRates(currencyId?: number): Promise<ExchangeRate[]> {
  const res = await apiClient.get<Envelope<ListData<ExchangeRate>>>(ENDPOINTS.EXCHANGE_RATES, {
    params: currencyId ? { currency_id: currencyId, per_page: 100 } : { per_page: 100 },
  })
  return res.data.data?.data ?? []
}

export async function createExchangeRate(payload: CreateExchangeRatePayload): Promise<void> {
  await apiClient.post(ENDPOINTS.EXCHANGE_RATES, payload)
}

export async function deleteExchangeRate(id: number): Promise<void> {
  await apiClient.delete(`${ENDPOINTS.EXCHANGE_RATES}/${id}`)
}
