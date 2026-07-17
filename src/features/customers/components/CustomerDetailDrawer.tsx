import { CreditCard, Mail, MapPin, Phone, UserPlus } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Button } from '@/shared/components/Button'
import { StatusPill } from '@/shared/components/StatusPill/StatusPill'
import { formatMoney, isOverLimit, type AdminCustomer } from '../types'

interface Props {
  customer: AdminCustomer | null
  onClose: () => void
  canEdit: boolean
  onAssign: (customer: AdminCustomer) => void
  onSetLimit: (customer: AdminCustomer) => void
}

/** Read panel for one customer: identity, contact, credit picture and the
 *  salesman assignment, with the two part-1 actions in the footer. */
export function CustomerDetailDrawer({ customer, onClose, canEdit, onAssign, onSetLimit }: Props) {
  const over = customer ? isOverLimit(customer) : false
  const hasDue = (customer?.balance ?? 0) > 0
  const utilization =
    customer && customer.credit_limit && customer.credit_limit > 0
      ? Math.min(customer.balance / customer.credit_limit, 1)
      : null

  return (
    <SideDrawer
      open={!!customer}
      onClose={onClose}
      title="Customer"
      width="w-[460px]"
      footer={
        canEdit && customer ? (
          <>
            <Button
              variant="outline"
              icon={<CreditCard size={15} />}
              onClick={() => onSetLimit(customer)}
            >
              Set credit limit
            </Button>
            <Button icon={<UserPlus size={15} />} onClick={() => onAssign(customer)}>
              Assign salesman
            </Button>
          </>
        ) : undefined
      }
    >
      {customer && (
        <div className="flex flex-col gap-6">
          {/* Identity */}
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[var(--accent-primary)]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-base font-bold text-[var(--accent-primary)]">
                {customer.name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-[var(--text-primary)] font-heading truncate">
                {customer.name}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-mono text-[var(--text-muted)]">{customer.code}</span>
                <StatusPill
                  status={over ? 'error' : hasDue ? 'warning' : 'active'}
                  label={over ? 'Over limit' : hasDue ? 'Has due' : 'Clear'}
                />
              </div>
            </div>
          </div>

          {/* Credit picture */}
          <div className="rounded-[var(--radius-card)] border border-[var(--border-default)] p-4 flex flex-col gap-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Balance
                </p>
                <p
                  className={[
                    'text-xl font-bold font-mono',
                    over
                      ? 'text-[var(--accent-red)]'
                      : hasDue
                        ? 'text-[var(--accent-amber)]'
                        : 'text-[var(--text-primary)]',
                  ].join(' ')}
                >
                  {formatMoney(customer.balance)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-1">
                  Credit limit
                </p>
                <p className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  {customer.credit_limit != null ? formatMoney(customer.credit_limit) : '—'}
                </p>
              </div>
            </div>
            {utilization !== null && (
              <div className="h-1.5 rounded-full bg-[var(--bg-surface-raised)] overflow-hidden">
                <div
                  className={[
                    'h-full rounded-full transition-all',
                    over
                      ? 'bg-[var(--accent-red)]'
                      : utilization > 0.75
                        ? 'bg-[var(--accent-amber)]'
                        : 'bg-[var(--accent-green)]',
                  ].join(' ')}
                  style={{ width: `${Math.round(utilization * 100)}%` }}
                />
              </div>
            )}
          </div>

          {/* Assignment */}
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Assigned salesman
            </p>
            {customer.salesman_name ? (
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-[var(--bg-surface-raised)] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-[var(--text-muted)]">
                    {customer.salesman_name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  {customer.salesman_name}
                </div>
              </div>
            ) : (
              <StatusPill status="inactive" label="Unassigned" />
            )}
          </div>

          {/* Contact */}
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-2">
              Contact
            </p>
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
                <MapPin size={14} className="text-[var(--text-muted)] flex-shrink-0" />
                {customer.address || '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </SideDrawer>
  )
}
