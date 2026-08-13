import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { SideDrawer } from '@/shared/components/SideDrawer/SideDrawer'
import { Input } from '@/shared/components/Input'
import { PhoneInput } from '@/shared/components/PhoneInput/PhoneInput'
import { Select } from '@/shared/components/Select'
import { SearchableSelect } from '@/shared/components/SearchableSelect/SearchableSelect'
import { Button } from '@/shared/components/Button'
import { useToast } from '@/shared/hooks/use-toast'
import { useActionProgress } from '@/shared/hooks/use-action-progress'
import { reportInvalidForm } from '@/shared/lib/report-invalid-form'
import { apiErrorMessage } from '@/features/users/hooks/use-users'
import { useAreas } from '@/features/areas/hooks/use-areas'
import { useCustomerGroups } from '@/features/customer-groups/hooks/use-customer-groups'
import { useCurrencies } from '@/features/currencies/hooks/use-currencies'
import { usePriceLists } from '@/features/price-lists/hooks/use-price-lists'
import {
  useAssignPriceList,
  useCreateCustomer,
  useCustomer,
  useDeleteAttachment,
  useSalesmen,
  useUpdateCustomer,
  useUploadAttachments,
} from '../hooks/use-customers'
import { AttachmentsField } from './AttachmentsField'
import {
  DEFAULT_PRICE_LEVEL,
  MAX_ATTACHMENT_BYTES,
  PRICE_LEVEL_OPTIONS,
  formatBytes,
  type AdminCustomer,
  type CreateCustomerPayload,
  type CustomerAddress,
  type PriceLevel,
  type UpdateCustomerPayload,
} from '../types'

interface Props {
  open: boolean
  onClose: () => void
  customer?: AdminCustomer | null // null/undefined = create mode
}

interface AddressRow {
  label: string
  address: string
  /** Each place sits in its own territory; the primary one is mirrored onto
   *  the customer by the backend. */
  areaId: string
  latitude: string
  longitude: string
  isPrimary: boolean
}

interface FormState {
  code: string
  name: string
  groupId: string
  salesmanId: string
  priceLevel: PriceLevel
  priceListId: string
  currencyId: string
  /** Whether this customer may take goods without paying. Cleared makes them a
   *  cash-only shop: the limit below disappears, and the salesman's phone stops
   *  offering "On account" at all. */
  allowCredit: boolean
  creditLimit: string
  phone1: string
  phone2: string
  email: string
  addresses: AddressRow[]
}

const blankAddress = (): AddressRow => ({
  label: '',
  address: '',
  areaId: '',
  latitude: '',
  longitude: '',
  isPrimary: false,
})

