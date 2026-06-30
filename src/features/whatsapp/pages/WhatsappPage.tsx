import { MessageCircle } from 'lucide-react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
export function WhatsappPage() {
  return (<><PageHeader title="WhatsApp" subtitle="WhatsApp business integration" /><EmptyState icon={<MessageCircle size={28} />} title="Coming soon — WhatsApp" description="WhatsApp templates, bot configuration, and message logs will appear here." /></>)
}
