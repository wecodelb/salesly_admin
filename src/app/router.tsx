import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppShell } from '@/shared/layout/AppShell'
import { ProtectedRoute } from '@/core/auth/ProtectedRoute'
import { PERMISSIONS } from '@/core/auth/permissions'
import { LoadingSkeleton } from '@/shared/components/LoadingSkeleton/LoadingSkeleton'
import type { Permission } from '@/core/auth/permissions'

const P = PERMISSIONS

// Lazy-load every page so JSX creation is deferred past module scope
const LoginPage        = lazy(() => import('@/features/auth/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const DashboardPage    = lazy(() => import('@/features/dashboard/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const LiveMapPage      = lazy(() => import('@/features/live-map/pages/LiveMapPage').then(m => ({ default: m.LiveMapPage })))
const ActivityPage     = lazy(() => import('@/features/activity/pages/ActivityPage').then(m => ({ default: m.ActivityPage })))
const OrdersPage       = lazy(() => import('@/features/orders/pages/OrdersPage').then(m => ({ default: m.OrdersPage })))
const InvoicesPage     = lazy(() => import('@/features/invoices/pages/InvoicesPage').then(m => ({ default: m.InvoicesPage })))
const ReturnsPage      = lazy(() => import('@/features/returns/pages/ReturnsPage').then(m => ({ default: m.ReturnsPage })))
const CollectionsPage  = lazy(() => import('@/features/collections/pages/CollectionsPage').then(m => ({ default: m.CollectionsPage })))
const VisitsPage       = lazy(() => import('@/features/visits/pages/VisitsPage').then(m => ({ default: m.VisitsPage })))
const RoutesPage       = lazy(() => import('@/features/routes/pages/RoutesPage').then(m => ({ default: m.RoutesPage })))
const TasksPage        = lazy(() => import('@/features/tasks/pages/TasksPage').then(m => ({ default: m.TasksPage })))
const SalesmenPage     = lazy(() => import('@/features/salesmen/pages/SalesmenPage').then(m => ({ default: m.SalesmenPage })))
const CustomersPage    = lazy(() => import('@/features/customers/pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const ProductsPage     = lazy(() => import('@/features/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const PriceListsPage   = lazy(() => import('@/features/price-lists/pages/PriceListsPage').then(m => ({ default: m.PriceListsPage })))
const PromotionsPage   = lazy(() => import('@/features/promotions/pages/PromotionsPage').then(m => ({ default: m.PromotionsPage })))
const ReportsPage      = lazy(() => import('@/features/reports/pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const LeaderboardPage  = lazy(() => import('@/features/leaderboard/pages/LeaderboardPage').then(m => ({ default: m.LeaderboardPage })))
const UsersPage        = lazy(() => import('@/features/users/pages/UsersPage').then(m => ({ default: m.UsersPage })))
const SubscriptionPage = lazy(() => import('@/features/subscription/pages/SubscriptionPage').then(m => ({ default: m.SubscriptionPage })))
const ApiKeysPage      = lazy(() => import('@/features/api-keys/pages/ApiKeysPage').then(m => ({ default: m.ApiKeysPage })))
const SettingsPage     = lazy(() => import('@/features/settings/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const WhatsappPage     = lazy(() => import('@/features/whatsapp/pages/WhatsappPage').then(m => ({ default: m.WhatsappPage })))
const AuditPage        = lazy(() => import('@/features/audit/pages/AuditPage').then(m => ({ default: m.AuditPage })))

// Component-factory: returns a React component (no JSX at module scope)
function makePage(
  Page: React.ComponentType,
  permission?: Permission,
  roles?: string[],
): React.ComponentType {
  return function PageRoute() {
    const inner = (
      <Suspense fallback={<LoadingSkeleton />}>
        <Page />
      </Suspense>
    )
    return permission || roles ? (
      <ProtectedRoute permission={permission} roles={roles}>
        {inner}
      </ProtectedRoute>
    ) : (
      inner
    )
  }
}

function AppShellGuard() {
  return <ProtectedRoute><AppShell /></ProtectedRoute>
}

function DashboardRedirect() {
  return <Navigate to="/dashboard" replace />
}

function CatchAll() {
  return <Navigate to="/dashboard" replace />
}

export const router = createBrowserRouter([
  { path: '/login',       Component: makePage(LoginPage) },
  {
    path: '/',
    Component: AppShellGuard,
    children: [
      { index: true,          Component: DashboardRedirect },
      { path: 'dashboard',    Component: makePage(DashboardPage) },
      { path: 'live-map',     Component: makePage(LiveMapPage) },
      { path: 'activity',     Component: makePage(ActivityPage) },
      { path: 'orders',       Component: makePage(OrdersPage, P.ORDERS_VIEW) },
      { path: 'invoices',     Component: makePage(InvoicesPage, P.INVOICES_VIEW) },
      { path: 'returns',      Component: makePage(ReturnsPage, P.RETURNS_VIEW) },
      { path: 'collections',  Component: makePage(CollectionsPage, P.COLLECTIONS_VIEW) },
      { path: 'visits',       Component: makePage(VisitsPage, P.VISITS_CHECKIN) },
      { path: 'routes',       Component: makePage(RoutesPage, P.ROUTE_VIEW) },
      { path: 'tasks',        Component: makePage(TasksPage, P.TASKS_VIEW) },
      { path: 'salesmen',     Component: makePage(SalesmenPage) },
      { path: 'customers',    Component: makePage(CustomersPage, P.CUSTOMERS_VIEW) },
      { path: 'products',     Component: makePage(ProductsPage, P.PRODUCTS_VIEW) },
      { path: 'price-lists',  Component: makePage(PriceListsPage) },
      { path: 'promotions',   Component: makePage(PromotionsPage) },
      { path: 'reports',      Component: makePage(ReportsPage, P.REPORTS_VIEW) },
      { path: 'leaderboard',  Component: makePage(LeaderboardPage, P.LEADERBOARD_VIEW) },
      { path: 'users',        Component: makePage(UsersPage, P.USERS_VIEW) },
      { path: 'subscription', Component: makePage(SubscriptionPage) },
      { path: 'api-keys',     Component: makePage(ApiKeysPage) },
      { path: 'settings',     Component: makePage(SettingsPage) },
      { path: 'whatsapp',     Component: makePage(WhatsappPage) },
      { path: 'audit',        Component: makePage(AuditPage) },
    ],
  },
  { path: '*', Component: CatchAll },
])
