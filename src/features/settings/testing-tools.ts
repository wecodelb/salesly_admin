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
  try {
    await deleteTransaction(id)
  } catch (e) {
    // Said out loud: a refused delete must not look like nothing happened.
    const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
    window.alert(msg ?? 'The document could not be deleted.')
    return false
  }
  return true
}
