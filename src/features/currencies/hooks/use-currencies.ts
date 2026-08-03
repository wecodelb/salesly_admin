import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCurrency,
  createExchangeRate,
  deleteExchangeRate,
  fetchCurrencies,
  fetchExchangeRates,
  setBaseCurrency,
  updateCurrency,
} from '../api/currencies-api'
import type {
  CreateCurrencyPayload,
  CreateExchangeRatePayload,
  UpdateCurrencyPayload,
} from '../types'

// Shared with features/products' own useCurrencies() — same key so the product
// form's currency picker picks up edits made here without a reload.
const CURRENCIES_KEY = ['admin-currencies'] as const
const RATES_KEY = ['admin-exchange-rates'] as const

export function useCurrencies() {
  return useQuery({ queryKey: CURRENCIES_KEY, queryFn: () => fetchCurrencies() })
}

export function useCreateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCurrencyPayload) => createCurrency(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: CURRENCIES_KEY }),
  })
}

export function useUpdateCurrency() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCurrencyPayload }) =>
      updateCurrency(id, payload),
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

export function useExchangeRates(currencyId: number | null) {
  return useQuery({
    queryKey: [...RATES_KEY, currencyId ?? 'none'],
    queryFn: () => fetchExchangeRates(currencyId ?? undefined),
    enabled: currencyId != null,
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