const EMPTY: FormState = {
  code: '',
  name: '',
  groupId: '',
  salesmanId: '',
  priceLevel: DEFAULT_PRICE_LEVEL,
  priceListId: '',
  currencyId: '',
  // Most trade customers get credit; the box is there to say which ones don't.
  allowCredit: true,
  creditLimit: '',
  phone1: '',
  phone2: '',
  email: '',
  addresses: [],
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const toRows = (addresses: CustomerAddress[]): AddressRow[] =>
  addresses.length === 0
    ? [blankAddress()]
    : addresses.map((a) => ({
        label: a.label ?? '',
        address: a.address,
        areaId: a.area_id != null ? String(a.area_id) : '',
        latitude: a.latitude != null ? String(a.latitude) : '',
        longitude: a.longitude != null ? String(a.longitude) : '',
        isPrimary: a.is_primary,
      }))

// Section headings, extracted so the two-column rows stay readable.
const HEADING = 'text-sm font-semibold tracking-wide text-[var(--heading-accent)]'
const HEADING_GLOW = { textShadow: '0 0 14px var(--heading-glow)' }

/** A row the user never touched isn't an address — it's the blank the repeater
 *  starts with, so it drops out instead of failing validation. */
const isFilled = (r: AddressRow) =>
  !!(r.label.trim() || r.address.trim() || r.areaId || r.latitude.trim() || r.longitude.trim())

export function CustomerFormDrawer({ open, onClose, customer }: Props) {
  const isEdit = !!customer
  const toast = useToast()
  const { run } = useActionProgress()
  const { data: areas = [] } = useAreas()
  const { data: customerGroups = [] } = useCustomerGroups()
  const { data: currencies = [] } = useCurrencies()
  const { data: priceLists = [] } = usePriceLists()
  const { data: salesmen = [] } = useSalesmen()
  // The list resource is thin; addresses and attachments come from the detail.
  const { data: detail } = useCustomer(open && customer ? customer.id : null)
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const uploadAttachments = useUploadAttachments()
  const deleteAttachment = useDeleteAttachment()
  const assignPriceList = useAssignPriceList()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [files, setFiles] = useState<File[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  /** Which list the server already has, so edit only re-assigns on a change. */
  const [savedPriceListId, setSavedPriceListId] = useState('')
  /** Guards the detail seed: it must run once, or a refetch (an attachment
   *  delete invalidates the query) would wipe addresses typed since. */
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (!open) return
    if (customer) {
      const listId = customer.price_lists?.[0] ? String(customer.price_lists[0].id) : ''
      setForm({
        code: customer.code,
        name: customer.name,
        groupId: customer.customer_group_id != null ? String(customer.customer_group_id) : '',
        salesmanId: customer.salesman_id != null ? String(customer.salesman_id) : '',
        priceLevel: customer.price_level ?? DEFAULT_PRICE_LEVEL,
        priceListId: listId,
        currencyId: customer.currency_id != null ? String(customer.currency_id) : '',
        // Absent on a row written before the column existed, and those customers
        // have credit — the same default the API resource reports.
        allowCredit: customer.allow_credit ?? true,
        creditLimit: customer.credit_limit != null ? String(customer.credit_limit) : '',
        phone1: customer.phone1 ?? '',
        phone2: customer.phone2 ?? '',
        email: customer.email ?? '',
        addresses: customer.addresses ? toRows(customer.addresses) : [],
      })
      setSavedPriceListId(listId)
      setSeeded(!!customer.addresses)
    } else {
      setForm({ ...EMPTY, addresses: [blankAddress()] })
      setSavedPriceListId('')
      setSeeded(true)
    }
    setFiles([])
    setErrors({})
  }, [open, customer])

  useEffect(() => {
    if (!open || seeded || !detail?.addresses) return
    const listId = detail.price_lists?.[0] ? String(detail.price_lists[0].id) : ''
    setForm((f) => ({
      ...f,
      addresses: toRows(detail.addresses ?? []),
      priceListId: f.priceListId || listId,
    }))
    setSavedPriceListId(listId)
    setSeeded(true)
  }, [open, seeded, detail])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: val }))

  const addAddress = () => set('addresses', [...form.addresses, blankAddress()])
  const removeAddress = (i: number) =>
    set('addresses', form.addresses.filter((_, idx) => idx !== i))
  const setAddress = (i: number, key: keyof AddressRow, val: string) =>
    set('addresses', form.addresses.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)))
  // Radio semantics: marking one primary takes the flag off the others.
  const setPrimary = (i: number) =>
    set('addresses', form.addresses.map((r, idx) => ({ ...r, isPrimary: idx === i })))

  const markedPrimary = form.addresses.findIndex((r) => r.isPrimary)
  // Nothing marked? The backend promotes the first row, so show that here too.
  const effectivePrimary = markedPrimary === -1 ? 0 : markedPrimary

  const existingAttachments = detail?.attachments ?? customer?.attachments ?? []
  const usedBytes =
    existingAttachments.reduce((sum, a) => sum + a.size_bytes, 0) +
    files.reduce((sum, f) => sum + f.size, 0)

  const validate = (): boolean => {
    const e: Record<string, string> = {}
    // Editable on edit too — the backend allows changing it — but never blank.
    if (!form.code.trim()) e.code = 'Code is required'
    if (!form.name.trim()) e.name = 'Name is required'
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email'

    // Keyed on the rendered index, so the message lands on the row it came from.
    form.addresses.forEach((row, i) => {
      if (!isFilled(row)) return
      if (!row.address.trim()) e[`addr-${i}-address`] = 'Address is required'
      const lat = Number(row.latitude)
      if (row.latitude.trim() && (Number.isNaN(lat) || lat < -90 || lat > 90))
        e[`addr-${i}-lat`] = 'Between -90 and 90'
      const lng = Number(row.longitude)
      if (row.longitude.trim() && (Number.isNaN(lng) || lng < -180 || lng > 180))
        e[`addr-${i}-lng`] = 'Between -180 and 180'
    })

    // Only worth checking while the field is on screen — a stale number behind a
    // cleared checkbox is discarded on submit, not complained about.
    if (
      form.allowCredit &&
      form.creditLimit.trim() &&
      (Number.isNaN(Number(form.creditLimit)) || Number(form.creditLimit) < 0)
    )
      e.creditLimit = 'Must be zero or more'

    // AttachmentsField already spells this out inline; the key just blocks
    // submit, so the upload isn't attempted only to come back a 422.
    if (usedBytes > MAX_ATTACHMENT_BYTES) {
      e.attachments = `Attachments come to ${formatBytes(usedBytes)} — the cap is ${formatBytes(MAX_ATTACHMENT_BYTES)} per customer.`
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const buildAddresses = (): Omit<CustomerAddress, 'id'>[] => {
    const filled = form.addresses.filter(isFilled)
    // Exactly one row may be primary — the marked one, else the first. Sending
    // every row as primary would break the invariant the backend relies on to
    // mirror an address onto the flat customer columns.
    const marked = filled.findIndex((r) => r.isPrimary)
    const primary = marked === -1 ? 0 : marked

    return filled.map((r, i) => ({
      label: r.label.trim() || null,
      address: r.address.trim(),
      area_id: r.areaId === '' ? null : Number(r.areaId),
      latitude: r.latitude.trim() === '' ? null : Number(r.latitude),
      longitude: r.longitude.trim() === '' ? null : Number(r.longitude),
      is_primary: i === primary,
    }))
  }

  const removeExistingAttachment = async (attachmentId: number) => {
    if (!customer) return
    await run({ label: 'Removing attachment', success: 'Attachment removed.' }, () =>
      deleteAttachment.mutateAsync({ customerId: customer.id, attachmentId }),
    )
  }

  const handleSubmit = async () => {
    // A silent early return here is indistinguishable from a broken button when
    // the offending field has scrolled out of the panel, so say it out loud and
    // jump to it.
    if (!validate()) {
      reportInvalidForm()
      return
    }

    const base = {
      code: form.code.trim(),
      name: form.name.trim(),
      phone1: form.phone1.trim(),
      phone2: form.phone2.trim(),
      email: form.email.trim(),
      customer_group_id: form.groupId === '' ? null : Number(form.groupId),
      currency_id: form.currencyId === '' ? null : Number(form.currencyId),
      price_level: form.priceLevel,
      salesman_id: form.salesmanId === '' ? null : Number(form.salesmanId),
      allow_credit: form.allowCredit,
      // Nulled outright for a cash-only customer rather than left as typed: a
      // limit nobody can draw against would come back into force the day credit
      // is switched on again.
      credit_limit:
        !form.allowCredit || form.creditLimit.trim() === '' ? null : Number(form.creditLimit),
    }
    // `addresses` replaces the whole set, so it only goes out once this drawer
    // actually knows what the set is — omitting it leaves the server's alone.
    const payload = seeded ? { ...base, addresses: buildAddresses() } : base
    const name = form.name.trim()

    // The progress dialog covers the whole save, including the follow-up
    // requests below — from the user's side this is one action, however many
    // round trips it takes.
    const saved = await run(
      {
        label: isEdit ? 'Saving customer' : 'Creating customer',
        detail: name,
        success: `${name} has been saved.`,
      },
      async () => {
        let customerId: number
        if (isEdit && customer) {
          await updateCustomer.mutateAsync({
            id: customer.id,
            payload: payload as UpdateCustomerPayload,
          })
          customerId = customer.id
        } else {
          const created = await createCustomer.mutateAsync(payload as CreateCustomerPayload)
          customerId = created.id
        }

        // Attachments and the price list follow a save that has already gone
        // through, so their failures are warnings on the side rather than a
        // failed action — the customer really is saved either way.
        if (files.length > 0) {
          try {
            await uploadAttachments.mutateAsync({ customerId, files })
          } catch (uploadErr) {
            toast.warning(
              'Attachments not uploaded',
              `${name} was saved, but the files could not be attached: ${apiErrorMessage(uploadErr)}`,
            )
          }
        }

        if (form.priceListId && form.priceListId !== savedPriceListId) {
          try {
            await assignPriceList.mutateAsync({
              customerId,
              priceListId: Number(form.priceListId),
            })
          } catch (listErr) {
            toast.warning(
              'Price list not assigned',
              `${name} was saved, but the price list could not be attached: ${apiErrorMessage(listErr)}`,
            )
          }
        }

        return customerId
      },
    )

    if (saved !== null) onClose()
  }

  const saving =
    createCustomer.isPending ||
    updateCustomer.isPending ||
    uploadAttachments.isPending ||
    assignPriceList.isPending

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit customer' : 'New customer'}
      width="w-[70%]"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Two sections per row on a wide drawer, stacked on a narrow one. The
            divider is the brand accent rather than the usual grey — it separates
            two peers here, where a border-default line reads as "end of form". */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-0">
          <section className="flex flex-col gap-4 lg:pr-8">
            <h3 className={HEADING} style={HEADING_GLOW}>
              General
            </h3>
            <div className="flex gap-3">
              <div className="w-40">
                <Input
                  label="Code"
                  value={form.code}
                  onChange={(e) => set('code', e.target.value)}
                  error={errors.code}
                  placeholder="CUST-001"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Name"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                  error={errors.name}
                  placeholder="Hanna Supermarket"
                />
              </div>
            </div>
            {/* Who the customer is to the business, and who works them —
                the two questions asked together, so they sit together. The
                group list is maintained under Preferences > Customer groups
                and comes out in the order set there. */}
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  label="Customer group (optional)"
                  value={form.groupId}
                  onChange={(v) => set('groupId', v)}
                  options={customerGroups.map((g) => ({ value: String(g.id), label: g.name }))}
                  placeholder="No group"
                  searchPlaceholder="Search groups…"
                />
              </div>
              <div className="flex-1 min-w-0">
                <Select
                  label="Salesman"
                  value={form.salesmanId}
                  onChange={(e) => set('salesmanId', e.target.value)}
                  placeholder="Unassigned"
                  options={salesmen.map((s) => ({ value: String(s.id), label: s.name }))}
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4 lg:pl-8 lg:border-l lg:border-[var(--accent-primary)]/30">
            <h3 className={HEADING} style={HEADING_GLOW}>
              Financial
            </h3>
            {/* The two ways a price is decided, side by side: the tier every
                product is read at, and the list that overrides individual
                products on top of it. Each keeps its own note underneath. */}
            <div className="flex gap-3">
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <Select
                  label="Price level"
                  value={form.priceLevel}
                  onChange={(e) => set('priceLevel', e.target.value as PriceLevel)}
                  options={PRICE_LEVEL_OPTIONS}
                />
                <p className="text-xs text-[var(--text-muted)]">
                  Which of a product's three prices this customer pays.
                </p>
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <SearchableSelect
                  label="Price list (optional)"
                  value={form.priceListId}
                  onChange={(v) => set('priceListId', v)}
                  options={priceLists.map((l) => ({
                    value: String(l.id),
                    label: l.is_default ? `${l.name} (default)` : l.name,
                  }))}
                  placeholder="Company default list"
                  searchPlaceholder="Search price lists…"
                />
                <p className="text-xs text-[var(--text-muted)]">
                  Overrides individual products, on top of the company default.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  label="Currency (optional)"
                  value={form.currencyId}
                  onChange={(v) => set('currencyId', v)}
                  options={currencies.map((c) => ({
                    value: String(c.id),
                    label: c.is_base ? `${c.name} (${c.code}) — base` : `${c.name} (${c.code})`,
                  }))}
                  placeholder="Company base currency"
                  searchPlaceholder="Search currencies…"
                />
              </div>
              {/* The limit only exists for a customer who has credit at all, so
                  the field appears with the box rather than sitting there greyed
                  out inviting a number nobody will honour. */}
              <div className="flex-1 min-w-0">
                {form.allowCredit ? (
                  <Input
                    label="Credit limit (optional)"
                    type="number"
                    min={0}
                    step="any"
                    value={form.creditLimit}
                    onChange={(e) => set('creditLimit', e.target.value)}
                    error={errors.creditLimit}
                    placeholder="No cap"
                  />
                ) : null}
              </div>
            </div>

            <label className="inline-flex items-start gap-2 cursor-pointer">
              {/* Labelled explicitly rather than by the wrapper, whose text runs
                  on into the explanation underneath. */}
              <input
                type="checkbox"
                aria-label="Allow credit"
                checked={form.allowCredit}
                onChange={(e) => set('allowCredit', e.target.checked)}
                className="mt-0.5 accent-[var(--accent-primary)] cursor-pointer"
              />
              <span className="text-sm text-[var(--text-primary)]">
                Allow credit
                <span className="block text-xs text-[var(--text-muted)]">
                  {form.allowCredit
                    ? 'Invoices may be left partly or wholly unpaid, up to the limit.'
                    : 'Cash only — every invoice must be settled in full at the door.'}
                </span>
              </span>
            </label>
          </section>
        </div>

        {/* Two sections per row again, but split one-to-two rather than evenly:
            contact is three short fields where an address is a repeater six
            fields wide. An even split would starve the rows while leaving half
            the phone column empty. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0 border-t border-[var(--border-default)] pt-6">
          <section className="flex flex-col gap-4 lg:col-span-1 lg:pr-8">
            <h3 className={HEADING} style={HEADING_GLOW}>
              Contact
            </h3>
            {/* One under the other: at a third of the drawer, three abreast
                leaves a phone field too narrow to show a dialling code and a
                number at the same time. */}
            <PhoneInput
              label="Phone 1 (optional)"
              value={form.phone1}
              onChange={(v) => set('phone1', v)}
              placeholder="3 123 456"
            />
            <PhoneInput
              label="Phone 2 (optional)"
              value={form.phone2}
              onChange={(v) => set('phone2', v)}
              placeholder="1 987 654"
            />
            <Input
              label="Email (optional)"
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              error={errors.email}
              placeholder="orders@shop.com"
            />
          </section>

          <section className="flex flex-col gap-3 lg:col-span-2 lg:pl-8 lg:border-l lg:border-[var(--accent-primary)]/30">
            <div className="flex items-center justify-between">
              <h3 className={HEADING} style={HEADING_GLOW}>
                Addresses
              </h3>
              <button
                type="button"
                onClick={addAddress}
                className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <Plus size={13} /> Add address
              </button>
            </div>

            {/* The territory belongs with the addresses: it is where the
                customer sits, and it is what route planning and coverage
                reporting are built on. */}
            <p className="text-xs text-[var(--text-muted)]">
              Each place carries its own area, since a shop and its warehouse aren't always in the
              same territory. The primary address is the one shown on the customer card and used
              for the map pin — and its area is the one the customer counts under. Leave the choice
              alone and the first address is used.
            </p>

            {form.addresses.length === 0 && (
              <p className="text-sm text-[var(--text-muted)]">
                No addresses yet — add one so the salesman can find this customer.
              </p>
            )}

            {form.addresses.map((row, i) => (
              <div
                key={i}
                className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-subtle)] p-3"
              >
                {/* What the place is called and where it is in words, with the
                    two controls that act on the whole row beside it. Every
                    child is free to shrink so a long value can't push the card
                    past its column; the street line keeps a floor and takes the
                    wrap when there's no room left for the group. */}
                <div className="flex flex-wrap items-end gap-3">
                  <div className="w-32 shrink-0">
                    <Input
                      label={i === 0 ? 'Label' : undefined}
                      value={row.label}
                      onChange={(e) => setAddress(i, 'label', e.target.value)}
                      placeholder="Shop"
                    />
                  </div>
                  <div className="flex-1 min-w-[11rem]">
                    <Input
                      label={i === 0 ? 'Address' : undefined}
                      value={row.address}
                      onChange={(e) => setAddress(i, 'address', e.target.value)}
                      error={errors[`addr-${i}-address`]}
                      placeholder="Street, building, floor"
                    />
                  </div>
                  {/* Kept as one group so the radio and the bin wrap together —
                      apart, either one reads as belonging to a different row. */}
                  <div className="ml-auto mb-1 flex shrink-0 items-center gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-[var(--text-primary)] cursor-pointer whitespace-nowrap">
                      <input
                        type="radio"
                        name="primary-address"
                        checked={i === effectivePrimary}
                        onChange={() => setPrimary(i)}
                        className="accent-[var(--accent-primary)] cursor-pointer"
                      />
                      Primary
                      {markedPrimary === -1 && i === 0 && (
                        <span className="text-xs text-[var(--text-muted)]">(default)</span>
                      )}
                    </label>
                    <button
                      type="button"
                      title="Remove address"
                      onClick={() => removeAddress(i)}
                      className="p-2 rounded-[var(--radius-btn)] text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--bg-surface-raised)] transition-colors cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {/* Where the place is on a map — the territory it answers to and
                    the pin itself — on a line of their own, three even columns
                    rather than a wide select crowding the street line. */}
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <SearchableSelect
                      label={i === 0 ? 'Area' : undefined}
                      value={row.areaId}
                      onChange={(v) => setAddress(i, 'areaId', v)}
                      options={areas.map((a) => ({
                        value: String(a.id),
                        label: `${a.name} (${a.code})`,
                      }))}
                      placeholder="No area"
                      searchPlaceholder="Search areas…"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      label={i === 0 ? 'Latitude' : undefined}
                      type="number"
                      step="any"
                      value={row.latitude}
                      onChange={(e) => setAddress(i, 'latitude', e.target.value)}
                      error={errors[`addr-${i}-lat`]}
                      placeholder="33.8938"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input
                      label={i === 0 ? 'Longitude' : undefined}
                      type="number"
                      step="any"
                      value={row.longitude}
                      onChange={(e) => setAddress(i, 'longitude', e.target.value)}
                      error={errors[`addr-${i}-lng`]}
                      placeholder="35.5018"
                    />
                  </div>
                </div>
              </div>
            ))}
          </section>
        </div>

        <section className="flex flex-col gap-3 border-t border-[var(--border-default)] pt-6">
          <h3 className={HEADING} style={HEADING_GLOW}>
            Attachments
          </h3>
          <AttachmentsField
            existing={existingAttachments}
            onExistingRemove={removeExistingAttachment}
            files={files}
            onFilesChange={setFiles}
            disabled={saving || deleteAttachment.isPending}
          />
          {!isEdit && files.length > 0 && (
            <p className="text-xs text-[var(--text-muted)]">
              These upload once the customer exists — right after it is created.
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            {formatBytes(MAX_ATTACHMENT_BYTES)} in total per customer, across every file.
          </p>
        </section>
      </div>
    </SideDrawer>
  )
}
