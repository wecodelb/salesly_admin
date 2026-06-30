import { MapPin } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function VisitsPage() {
  return (<><PageHeader title="Visits" subtitle="Customer visit history" /><EmptyState icon={<MapPin size={28} />} title="Coming soon — Visits" description="Check-ins, visit logs, and duration tracking will appear here." /></>)
}
