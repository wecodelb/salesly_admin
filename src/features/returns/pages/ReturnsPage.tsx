import { RotateCcw } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function ReturnsPage() {
  return (<><PageHeader title="Returns" subtitle="Product return requests" /><EmptyState icon={<RotateCcw size={28} />} title="Coming soon — Returns" description="Return requests and approvals will appear here." /></>)
}
