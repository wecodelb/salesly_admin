import { useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { Input } from '@/shared/components/Input'
import { deletePaymentTerm, fetchPaymentTerms, savePaymentTerm, type PaymentTerm } from './payment-terms-api'

/**
 * How long customers have to pay. One term is the default: a customer created
 * without terms gets it, and every invoice falls due its number of days after
 * it is written.
 */
export function PaymentTermsPage() {
  const client = useQueryClient()
  const { data: terms = [] } = useQuery({ queryKey: ['payment-terms'], queryFn: fetchPaymentTerms })
  const refresh = () => client.invalidateQueries({ queryKey: ['payment-terms'] })
  const save = useMutation({ mutationFn: savePaymentTerm, onSuccess: refresh })
  const remove = useMutation({ mutationFn: deletePaymentTerm, onSuccess: refresh })
  const [name, setName] = useState('')
  const [days, setDays] = useState('')

  const add = () => {
    if (!name.trim() || days === '') return
    save.mutate({ name: name.trim(), days: Number(days), is_default: false }, {
      onSuccess: () => {
        setName('')
        setDays('')
      },
    })
  }

  return (
    <>
      <PageHeader title="Payment terms" subtitle="How many days customers have to pay an invoice" />
      <div className="max-w-2xl rounded-xl border border-[var(--border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-hover)] text-left text-[var(--text-muted)]">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Days</th>
              <th className="px-3 py-2">Default</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {terms.map((t: PaymentTerm) => (
              <tr key={t.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 text-[var(--text-muted)]">{t.id}</td>
                <td className="px-3 py-2 font-medium">{t.name}</td>
                <td className="px-3 py-2 text-right">{t.days}</td>
                <td className="px-3 py-2">
                  {t.is_default ? (
                    <span className="text-xs font-semibold text-[var(--accent-blue)]">Default</span>
                  ) : (
                    <button
                      className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-blue)] inline-flex items-center gap-1"
                      onClick={() => save.mutate({ ...t, is_default: true })}
                    >
                      <Star size={12} /> Make default
                    </button>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {!t.is_default && (
                    <button aria-label={`Delete ${t.name}`} className="text-[var(--accent-red)]" onClick={() => remove.mutate(t.id)}>
                      <Trash2 size={15} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-end gap-2 border-t border-[var(--border)] p-3">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 14 days" />
          <Input label="Days" type="number" min={0} value={days} onChange={(e) => setDays(e.target.value)} />
          <Button icon={<Plus size={15} />} onClick={add} disabled={save.isPending}>
            Add
          </Button>
        </div>
      </div>
    </>
  )
}
