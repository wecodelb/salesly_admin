import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import type { AssignableRole } from './types'

// Human-readable grouping of every permission key for the create/edit UI. The
// key strings themselves are the single source of truth in
// core/auth/permissions.ts (which mirrors the backend App\Support\Permissions).
//
// Every key has to appear in a group: the matrix can only toggle what it
// renders, so one left out here is one nobody can grant — customers.delete and
// customers.verify sat outside it for a while, which is why
// permission-catalog.test.ts now asserts the two lists match.
export interface PermissionGroup {
  label: string
  items: { key: Permission; label: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Customers',
    items: [
      { key: PERMISSIONS.CUSTOMERS_VIEW, label: 'View customers' },
      { key: PERMISSIONS.CUSTOMERS_CREATE, label: 'Create customers' },
      { key: PERMISSIONS.CUSTOMERS_EDIT, label: 'Edit customers' },
      { key: PERMISSIONS.CUSTOMERS_DELETE, label: 'Remove customers' },
      { key: PERMISSIONS.CUSTOMERS_VERIFY, label: 'Verify customers' },
    ],
  },
  {
    label: 'Orders',
    items: [
      { key: PERMISSIONS.ORDERS_VIEW, label: 'View orders' },
      { key: PERMISSIONS.ORDERS_CREATE, label: 'Create orders' },
      { key: PERMISSIONS.ORDERS_CONFIRM, label: 'Confirm orders' },
    ],
  },
  {
    label: 'Invoices',
    items: [
      { key: PERMISSIONS.INVOICES_VIEW, label: 'View invoices' },
      { key: PERMISSIONS.INVOICES_SEND, label: 'Send invoices' },
    ],
  },
  {
    label: 'Collections',
    items: [
      { key: PERMISSIONS.COLLECTIONS_VIEW, label: 'View collections' },
      { key: PERMISSIONS.COLLECTIONS_COLLECT, label: 'Collect payments' },
    ],
  },
  {
    label: 'Returns',
    items: [
      { key: PERMISSIONS.RETURNS_VIEW, label: 'View returns' },
      { key: PERMISSIONS.RETURNS_CREATE, label: 'Create returns' },
    ],
  },
  {
    label: 'Route',
    items: [
      { key: PERMISSIONS.ROUTE_VIEW, label: 'View route' },
      { key: PERMISSIONS.ROUTE_OPTIMIZE, label: 'Optimize route' },
    ],
  },
  {
    label: 'Visits & Tasks',
    items: [
      { key: PERMISSIONS.VISITS_CHECKIN, label: 'Check in to visits' },
      { key: PERMISSIONS.TASKS_VIEW, label: 'View tasks' },
      { key: PERMISSIONS.TASKS_COMPLETE, label: 'Complete tasks' },
    ],
  },
  {
    label: 'Calendar',
    items: [
      { key: PERMISSIONS.CALENDAR_VIEW, label: 'View calendar' },
      { key: PERMISSIONS.CALENDAR_PLAN, label: 'Plan calendar' },
    ],
  },
  {
    // Its own group rather than sitting under Insights: this key now gates the
    // whole catalog — the Products screen and the Categories, Brands and Units
    // screens that feed it — not a report.
    label: 'Catalog',
    items: [
      { key: PERMISSIONS.PRODUCTS_VIEW, label: 'View products, categories, brands & units' },
    ],
  },
  {
    // The four halves of a depot movement, split the way the business splits
    // them: the salesman asks and signs, the warehouse decides and loads.
    label: 'Depot',
    items: [
      { key: PERMISSIONS.DEPOT_VIEW, label: 'View depot loads & stock' },
      { key: PERMISSIONS.DEPOT_REQUEST, label: 'Request a load' },
      { key: PERMISSIONS.DEPOT_ISSUE, label: 'Load a depot & answer load requests' },
      { key: PERMISSIONS.DEPOT_ACCEPT, label: 'Accept a load that arrived' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { key: PERMISSIONS.REPORTS_VIEW, label: 'View reports' },
      { key: PERMISSIONS.LEADERBOARD_VIEW, label: 'View leaderboard' },
    ],
  },
  {
    label: 'Preferences',
    items: [
      {
        key: PERMISSIONS.PREFERENCES_MANAGE,
        label: 'Edit categories, brands, units, areas & customer groups',
      },
      { key: PERMISSIONS.EXCHANGE_RATES_VIEW, label: 'View currencies & exchange rates' },
      { key: PERMISSIONS.EXCHANGE_RATES_MANAGE, label: 'Edit currencies & exchange rates' },
    ],
  },
  {
    label: 'Users',
    items: [
      { key: PERMISSIONS.USERS_VIEW, label: 'View users' },
      { key: PERMISSIONS.USERS_EDIT, label: 'Create & edit users' },
      { key: PERMISSIONS.USERS_REMOVE, label: 'Remove users' },
    ],
  },
]

// Every permission key, flat. Used for the admin/manager "grant everything" preset.
const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[]

// Permissions a salesman never gets by default — company-wide visibility
// (reports) and the ability to manage other users' accounts.
const SALESMAN_EXCLUDED: Permission[] = [
  PERMISSIONS.REPORTS_VIEW,
  PERMISSIONS.USERS_VIEW,
  PERMISSIONS.USERS_EDIT,
  PERMISSIONS.USERS_REMOVE,
  // Reference data is shared across the whole company — a salesman reads it
  // through the product/customer forms but shouldn't be able to reshape it.
  PERMISSIONS.PREFERENCES_MANAGE,
  // Removing a customer and approving one are both decisions about the
  // company's book rather than about a salesman's own round: he may add and
  // edit, and someone with the key signs the result off.
  PERMISSIONS.CUSTOMERS_DELETE,
  PERMISSIONS.CUSTOMERS_VERIFY,
  // What a dollar is worth is a company-wide figure every price in the app
  // reads from. A salesman quotes it; he does not set it.
  PERMISSIONS.EXCHANGE_RATES_VIEW,
  PERMISSIONS.EXCHANGE_RATES_MANAGE,
  // He may ask for a load and sign for what turns up; deciding what leaves
  // the warehouse is the warehouse's call. Sending his own unsold stock back
  // still works without it — being assigned to the depot is the authority there.
  PERMISSIONS.DEPOT_ISSUE,
]

// Client-side mirror of the backend App\Support\Permissions::DEFAULTS_BY_ROLE.
// Picking a role in the form pre-fills these; the admin can still toggle
// individual permissions afterward before saving.
export const ROLE_PRESETS: Record<AssignableRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS,
  salesman: ALL_PERMISSIONS.filter((p) => !SALESMAN_EXCLUDED.includes(p)),
}

export const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'salesman', label: 'Salesman' },
]
