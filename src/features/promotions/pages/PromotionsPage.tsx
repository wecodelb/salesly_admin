import { Percent } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function PromotionsPage() {
  return (<><PageHeader title="Promotions" subtitle="Deals and discount campaigns" /><EmptyState icon={<Percent size={28} />} title="Coming soon — Promotions" description="Promotion rules, eligibility, and campaign management will appear here." /></>)
}
