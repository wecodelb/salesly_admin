import { FileText } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function InvoicesPage() {
  return (<><PageHeader title="Invoices" subtitle="Invoice management" /><EmptyState icon={<FileText size={28} />} title="Coming soon — Invoices" description="Invoice list, sending, and status tracking will appear here." /></>)
}
