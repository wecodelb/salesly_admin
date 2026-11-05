import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Button } from '@/shared/components/Button'
import { clearCompanyData } from '../testing-tools'

interface CompanySettings {
  checkin_requires_barcode: boolean
}

async function fetchSettings(): Promise<CompanySettings> {
  const res = await apiClient.get('/company-settings')
  return res.data.data.data
}

async function saveSettings(settings: CompanySettings): Promise<CompanySettings> {
  const res = await apiClient.post('/company-settings', settings)
  return res.data.data.data
}

export function SettingsPage() {
  const client = useQueryClient()
  const { data } = useQuery({ queryKey: ['company-settings'], queryFn: fetchSettings })
  const save = useMutation({
    mutationFn: saveSettings,
    onSuccess: (saved) => client.setQueryData(['company-settings'], saved),
  })
  const clear = useMutation({ mutationFn: clearCompanyData, onSuccess: () => client.invalidateQueries() })

  return (
    <>
      <PageHeader title="Settings" subtitle="Company configuration" />
      <label className="flex items-start gap-3 max-w-xl rounded-xl border border-[var(--border)] p-4">
        <input
          type="checkbox"
          aria-label="Require a barcode scan at check-in"
          className="mt-1"
          checked={data?.checkin_requires_barcode ?? false}
          disabled={!data || save.isPending}
          onChange={(e) => save.mutate({ checkin_requires_barcode: e.target.checked })}
        />
        <span>
          <span className="block text-sm font-medium">Require a barcode scan at check-in</span>
          <span className="block text-xs text-[var(--text-muted)]">
            On: a salesman must scan the customer&apos;s own barcode to check in. Off: he checks in with a tap.
          </span>
        </span>
      </label>

      {/* Testing only: wipes documents, money, visits and stock; customers,
          products and people stay. Only the company owner may do it. */}
      <div className="mt-6 flex max-w-xl items-center justify-between gap-3 rounded-xl border border-[var(--accent-red)] p-4">
        <span>
          <span className="block text-sm font-medium">Clear data (testing)</span>
          <span className="block text-xs text-[var(--text-muted)]">
            Deletes every invoice, order, return, collection, visit and stock level. Customers, products and users stay.
          </span>
        </span>
        <Button
          variant="danger"
          disabled={clear.isPending}
          onClick={() => {
            if (window.confirm('Are you sure you want to clear all the data? This cannot be undone.')) clear.mutate()
          }}
        >
          Clear data
        </Button>
      </div>
      {clear.isSuccess && <p className="mt-2 text-sm text-[var(--accent-green)]">The data was cleared.</p>}
      {clear.isError && <p className="mt-2 text-sm text-[var(--accent-red)]">Only the company owner can clear the data.</p>}
    </>
  )
}
