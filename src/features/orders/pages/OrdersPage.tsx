import { ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function OrdersPage() {
  return (<><PageHeader title="Orders" subtitle="Manage customer orders" /><EmptyState icon={<ShoppingCart size={28} />} title="Coming soon — Orders" description="Order list, filtering, and order details will appear here." /></>)
}
