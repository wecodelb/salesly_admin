import type { Permission } from '@/core/auth/permissions'

export interface NavItem {
  key: string
  label: string
  icon: string
  path: string
  permission?: Permission
  group?: string
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
    label: 'People',
    items: [
      { key: 'salesmen', label: 'Salesmen', icon: 'Users', path: '/salesmen' },
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
    label: 'Analytics',
    items: [
      { key: 'reports', label: 'Reports', icon: 'BarChart2', path: '/reports', permission: 'reports.view' },
      { key: 'leaderboard', label: 'Leaderboard', icon: 'Trophy', path: '/leaderboard', permission: 'leaderboard.view' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { key: 'users', label: 'Users', icon: 'UserCog', path: '/users' },
      { key: 'subscription', label: 'Subscription', icon: 'CreditCard', path: '/subscription' },
      { key: 'api-keys', label: 'API Keys', icon: 'Key', path: '/api-keys' },
      { key: 'whatsapp', label: 'WhatsApp', icon: 'MessageCircle', path: '/whatsapp' },
      { key: 'audit', label: 'Audit Log', icon: 'Shield', path: '/audit' },
      { key: 'settings', label: 'Settings', icon: 'Settings', path: '/settings' },
    ],
  },
]
