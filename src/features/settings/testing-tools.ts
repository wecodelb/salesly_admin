import { apiClient } from '@/core/api/client'

/** Testing only: wipes the company's documents, money, visits and stock. */
export async function clearCompanyData(): Promise<void> {
  await apiClient.post('/testing/reset-data', { confirm: 'yes' })
}

/** Testing only: takes back one invoice or order; its goods return to stock. */
export async function deleteTransaction(id: number | string): Promise<void> {
  await apiClient.delete(`/testing/transactions/${id}`)
}

/** Asks first, then deletes and goes back. False when he said no. */
export async function confirmAndDeleteTransaction(id: number | string): Promise<boolean> {
  if (!window.confirm('Delete this document? Its goods go back to stock and the customer no longer owes it. (Testing only)')) {
    return false
  }
  await deleteTransaction(id)
  return true
}
