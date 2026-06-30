import { Package } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function ProductsPage() {
  return (<><PageHeader title="Products" subtitle="Product catalog" /><EmptyState icon={<Package size={28} />} title="Coming soon — Products" description="Product listings, SKUs, and inventory will appear here." /></>)
}
