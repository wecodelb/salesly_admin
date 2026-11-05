import { apiClient } from '@/core/api/client'

export interface PaymentTerm {
  id?: number
  name: string
  days: number
  is_default: boolean
}

export async function fetchPaymentTerms(): Promise<PaymentTerm[]> {
  const res = await apiClient.get('/payment-terms')
  return res.data?.data?.data ?? []
}

export async function savePaymentTerm(term: PaymentTerm): Promise<PaymentTerm> {
  const body = { name: term.name, days: term.days, is_default: term.is_default }
  const res = term.id ? await apiClient.post(`/payment-terms/${term.id}`, body) : await apiClient.post('/payment-terms', body)
  return res.data.data.data
}

export async function deletePaymentTerm(id?: number): Promise<void> {
  await apiClient.delete(`/payment-terms/${id}`)
}
