import { Banknote } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function CollectionsPage() {
  return (<><PageHeader title="Collections" subtitle="Payment collections" /><EmptyState icon={<Banknote size={28} />} title="Coming soon — Collections" description="Cash collection records and reconciliation will appear here." /></>)
}
