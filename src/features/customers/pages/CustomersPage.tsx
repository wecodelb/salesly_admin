import { Building2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function CustomersPage() {
  return (<><PageHeader title="Customers" subtitle="Customer accounts" /><EmptyState icon={<Building2 size={28} />} title="Coming soon — Customers" description="Customer profiles, credit limits, and history will appear here." /></>)
}
