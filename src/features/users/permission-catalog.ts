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
    // Its own row because it is its own trust: seeing where every van is,
    // all day. Salesmen are not given it.
    label: 'Live Map',
    items: [
      { key: PERMISSIONS.LIVE_MAP_VIEW, label: 'Watch the field team on the live map' },
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
    // Approving is its own row because it is its own trust: writing a sheet
    // records a claim about the shelf, approving one moves the stock. Whoever
    // holds approve signs their own off on the way in.
    label: 'Adjustments',
    items: [
      { key: PERMISSIONS.ADJUSTMENTS_VIEW, label: 'View adjustments' },
      { key: PERMISSIONS.ADJUSTMENTS_CREATE, label: 'Write an adjustment' },
      { key: PERMISSIONS.ADJUSTMENTS_APPROVE, label: 'Approve adjustments (moves stock)' },
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

// What a salesman starts with: the same keys, in the same order, as the
// backend's App\Support\Permissions::DEFAULTS_BY_ROLE['salesman'].
//
// Written out rather than derived as "everything except…": that version handed
// every newly added permission to salesmen by default, and had drifted into the
// reverse of the server on two counts — it granted adjustments.create/approve
// (a salesman approving his own shortfall) and withheld exchange_rates.view,
// which the mobile collect screen reads. Everything left out is an office
// decision: reports, removing or verifying customers, loading a depot,
// reference data, setting rates, and managing users.
const SALESMAN_DEFAULTS: Permission[] = [
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CUSTOMERS_CREATE,
  PERMISSIONS.CUSTOMERS_EDIT,
  PERMISSIONS.ORDERS_VIEW,
  PERMISSIONS.ORDERS_CREATE,
  PERMISSIONS.ORDERS_CONFIRM,
  PERMISSIONS.INVOICES_VIEW,
  PERMISSIONS.INVOICES_SEND,
  PERMISSIONS.COLLECTIONS_VIEW,
  PERMISSIONS.COLLECTIONS_COLLECT,
  PERMISSIONS.RETURNS_VIEW,
  PERMISSIONS.RETURNS_CREATE,
  PERMISSIONS.ROUTE_VIEW,
  PERMISSIONS.ROUTE_OPTIMIZE,
  PERMISSIONS.VISITS_CHECKIN,
  PERMISSIONS.TASKS_VIEW,
  PERMISSIONS.TASKS_COMPLETE,
  PERMISSIONS.CALENDAR_VIEW,
  PERMISSIONS.CALENDAR_PLAN,
  PERMISSIONS.LEADERBOARD_VIEW,
  PERMISSIONS.PRODUCTS_VIEW,
  // Reads adjustments and writes none: a van is not where stock gets written
  // off the books.
  PERMISSIONS.ADJUSTMENTS_VIEW,
  // He may ask for a load and sign for what turns up; deciding what leaves
  // the warehouse is the warehouse's call.
  PERMISSIONS.DEPOT_VIEW,
  PERMISSIONS.DEPOT_REQUEST,
  PERMISSIONS.DEPOT_ACCEPT,
  // Reads the currency catalog so the collect screen can offer it; recording
  // a rate stays with the office.
  PERMISSIONS.EXCHANGE_RATES_VIEW,
]

// Client-side mirror of the backend App\Support\Permissions::DEFAULTS_BY_ROLE.
// Picking a role in the form pre-fills these; the admin can still toggle
// individual permissions afterward before saving.
export const ROLE_PRESETS: Record<AssignableRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: ALL_PERMISSIONS,
  salesman: SALESMAN_DEFAULTS,
}

export const ROLE_OPTIONS: { value: AssignableRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'salesman', label: 'Salesman' },
]
