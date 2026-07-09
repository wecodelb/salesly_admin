import { PERMISSIONS, type Permission } from '@/core/auth/permissions'
import type { AssignableRole } from './types'

// Human-readable grouping of the 22 permission keys for the create/edit UI.
// The key strings themselves are the single source of truth in
// core/auth/permissions.ts (which mirrors the backend App\Support\Permissions).
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
    label: 'Insights',
    items: [
      { key: PERMISSIONS.REPORTS_VIEW, label: 'View reports' },
      { key: PERMISSIONS.LEADERBOARD_VIEW, label: 'View leaderboard' },
      { key: PERMISSIONS.PRODUCTS_VIEW, label: 'View products' },
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
