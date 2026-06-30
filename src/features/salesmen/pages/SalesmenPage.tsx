import { Users } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function SalesmenPage() {
  return (<><PageHeader title="Salesmen" subtitle="Sales team management" /><EmptyState icon={<Users size={28} />} title="Coming soon — Salesmen" description="Salesman profiles, performance, and territory management will appear here." /></>)
}
