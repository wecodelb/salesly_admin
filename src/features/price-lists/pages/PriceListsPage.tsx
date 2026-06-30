import { Tags } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function PriceListsPage() {
  return (<><PageHeader title="Price Lists" subtitle="Customer price tiers" /><EmptyState icon={<Tags size={28} />} title="Coming soon — Price Lists" description="Customer-specific pricing and tier management will appear here." /></>)
}
