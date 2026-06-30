import { BarChart2 } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function ReportsPage() {
  return (<><PageHeader title="Reports" subtitle="Business intelligence" /><EmptyState icon={<BarChart2 size={28} />} title="Coming soon — Reports" description="Sales reports, exports, and analytics charts will appear here." /></>)
}
