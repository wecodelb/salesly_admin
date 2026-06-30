import { LayoutDashboard } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your sales overview at a glance" />
      <EmptyState icon={<LayoutDashboard size={28} />} title="Coming soon — Dashboard" description="KPIs, charts and activity feeds will appear here." />
    </>
  )
}
