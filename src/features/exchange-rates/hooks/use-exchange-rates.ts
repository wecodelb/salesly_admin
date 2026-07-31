import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCurrency,
  createExchangeRate,
  deleteExchangeRate,
  fetchCurrencies,
  fetchExchangeRates,
  setBaseCurrency,
} from '../api/exchange-rates-api'
import type { CreateExchangeRatePayload } from '../types'

const CURRENCIES_KEY = ['admin-currencies'] as const
const RATES_KEY = ['admin-exchange-rates'] as const

export function useCurrencies() {
  return useQuery({ queryKey: CURRENCIES_KEY, queryFn: () => fetchCurrencies() })
}

export function useCreateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: { code: string; name: string; symbol?: string }) => createCurrency(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  })
}

export function useSetBaseCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => setBaseCurrency(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  })
}

export function useExchangeRates(currencyId?: number) {
  return useQuery({
    queryKey: [...RATES_KEY, currencyId ?? 'all'],
    queryFn: () => fetchExchangeRates(currencyId),
  })
}

export function useCreateExchangeRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateExchangeRatePayload) => createExchangeRate(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: RATES_KEY }),
  })
}

export function useDeleteExchangeRate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteExchangeRate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: RATES_KEY }),
  })
}
