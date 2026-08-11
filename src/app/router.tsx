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
const CustomersPage    = lazy(() => import('@/features/customers/pages/CustomersPage').then(m => ({ default: m.CustomersPage })))
const DepotTransfersPage = lazy(() => import('@/features/my-depot/pages/DepotTransfersPage').then(m => ({ default: m.DepotTransfersPage })))
const DepotTransferDetailPage = lazy(() => import('@/features/my-depot/pages/DepotTransferDetailPage').then(m => ({ default: m.DepotTransferDetailPage })))
const WarehousesPage   = lazy(() => import('@/features/warehouses/pages/WarehousesPage').then(m => ({ default: m.WarehousesPage })))
const WarehouseDetailPage = lazy(() => import('@/features/warehouses/pages/WarehouseDetailPage').then(m => ({ default: m.WarehouseDetailPage })))
const ProductsPage     = lazy(() => import('@/features/products/pages/ProductsPage').then(m => ({ default: m.ProductsPage })))
const PriceListsPage   = lazy(() => import('@/features/price-lists/pages/PriceListsPage').then(m => ({ default: m.PriceListsPage })))
const PromotionsPage   = lazy(() => import('@/features/promotions/pages/PromotionsPage').then(m => ({ default: m.PromotionsPage })))
const CurrenciesPage = lazy(() => import('@/features/currencies/pages/CurrenciesPage').then(m => ({ default: m.CurrenciesPage })))
const CustomerDetailPage = lazy(() => import('@/features/customers/pages/CustomerDetailPage').then(m => ({ default: m.CustomerDetailPage })))
const ProductDetailPage  = lazy(() => import('@/features/products/pages/ProductDetailPage').then(m => ({ default: m.ProductDetailPage })))
const CategoriesPage   = lazy(() => import('@/features/categories/pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })))
const BrandsPage       = lazy(() => import('@/features/brands/pages/BrandsPage').then(m => ({ default: m.BrandsPage })))
const AreasPage        = lazy(() => import('@/features/areas/pages/AreasPage').then(m => ({ default: m.AreasPage })))
const UomsPage         = lazy(() => import('@/features/uoms/pages/UomsPage').then(m => ({ default: m.UomsPage })))
const CustomerGroupsPage = lazy(() => import('@/features/customer-groups/pages/CustomerGroupsPage').then(m => ({ default: m.CustomerGroupsPage })))
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
      // Depot. Reading is one key; issuing, accepting and answering requests
      // are gated inside the screens, since a load's own source decides who may
      // send it out.
      { path: 'depot-transfers', Component: makePage(DepotTransfersPage, P.DEPOT_VIEW) },
      { path: 'depot-transfers/:id', Component: makePage(DepotTransferDetailPage, P.DEPOT_VIEW) },
      // Every place stock can sit, depots included. Reading rides with the
      // depot screens it feeds; opening, editing and deleting one is gated by
      // preferences.manage inside the page.
      { path: 'warehouses',   Component: makePage(WarehousesPage, P.DEPOT_VIEW) },
      // What one warehouse holds. Replaced a depot-stock screen that asked the
      // reader to pick a name out of a list they had just come from.
      { path: 'warehouses/:id', Component: makePage(WarehouseDetailPage, P.DEPOT_VIEW) },
      { path: 'customers',    Component: makePage(CustomersPage, P.CUSTOMERS_VIEW) },
      { path: 'customers/:id', Component: makePage(CustomerDetailPage, P.CUSTOMERS_VIEW) },
      { path: 'products',     Component: makePage(ProductsPage, P.PRODUCTS_VIEW) },
      { path: 'products/:id', Component: makePage(ProductDetailPage, P.PRODUCTS_VIEW) },
      { path: 'price-lists',  Component: makePage(PriceListsPage) },
      { path: 'promotions',   Component: makePage(PromotionsPage) },
      { path: 'currencies', Component: makePage(CurrenciesPage, P.EXCHANGE_RATES_VIEW) },
      // Preferences — shared reference data. Reads follow the screen each one
      // feeds; editing is gated by preferences.manage inside the page.
      { path: 'categories',   Component: makePage(CategoriesPage, P.PRODUCTS_VIEW) },
      { path: 'brands',       Component: makePage(BrandsPage, P.PRODUCTS_VIEW) },
      { path: 'areas',        Component: makePage(AreasPage, P.CUSTOMERS_VIEW) },
      { path: 'customer-groups', Component: makePage(CustomerGroupsPage, P.CUSTOMERS_VIEW) },
      { path: 'uoms',         Component: makePage(UomsPage, P.PRODUCTS_VIEW) },
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
