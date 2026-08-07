export const PERMISSIONS = {
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_CREATE: 'customers.create',
  CUSTOMERS_EDIT: 'customers.edit',
  /** Removing a customer — a soft delete, so it is separate from plain editing. */
  CUSTOMERS_DELETE: 'customers.delete',
  /** Approving a customer. Holders get their own new customers verified on the
   *  spot; everyone else's land unverified for a holder to sign off. */
  CUSTOMERS_VERIFY: 'customers.verify',
  ORDERS_VIEW: 'orders.view',
  ORDERS_CREATE: 'orders.create',
  ORDERS_CONFIRM: 'orders.confirm',
  INVOICES_VIEW: 'invoices.view',
  INVOICES_SEND: 'invoices.send',
  COLLECTIONS_VIEW: 'collections.view',
  COLLECTIONS_COLLECT: 'collections.collect',
  RETURNS_VIEW: 'returns.view',
  RETURNS_CREATE: 'returns.create',
  ROUTE_VIEW: 'route.view',
  ROUTE_OPTIMIZE: 'route.optimize',
  VISITS_CHECKIN: 'visits.checkin',
  TASKS_VIEW: 'tasks.view',
  TASKS_COMPLETE: 'tasks.complete',
  CALENDAR_VIEW: 'calendar.view',
  CALENDAR_PLAN: 'calendar.plan',
  REPORTS_VIEW: 'reports.view',
  LEADERBOARD_VIEW: 'leaderboard.view',
  PRODUCTS_VIEW: 'products.view',
  /** Seeing depot loads, refill requests, and what is in a depot right now. */
  DEPOT_VIEW: 'depot.view',
  /** Asking the warehouse for a refill — the salesman's half of a transfer. */
  DEPOT_REQUEST: 'depot.request',
  /** Loading a depot, and approving or rejecting a refill request. Held by the
   *  warehouse side: whoever decides what actually leaves the building. */
  DEPOT_ISSUE: 'depot.issue',
  /** Signing for a load that arrived, short counts included. Kept apart from
   *  issuing so the same person cannot both send and confirm receipt. */
  DEPOT_ACCEPT: 'depot.accept',
  EXCHANGE_RATES_VIEW: 'exchange_rates.view',
  EXCHANGE_RATES_MANAGE: 'exchange_rates.manage',
  /** Editing the shared reference data: categories, brands, areas, units. */
  PREFERENCES_MANAGE: 'preferences.manage',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_REMOVE: 'users.remove',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: Object.values(PERMISSIONS) as Permission[],
  manager: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_CREATE,
    PERMISSIONS.CUSTOMERS_EDIT,
    PERMISSIONS.CUSTOMERS_DELETE,
    PERMISSIONS.CUSTOMERS_VERIFY,
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
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_COMPLETE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.LEADERBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.DEPOT_VIEW,
    PERMISSIONS.DEPOT_REQUEST,
    PERMISSIONS.DEPOT_ISSUE,
    PERMISSIONS.DEPOT_ACCEPT,
    PERMISSIONS.EXCHANGE_RATES_VIEW,
    PERMISSIONS.EXCHANGE_RATES_MANAGE,
    PERMISSIONS.PREFERENCES_MANAGE,
  ],
  supervisor: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.INVOICES_VIEW,
    PERMISSIONS.ROUTE_VIEW,
    PERMISSIONS.VISITS_CHECKIN,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_COMPLETE,
    PERMISSIONS.LEADERBOARD_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
  ],
}
