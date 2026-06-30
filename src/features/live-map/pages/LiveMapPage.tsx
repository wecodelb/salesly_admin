import { Map } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function LiveMapPage() {
  return (<><PageHeader title="Live Map" subtitle="Real-time salesman locations" /><EmptyState icon={<Map size={28} />} title="Coming soon — Live Map" description="Real-time GPS tracking map will appear here." /></>)
}
