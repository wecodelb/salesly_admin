import { Key } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function ApiKeysPage() {
  return (<><PageHeader title="API Keys" subtitle="Developer access tokens" /><EmptyState icon={<Key size={28} />} title="Coming soon — API Keys" description="API key generation, scopes, and revocation will appear here." /></>)
}
