import { Shield } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function AuditPage() {
  return (<><PageHeader title="Audit Log" subtitle="Security and change history" /><EmptyState icon={<Shield size={28} />} title="Coming soon — Audit Log" description="System changes, logins, and permission events will appear here." /></>)
}
