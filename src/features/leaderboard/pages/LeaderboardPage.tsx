import { Trophy } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function LeaderboardPage() {
  return (<><PageHeader title="Leaderboard" subtitle="Sales performance rankings" /><EmptyState icon={<Trophy size={28} />} title="Coming soon — Leaderboard" description="Team rankings, points, and achievements will appear here." /></>)
}
