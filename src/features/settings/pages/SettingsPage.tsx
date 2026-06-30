import { Settings } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function SettingsPage() {
  return (<><PageHeader title="Settings" subtitle="Company configuration" /><EmptyState icon={<Settings size={28} />} title="Coming soon — Settings" description="Company info, integrations, and preferences will appear here." /></>)
}
