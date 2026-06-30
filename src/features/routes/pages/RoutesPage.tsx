import { Route } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function RoutesPage() {
  return (<><PageHeader title="Routes" subtitle="Salesman route planning" /><EmptyState icon={<Route size={28} />} title="Coming soon — Routes" description="Route planning, optimization, and assignment will appear here." /></>)
}
