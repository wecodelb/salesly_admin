import type { Permission } from '@/core/auth/permissions'

/**
 * A live count the sidebar hangs off an entry. Named rather than numeric,
 * because the number is fetched where it is rendered — nav-config is a static
 * description of the menu and has no business holding state.
 */
export type NavBadge = 'pending-load-requests'

export interface NavItem {
  key: string
  label: string
  icon: string
  path: string
  permission?: Permission
  /** Restrict to these roles (in addition to any permission check). */
  roles?: string[]
  group?: string
  /** Shown as a count beside the label while it is above zero. */
  badge?: NavBadge
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', path: '/dashboard' },
      { key: 'live-map', label: 'Live Map', icon: 'Map', path: '/live-map' },
      { key: 'activity', label: 'Activity', icon: 'Activity', path: '/activity' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { key: 'orders', label: 'Orders', icon: 'ShoppingCart', path: '/orders', permission: 'orders.view' },
      { key: 'invoices', label: 'Invoices', icon: 'FileText', path: '/invoices', permission: 'invoices.view' },
      { key: 'returns', label: 'Returns', icon: 'RotateCcw', path: '/returns', permission: 'returns.view' },
      { key: 'collections', label: 'Collections', icon: 'Banknote', path: '/collections', permission: 'collections.view' },
    ],
  },
  {
    label: 'Field',
    items: [
      { key: 'visits', label: 'Visits', icon: 'MapPin', path: '/visits', permission: 'visits.checkin' },
      { key: 'routes', label: 'Routes', icon: 'Route', path: '/routes', permission: 'route.view' },
      { key: 'tasks', label: 'Tasks', icon: 'CheckSquare', path: '/tasks', permission: 'tasks.view' },
    ],
  },
  {
    // Before a salesman can sell anything he has to be loaded up, so the depot
    // sits above the catalog and beside the field work it belongs to.
    label: 'Depot',
    items: [
      // The badge is the load requests nobody has answered: a salesman asking
      // for stock is blocked until somebody here says yes, and that is not a
      // thing to find out by opening the screen.
      // The chain in the order it happens. The badge is the requests nobody has
      // answered: a salesman asking for stock is blocked until somebody here says
      // yes, and that is not a thing to find out by opening the screen.
      { key: 'load-requests', label: 'Load Requests', icon: 'Inbox', path: '/load-requests', permission: 'depot.view', badge: 'pending-load-requests' },
      { key: 'load-issues', label: 'Load Issues', icon: 'Truck', path: '/load-issues', permission: 'depot.view' },
      { key: 'adjustments', label: 'Adjustments', icon: 'ClipboardList', path: '/adjustments', permission: 'adjustments.view' },
      // No separate stock entry. What each place holds is on the warehouse list
      // and on the warehouse itself, which is where somebody looking for it
      // already is.
      { key: 'warehouses', label: 'Warehouses', icon: 'Warehouse', path: '/warehouses', permission: 'depot.view' },
    ],
  },
  {
    label: 'People',
    items: [
      { key: 'customers', label: 'Customers', icon: 'Building2', path: '/customers', permission: 'customers.view' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { key: 'products', label: 'Products', icon: 'Package', path: '/products', permission: 'products.view' },
      { key: 'price-lists', label: 'Price Lists', icon: 'Tags', path: '/price-lists' },
      { key: 'promotions', label: 'Promotions', icon: 'Percent', path: '/promotions' },
    ],
  },
  {
    label: 'Preferences',
    items: [
      { key: 'categories', label: 'Categories', icon: 'FolderTree', path: '/categories', permission: 'products.view' },
      { key: 'brands', label: 'Brands', icon: 'Tag', path: '/brands', permission: 'products.view' },
      { key: 'areas', label: 'Areas', icon: 'MapPinned', path: '/areas', permission: 'customers.view' },
      { key: 'customer-groups', label: 'Customer Groups', icon: 'BadgeCheck', path: '/customer-groups', permission: 'customers.view' },
      { key: 'uoms', label: 'Units', icon: 'Ruler', path: '/uoms', permission: 'products.view' },
      { key: 'currencies', label: 'Currencies', icon: 'Coins', path: '/currencies', permission: 'exchange_rates.view' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { key: 'reports', label: 'Reports', icon: 'BarChart2', path: '/reports', permission: 'reports.view' },
      { key: 'leaderboard', label: 'Leaderboard', icon: 'Trophy', path: '/leaderboard', permission: 'leaderboard.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'users', label: 'Users', icon: 'UserCog', path: '/users', roles: ['admin', 'manager'] },
      { key: 'subscription', label: 'Subscription', icon: 'CreditCard', path: '/subscription' },
      { key: 'api-keys', label: 'API Keys', icon: 'Key', path: '/api-keys' },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', path: '/whatsapp' },
      { key: 'audit', label: 'Audit Log', icon: 'Shield', path: '/audit' },
      { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' },
    ],
  },
]
