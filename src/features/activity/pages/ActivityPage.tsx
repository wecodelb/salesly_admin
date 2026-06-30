import { Activity } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function ActivityPage() {
  return (<><PageHeader title="Activity" subtitle="Team activity feed" /><EmptyState icon={<Activity size={28} />} title="Coming soon — Activity" description="Team events and activity stream will appear here." /></>)
}
