import { CheckSquare } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function TasksPage() {
  return (<><PageHeader title="Tasks" subtitle="Team task management" /><EmptyState icon={<CheckSquare size={28} />} title="Coming soon — Tasks" description="Task assignment, completion tracking, and priorities will appear here." /></>)
}
