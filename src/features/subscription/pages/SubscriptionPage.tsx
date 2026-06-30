import { CreditCard } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function SubscriptionPage() {
  return (<><PageHeader title="Subscription" subtitle="Billing and plan management" /><EmptyState icon={<CreditCard size={28} />} title="Coming soon — Subscription" description="Plan details, usage, and billing history will appear here." /></>)
}
