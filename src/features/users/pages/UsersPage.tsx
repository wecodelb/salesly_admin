import { UserCog } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function UsersPage() {
  return (<><PageHeader title="Users" subtitle="Admin user management" /><EmptyState icon={<UserCog size={28} />} title="Coming soon — Users" description="User accounts, roles, and permissions will appear here." /></>)
}
