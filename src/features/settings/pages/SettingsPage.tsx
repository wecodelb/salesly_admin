import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/core/api/client'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'

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
    </>
  )
}
