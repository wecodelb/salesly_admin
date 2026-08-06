import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  CreditCard,
  Mail,
  MapPin,
  Paperclip,
  Pencil,
  Phone,
  ShoppingCart,
  Store,
} from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { KpiCard } from '@/shared/components/KpiCard/KpiCard'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { EmptyState } from '@/shared/components/EmptyState/EmptyState'
import { ErrorState } from '@/shared/components/ErrorState/ErrorState'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import { usePermissions } from '@/core/auth/use-permissions'
import { PERMISSIONS } from '@/core/auth/permissions'
import { CustomerFormDrawer } from '../components/CustomerFormDrawer'
import { useCustomer } from '../hooks/use-customers'
import { formatBytes, formatMoney, isOverLimit } from '../types'

/**
 * One customer, on its own page rather than in the list's drawer — so it can
 * be linked to and reloaded directly. Order history is stubbed until the
 * transactions endpoint exists.
 */
export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { can } = usePermissions()
  const canEdit = can(PERMISSIONS.CUSTOMERS_EDIT)

  const customerId = id ? Number(id) : null
  const { data: customer, isLoading, isError, refetch } = useCustomer(customerId)
  const [editing, setEditing] = useState(false)

  const back = (
    <Button variant="ghost" icon={<ArrowLeft size={15} />} onClick={() => navigate('/customers')}>
      Back
    </Button>
  )

  if (isLoading) return <LoadingSkeleton />

  if (isError || !customer) {
    return (
      <>
        <PageHeader title="Customer" actions={back} />
        <ErrorState
          title="Couldn't load this customer"
          message="They may have been removed, or the server didn't respond."
          onRetry={() => refetch()}
        />
      </>
    )
  }

  const over = isOverLimit(customer)
  const hasDue = customer.balance > 0
  const utilization =
    customer.credit_limit && customer.credit_limit > 0
      ? Math.min(customer.balance / customer.credit_limit, 1)
      : null

  return (
    <>
      <PageHeader
        title={customer.name}
        subtitle={`${customer.code}${customer.area_name ? ` · ${customer.area_name}` : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {back}
            {canEdit && (
              <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-6">
        {customer.is_verified ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--accent-primary)]">
            <BadgeCheck size={16} aria-label="Verified" />
            Verified
            {customer.verified_by_name ? (
              <span className="text-[var(--text-muted)]">by {customer.verified_by_name}</span>
            ) : null}
          </span>
        ) : (
          <StatusPill status="warning" label="Awaiting verification" />
        )}
        <StatusPill
          status={customer.is_active ? 'active' : 'inactive'}
          label={customer.is_active ? 'Active' : 'Dormant'}
        />
        {customer.currency_code && (
          <span className="text-xs text-[var(--text-muted)]">Billed in {customer.currency_code}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Balance"
          value={formatMoney(customer.balance)}
          icon={<CreditCard size={18} className="text-[var(--accent-primary)]" />}
        />
        <KpiCard
          title="Credit limit"
          value={customer.credit_limit != null ? formatMoney(customer.credit_limit) : 'No cap'}
          icon={<CreditCard size={18} className="text-[var(--text-muted)]" />}
        />
        <KpiCard
          title="Utilisation"
          value={utilization !== null ? `${Math.round(utilization * 100)}%` : '—'}
          icon={<CreditCard size={18} className="text-[var(--accent-amber)]" />}
          iconBg="bg-[var(--accent-amber)]/10"
        />
        <KpiCard
          title="Status"
          value={over ? 'Over limit' : hasDue ? 'Has due' : 'Clear'}
          icon={<Store size={18} className="text-[var(--accent-green)]" />}
          iconBg="bg-[var(--accent-green)]/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Contact
          </h3>
          <div className="flex flex-col gap-2.5 text-sm text-[var(--text-secondary)]">
            <span className="inline-flex items-center gap-2.5">
              <Phone size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              {customer.phone1 || '—'}
              {customer.phone2 ? ` · ${customer.phone2}` : ''}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <Mail size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              {customer.email || '—'}
            </span>
            <span className="inline-flex items-center gap-2.5">
              <Store size={14} className="text-[var(--text-muted)] flex-shrink-0" />
              {customer.salesman_name ?? 'Unassigned'}
            </span>
          </div>
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Addresses
          </h3>
          {customer.addresses && customer.addresses.length > 0 ? (
            <div className="flex flex-col gap-3">
              {customer.addresses.map((a, i) => (
                <div key={a.id ?? i} className="flex items-start gap-2.5 text-sm">
                  <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-[var(--text-primary)]">{a.address}</div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {a.label ?? 'Address'}
                      {a.is_primary ? ' · primary' : ''}
                      {a.latitude != null && a.longitude != null
                        ? ` · ${a.latitude}, ${a.longitude}`
                        : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              {customer.address || 'No address recorded.'}
            </p>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Attachments
          </h3>
          {customer.attachments && customer.attachments.length > 0 ? (
            <div className="flex flex-col gap-2">
              {customer.attachments.map((a) => (
                <a
                  key={a.id}
                  href={a.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 text-sm text-[var(--text-primary)] hover:text-[var(--accent-primary)] transition-colors"
                >
                  <Paperclip size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                  <span className="truncate">{a.name}</span>
                  <span className="text-xs text-[var(--text-muted)] flex-shrink-0">
                    {formatBytes(a.size_bytes)}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">Nothing attached yet.</p>
          )}
        </section>

        <section className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-5">
          <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
            Price lists
          </h3>
          {customer.price_lists && customer.price_lists.length > 0 ? (
            <div className="flex flex-col gap-2">
              {customer.price_lists.map((l) => (
                <div key={l.id} className="text-sm text-[var(--text-primary)]">
                  {l.name}
                  {l.is_default ? (
                    <span className="text-xs text-[var(--text-muted)]"> · company default</span>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--text-muted)]">
              None — the company's default list applies.
            </p>
          )}
        </section>
      </div>

      <section className="mt-6">
        <h3 className="text-sm font-semibold tracking-wide text-[var(--heading-accent)] mb-3" style={{ textShadow: '0 0 14px var(--heading-glow)' }}>
          Order history
        </h3>
        <EmptyState
          icon={<ShoppingCart size={28} />}
          title="Coming soon — order history"
          description="Orders, invoices and collections for this customer will appear here."
        />
      </section>

      <CustomerFormDrawer open={editing} onClose={() => setEditing(false)} customer={customer} />
    </>
  )
}
