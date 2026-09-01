import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'

/**
 * Every export button on every screen, driven the way a person drives it.
 *
 * The unit tests cover each document builder and the button in isolation. What
 * nothing covered until now is the join between them on fifteen separate
 * screens, which is where the mistakes that typecheck live: a denominator
 * counting the wrong list, a filter described but not applied, a column reading
 * a field the endpoint spells differently, a page whose button was wired to
 * another page's rows.
 *
 * So this stubs the HTTP client once — every list endpoint shares the same
 * `{ data: { data: [...] } }` envelope — and then renders each page for real,
 * clicks Export PDF, and reads the document that comes out.
 */

/** One row per screen, deliberately three rows deep so a count can be wrong. */
const FIXTURES: Record<string, unknown[]> = {
  '/customers': [
    row({ id: 1, code: 'C1', name: 'Corner Shop', salesman_name: 'Ahmad', balance: 400, credit_limit: 300, address: 'Hamra', customer_group_name: 'Retail', phone1: '01 234 567' }),
    row({ id: 2, code: 'C2', name: 'Bakery Nour', salesman_name: 'Sara', balance: 0, credit_limit: null, address: 'Tripoli', customer_group_name: 'Wholesale', phone1: '03 111 222' }),
    row({ id: 3, code: 'C3', name: 'Zahle Depot', salesman_name: 'Ahmad', balance: 150, credit_limit: null, address: 'Zahle', customer_group_name: 'Retail', phone1: '' }),
  ],
  '/items': [
    { id: 1, code: 'P1', name: 'Cola 330ml', category: 'Drinks', category_id: 1, brand: 'Coca-Cola', brand_id: 1, price_usd: 5, price_lbp: 447500, available_qty: 10, promo: null, uom_name: 'PC' },
    { id: 2, code: 'P2', name: 'Crisps 40g', category: 'Snacks', category_id: 2, brand: 'Lays', brand_id: 2, price_usd: 2, price_lbp: 179000, available_qty: 0, promo: null, uom_name: 'PC' },
    { id: 3, code: 'P3', name: 'Water 1.5L', category: 'Drinks', category_id: 1, brand: 'Sohat', brand_id: 3, price_usd: 1, price_lbp: 89500, available_qty: 42, promo: null, uom_name: 'PC' },
  ],
  '/deliveries/invoices': [
    { id: 1, trs_number: 'SI-1', trs_date: '15/03/2026 10:00', customer: 'Corner Shop', customer_id: 1, salesman: { id: 1, name: 'Ahmad' }, total_qty: 12, total_price: 100, paid_amount: 100, due_amount: 0, is_van_sale: false, rows: [] },
    { id: 2, trs_number: 'SI-2', trs_date: '20/06/2026 11:00', customer: 'Bakery Nour', customer_id: 2, salesman: { id: 2, name: 'Sara' }, total_qty: 8, total_price: 250, paid_amount: 0, due_amount: 250, is_van_sale: true, rows: [] },
    { id: 3, trs_number: 'SI-3', trs_date: '21/06/2026 09:00', customer: 'Zahle Depot', customer_id: 3, salesman: { id: 1, name: 'Ahmad' }, total_qty: 4, total_price: 60, paid_amount: 20, due_amount: 40, is_van_sale: false, rows: [] },
  ],
  '/collections': [
    { id: 1, trs_number: 'RC-1', trs_date: '15/03/2026 10:30', notes: null, customer: 'Corner Shop', customer_id: 1, amount: 100, payment_method: 'cash', source: 'balance', currency: 'USD', exchange_rate: 89500, payments: [{ method: 'cash', currency: 'USD', amount: 100, value: 100, exchange_rate: null }], allocations: [{ invoice_id: 1, was_due: 300, applied: 100, still_due: 200 }], balance_before: 300, balance_after: 200, salesman: { id: 1, name: 'Ahmad' } },
    { id: 2, trs_number: 'RC-2', trs_date: '16/03/2026 09:00', notes: null, customer: 'Bakery Nour', customer_id: 2, amount: 60, payment_method: 'cash', source: 'invoice', currency: 'USD', exchange_rate: 89500, payments: [{ method: 'cash', currency: 'USD', amount: 40, value: 40, exchange_rate: null }, { method: 'whish', currency: 'LBP', amount: 1790000, value: 20, exchange_rate: 89500 }], allocations: [], balance_before: 60, balance_after: 0, salesman: { id: 2, name: 'Sara' } },
    { id: 3, trs_number: 'RC-3', trs_date: '17/03/2026 14:00', notes: null, customer: 'Zahle Depot', customer_id: 3, amount: 25, payment_method: 'cash', source: 'balance', currency: 'USD', exchange_rate: 89500, payments: [{ method: 'cash', currency: 'USD', amount: 25, value: 25, exchange_rate: null }], allocations: [], balance_before: 150, balance_after: 125, salesman: { id: 1, name: 'Ahmad' } },
  ],
  '/users': [
    { id: 1, name: 'Ahmad Khalil', email: 'ahmad@co.com', phone: '03 111 222', image: null, role: 'salesman', permissions: ['a', 'b'], status: 'active' },
    { id: 2, name: 'Sara Fares', email: 'sara@co.com', phone: null, image: null, role: 'salesman', permissions: ['a'], status: 'active' },
    { id: 3, name: 'Rami Manager', email: 'rami@co.com', phone: '01 999 888', image: null, role: 'manager', permissions: [], status: 'inactive' },
  ],
  '/areas': [
    { id: 1, company_id: 1, code: 'A1', name: 'Beirut', customers_count: 12 },
    { id: 2, company_id: 1, code: 'A2', name: 'Tripoli', customers_count: 0 },
    { id: 3, company_id: 1, code: 'A3', name: 'Zahle', customers_count: 5 },
  ],
  '/brands': [
    { id: 1, code: 'B1', name: 'Coca-Cola', items_count: 4 },
    { id: 2, code: 'B2', name: 'Lays', items_count: 2 },
    { id: 3, code: 'B3', name: 'Sohat', items_count: 0 },
  ],
  '/categories': [
    { id: 1, code: 'K1', name: 'Drinks', items_count: 6 },
    { id: 2, code: 'K2', name: 'Snacks', items_count: 3 },
    { id: 3, code: 'K3', name: 'Empty', items_count: 0 },
  ],
  '/customer-groups': [
    { id: 1, company_id: 1, name: 'Retail', sort_order: 1, customers_count: 8 },
    { id: 2, company_id: 1, name: 'Wholesale', sort_order: 2, customers_count: 3 },
    { id: 3, company_id: 1, name: 'Key account', sort_order: 3, customers_count: 0 },
  ],
  '/uoms': [
    { id: 1, code: 'PC', name: 'Piece', items_count: 20, packagings_count: 4 },
    { id: 2, code: 'BOX', name: 'Box', items_count: 0, packagings_count: 6 },
    { id: 3, code: 'PAL', name: 'Pallet', items_count: 0, packagings_count: 0 },
  ],
  // One of each shape the screen has to tell apart: a standard out-only type
  // with history, a standard both-ways one, and a switched-off custom type
  // nothing has been written under.
  '/adjustment-types': [
    { id: 1, code: 'damaged', name: 'Damaged', direction: 'out', is_active: true, is_system: true, sort_order: 3, memo: '', rows_count: 7 },
    { id: 2, code: 'adjust', name: 'Adjust quantity', direction: 'both', is_active: true, is_system: true, sort_order: 5, memo: 'Recount', rows_count: 0 },
    { id: 3, code: 'theft', name: 'Shrinkage', direction: 'out', is_active: false, is_system: false, sort_order: 9, memo: '', rows_count: 0 },
  ],
  '/currencies': [
    { id: 1, code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, symbol_position: 'before', is_base: true, is_active: true },
    { id: 2, code: 'LBP', name: 'Lebanese Pound', symbol: 'L.L', decimal_places: 0, symbol_position: 'after', is_base: false, is_active: true },
    { id: 3, code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, symbol_position: 'before', is_base: false, is_active: false },
  ],
  '/exchange-rates': [],
  '/promotions': [
    { id: 1, name: 'Summer', type: 'percent', value: 10, item_id: 1, item: 'Cola 330ml', category_id: null, category: null, starts_at: '2026-06-01', ends_at: '2026-08-31', is_active: true },
    { id: 2, name: 'Clearance', type: 'amount', value: 2.5, item_id: null, item: null, category_id: 2, category: 'Snacks', starts_at: '2026-05-01', ends_at: null, is_active: false },
    { id: 3, name: 'Ramadan', type: 'percent', value: 15, item_id: null, item: null, category_id: 1, category: 'Drinks', starts_at: null, ends_at: null, is_active: true },
  ],
  '/price-lists': [
    { id: 1, name: 'Wholesale', is_default: false, is_active: true, items_count: 12, customers: [{ id: 1, name: 'Corner Shop' }] },
    { id: 2, name: 'Retail', is_default: true, is_active: true, items_count: 0, customers: [] },
    { id: 3, name: 'Old list', is_default: false, is_active: false, items_count: 3, customers: [] },
  ],
  '/warehouses': [
    { id: 1, uuid: null, code: 'W1', name: 'Main store', location: 'Beirut', area_id: 1, area_name: 'Beirut', is_depot: false, is_main: true, salesman: null, max_weight: null, max_volume: null },
    { id: 2, uuid: null, code: 'V1', name: 'Van 3', location: '', area_id: null, area_name: null, is_depot: true, is_main: false, salesman: { id: 1, name: 'Ahmad' }, max_weight: 1000, max_volume: null },
    { id: 3, uuid: null, code: 'V2', name: 'Van 7', location: '', area_id: null, area_name: null, is_depot: true, is_main: false, salesman: null, max_weight: null, max_volume: null },
  ],
  '/depot-stock': [],
  // Two requests, two loads and an acceptance, on purpose: the requests screen
  // must count only its two LRs and the issues screen only its two LIs, never
  // the book of five.
  '/depot-transfers': [
    { id: 4, company_id: 1, uuid: null, trs_type: 'LR', trs_number: 'LR-2', trs_date: '18/03/2026 09:00', status: 'CONFIRMED', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 3, name: 'Van 7' }, salesman: { id: 2, name: 'Sara' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 20, total_cost: 0, total_weight: 0 },
    { id: 5, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 'LI-2', trs_date: '19/03/2026 08:30', status: 'DRAFT', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 3, name: 'Van 7' }, salesman: { id: 2, name: 'Sara' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 30, total_cost: 0, total_weight: 0 },
    { id: 1, company_id: 1, uuid: null, trs_type: 'LR', trs_number: 'LR-1', trs_date: '15/03/2026 09:30', status: 'DRAFT', is_in_transit: false, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 40, total_cost: 0, total_weight: 0 },
    { id: 2, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 'LI-1', trs_date: '16/03/2026 08:00', status: 'CONFIRMED', is_in_transit: true, src_id: 1, source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Admin', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 60, total_cost: 0, total_weight: 0 },
    { id: 3, company_id: 1, uuid: null, trs_type: 'TRI', trs_number: 'TRI-1', trs_date: '17/03/2026 18:00', status: 'COMPLETED', is_in_transit: false, src_id: 2, source: { id: 2, name: 'Van 3' }, destination: { id: 1, name: 'Main store' }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Admin', confirmed_at: '17/03/2026 18:05', confirmed_by: 1, confirmed_by_name: 'Ahmad', total_qty: 5, total_cost: 0, total_weight: 0 },
  ],
  // Stock coming back the other way: LI documents whose SOURCE is a depot.
  // One still waiting, one already taken back, one refused — the three states
  // the screen has to tell apart, and a mix so a total over "held on vans"
  // cannot pass by counting everything.
  '/depot-transfers?flow=unload': [
    { id: 11, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 'UL-1', trs_date: '20/03/2026 19:10', status: 'DRAFT', is_in_transit: false, src_id: null, source: { id: 2, name: 'Van 3', is_depot: true }, destination: { id: 1, name: 'Main store', is_depot: false }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Ahmad', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 25, total_cost: 0, total_weight: 0 },
    { id: 12, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 'UL-2', trs_date: '19/03/2026 18:40', status: 'COMPLETED', is_in_transit: false, src_id: null, source: { id: 3, name: 'Van 7', is_depot: true }, destination: { id: 1, name: 'Main store', is_depot: false }, salesman: { id: 2, name: 'Sara' }, created_by: 2, created_by_name: 'Sara', confirmed_at: '19/03/2026 19:00', confirmed_by: 1, confirmed_by_name: 'Admin', total_qty: 40, total_cost: 0, total_weight: 0 },
    { id: 13, company_id: 1, uuid: null, trs_type: 'LI', trs_number: 'UL-3', trs_date: '18/03/2026 18:15', status: 'CANCELED', is_in_transit: false, src_id: null, source: { id: 2, name: 'Van 3', is_depot: true }, destination: { id: 1, name: 'Main store', is_depot: false }, salesman: { id: 1, name: 'Ahmad' }, created_by: 1, created_by_name: 'Ahmad', confirmed_at: null, confirmed_by: null, confirmed_by_name: null, total_qty: 10, total_cost: 0, total_weight: 0 },
  ],
}

/** A customer row, with the fields every customer screen expects present. */
function row(over: Record<string, unknown>) {
  return {
    phone2: '',
    email: '',
    salesman_id: 1,
    customer_group_id: 1,
    area_name: 'Beirut',
    is_active: true,
    is_verified: true,
    ...over,
  }
}

// Stubbed at the HTTP client, which is the one thing every feature's API module
// goes through — so each page's own request code runs for real.
vi.mock('@/core/api/client', () => ({
  apiClient: {
    get: async (url: string, config?: { params?: Record<string, unknown> }) => {
      // The unloads list is the same endpoint as the transfers list, narrowed
      // by a param rather than a path — an unload is an LI pointing the other
      // way, not a resource of its own. Keying on the URL alone would hand the
      // Unloads screen the loading paperwork and quietly prove nothing.
      const key =
        config?.params?.flow === 'unload'
          ? '/depot-transfers?flow=unload'
          : Object.keys(FIXTURES).find((k) => url === k || url.startsWith(`${k}?`))

      if (!key || !FIXTURES[key]) throw new Error(`No fixture for GET ${url}`)
      return { data: { status: 'success', message: null, data: { data: FIXTURES[key] } } }
    },
    post: async () => ({ data: { status: 'success', message: null, data: { data: {} } } }),
    patch: async () => ({ data: { status: 'success', message: null, data: { data: {} } } }),
    delete: async () => ({ data: { status: 'success', message: null, data: { data: {} } } }),
    interceptors: { request: { use: () => {} }, response: { use: () => {} } },
  },
}))

interface Screen {
  name: string
  load: () => Promise<ComponentType>
  /** Something on the page that proves the rows arrived. */
  ready: string | RegExp
  /** The document's title, which is also its masthead. */
  title: string
  /** What the subtitle must say when nothing is filtered. */
  scope: string
  /** Rows that must appear on the printed page. */
  prints: string[]
  /**
   * Type this into the screen’s own search box and one row survives. Omitted
   * for the three screens that show everything and offer no filter at all.
   */
  filter?: {
    /** Matched against the search input’s placeholder. */
    box: RegExp
    query: string
    /** The single row that survives it. */
    keeps: string
    /** A row that must not reach the page. */
    drops: string
    /** What the subtitle must say once it is narrowed. */
    scope: string
  }
}

const SCREENS: Screen[] = [
  {
    name: 'Customers',
    load: async () => (await import('@/features/customers/pages/CustomersPage')).CustomersPage,
    ready: 'Corner Shop',
    title: 'Customers',
    scope: '3 customers',
    prints: ['Corner Shop', 'Bakery Nour', 'Zahle Depot'],
    filter: {
      box: /name, code, phone/,
      query: 'bakery',
      keeps: 'Bakery Nour',
      drops: 'Corner Shop',
      scope: '1 of 3 customers',
    },
  },
  {
    name: 'Products',
    load: async () => (await import('@/features/products/pages/ProductsPage')).ProductsPage,
    ready: 'Cola 330ml',
    title: 'Product catalog',
    scope: '3 products',
    prints: ['Cola 330ml', 'Crisps 40g', 'Water 1.5L'],
    filter: {
      box: /name, code, category/,
      query: 'crisps',
      keeps: 'Crisps 40g',
      drops: 'Cola 330ml',
      scope: '1 of 3 products',
    },
  },
  {
    name: 'Invoices',
    load: async () => (await import('@/features/invoices/pages/InvoicesPage')).InvoicesPage,
    ready: 'SI-1',
    title: 'Invoices',
    scope: '3 invoices',
    prints: ['SI-1', 'SI-2', 'SI-3'],
    filter: {
      box: /invoice number/,
      query: 'SI-2',
      keeps: 'SI-2',
      drops: 'SI-1',
      scope: '1 of 3 invoices',
    },
  },
  {
    name: 'Users',
    load: async () => (await import('@/features/users/pages/UsersPage')).UsersPage,
    ready: 'Ahmad Khalil',
    title: 'Team',
    scope: '3 users',
    prints: ['Ahmad Khalil', 'Sara Fares', 'Rami Manager'],
    filter: {
      box: /name or email/,
      query: 'rami',
      keeps: 'Rami Manager',
      drops: 'Ahmad Khalil',
      scope: '1 of 3 users',
    },
  },
  {
    name: 'Collections',
    load: async () =>
      (await import('@/features/collections/pages/CollectionsPage')).CollectionsPage,
    ready: 'RC-1',
    title: 'Collections',
    scope: '3 collections',
    prints: ['RC-1', 'RC-2', 'RC-3'],
    filter: {
      box: /receipt number/,
      query: 'bakery',
      keeps: 'RC-2',
      drops: 'RC-1',
      scope: '1 of 3 collections',
    },
  },
  {
    name: 'Areas',
    load: async () => (await import('@/features/areas/pages/AreasPage')).AreasPage,
    ready: 'Beirut',
    title: 'Areas',
    scope: '3 areas',
    prints: ['Beirut', 'Tripoli', 'Zahle'],
    filter: {
      box: /name or code/,
      query: 'tripoli',
      keeps: 'Tripoli',
      drops: 'Beirut',
      scope: '1 of 3 areas',
    },
  },
  {
    name: 'Brands',
    load: async () => (await import('@/features/brands/pages/BrandsPage')).BrandsPage,
    ready: 'Coca-Cola',
    title: 'Brands',
    scope: '3 brands',
    prints: ['Coca-Cola', 'Lays', 'Sohat'],
    filter: {
      box: /name or code/,
      query: 'lays',
      keeps: 'Lays',
      drops: 'Coca-Cola',
      scope: '1 of 3 brands',
    },
  },
  {
    name: 'Categories',
    load: async () => (await import('@/features/categories/pages/CategoriesPage')).CategoriesPage,
    ready: 'Drinks',
    title: 'Categories',
    scope: '3 categories',
    prints: ['Drinks', 'Snacks'],
    filter: {
      box: /Search categories/,
      query: 'snacks',
      keeps: 'Snacks',
      drops: 'Drinks',
      scope: '1 of 3 categories',
    },
  },
  {
    name: 'Customer groups',
    load: async () =>
      (await import('@/features/customer-groups/pages/CustomerGroupsPage')).CustomerGroupsPage,
    ready: 'Retail',
    title: 'Customer groups',
    scope: '3 groups',
    prints: ['Retail', 'Wholesale', 'Key account'],
    filter: {
      box: /Search by name/,
      query: 'wholesale',
      keeps: 'Wholesale',
      drops: 'Retail',
      scope: '1 of 3 groups',
    },
  },
  {
    name: 'Units',
    load: async () => (await import('@/features/uoms/pages/UomsPage')).UomsPage,
    ready: 'Piece',
    title: 'Units of measure',
    scope: '3 units',
    prints: ['Piece', 'Box', 'Pallet'],
    filter: {
      box: /name or code/,
      query: 'pallet',
      keeps: 'Pallet',
      drops: 'Piece',
      scope: '1 of 3 units',
    },
  },
  {
    name: 'Adjustment Types',
    load: async () =>
      (await import('@/features/adjustments/pages/AdjustmentTypesPage')).AdjustmentTypesPage,
    ready: 'Damaged',
    title: 'Adjustment types',
    scope: '3 types',
    prints: ['Damaged', 'Adjust quantity', 'Shrinkage'],
    filter: {
      box: /name or code/,
      query: 'shrink',
      keeps: 'Shrinkage',
      drops: 'Damaged',
      scope: '1 of 3 types',
    },
  },
  {
    name: 'Currencies',
    load: async () => (await import('@/features/currencies/pages/CurrenciesPage')).CurrenciesPage,
    ready: 'US Dollar',
    title: 'Currencies',
    scope: '3 currencies',
    prints: ['US Dollar', 'Lebanese Pound', 'Euro'],
  },
  {
    name: 'Promotions',
    load: async () => (await import('@/features/promotions/pages/PromotionsPage')).PromotionsPage,
    ready: 'Summer',
    title: 'Promotions',
    scope: '3 promotions',
    prints: ['Summer', 'Clearance', 'Ramadan'],
  },
  {
    name: 'Price lists',
    load: async () => (await import('@/features/price-lists/pages/PriceListsPage')).PriceListsPage,
    ready: 'Wholesale',
    title: 'Price lists',
    scope: '3 price lists',
    prints: ['Wholesale', 'Retail', 'Old list'],
  },
  {
    name: 'Warehouses',
    load: async () => (await import('@/features/warehouses/pages/WarehousesPage')).WarehousesPage,
    ready: 'Main store',
    title: 'Warehouses',
    scope: '3 warehouses',
    prints: ['Main store', 'Van 3', 'Van 7'],
    filter: {
      box: /name, code, location/,
      query: 'van 7',
      keeps: 'Van 7',
      drops: 'Main store',
      scope: '1 of 3 warehouses',
    },
  },
  {
    name: 'Load requests',
    load: async () =>
      (await import('@/features/my-depot/pages/LoadRequestsPage')).LoadRequestsPage,
    ready: 'LR-1',
    title: 'Load requests',
    // Two LRs among five transfers. "2 of 5" here would be counting the loads
    // and acceptances the screen never shows.
    scope: '2 requests',
    prints: ['LR-1', 'LR-2'],
    filter: {
      box: /request number/,
      query: 'LR-1',
      keeps: 'LR-1',
      drops: 'LR-2',
      scope: '1 of 2 requests',
    },
  },
  {
    name: 'Load issues',
    load: async () => (await import('@/features/my-depot/pages/LoadIssuesPage')).LoadIssuesPage,
    ready: 'LI-1',
    title: 'Load issues',
    scope: '2 loads',
    prints: ['LI-1', 'LI-2'],
    filter: {
      box: /load number/,
      query: 'LI-1',
      keeps: 'LI-1',
      drops: 'LI-2',
      scope: '1 of 2 loads',
    },
  },
  {
    name: 'Unloads',
    load: async () => (await import('@/features/my-depot/pages/UnloadsPage')).UnloadsPage,
    ready: 'UL-1',
    title: 'Unloads',
    scope: '3 unloads',
    prints: ['UL-1', 'UL-2', 'UL-3'],
    filter: {
      box: /unload number/,
      query: 'UL-2',
      keeps: 'UL-2',
      drops: 'UL-1',
      scope: '1 of 3 unloads',
    },
  },
]

let print: ReturnType<typeof vi.fn>

beforeEach(() => {
  print = vi.fn()
  vi.stubGlobal('print', print)
  // Admin bypasses every permission check, so no header is gated away.
  useAuthStore.setState({
    role: 'admin',
    permissions: [],
    token: 'test',
    user: { id: '1', name: 'Admin', email: 'a@b.c', company: 'Nestle Lebanon' },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  useAuthStore.setState({ role: null, permissions: [], token: null, user: null })
})

async function open(s: Screen) {
  const Page = await s.load()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })

  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  // findAll: a name can legitimately appear twice on a screen (a warehouse in
  // the table and again in a picker), and the point here is only that the rows
  // have landed.
  await screen.findAllByText(s.ready, undefined, { timeout: 4000 })
}

const doc = () => document.querySelector('.report-doc.is-print-only') as HTMLElement

/**
 * Waits for the screen's own table to lose a row.
 *
 * Scoped to the table body on purpose: several screens show a name in a KPI
 * strip or a filter picker as well as in the table, so waiting for it to leave
 * the whole document waits for something that never happens. The search boxes
 * are debounced, and this is also what stops the export firing over the
 * unfiltered list and passing for the wrong reason.
 */
async function waitForNarrowed(gone: string) {
  await waitFor(() => {
    const body = document.querySelector('table tbody')
    expect(body).not.toBeNull()
    expect(within(body as HTMLElement).queryByText(gone)).toBeNull()
  })
}

async function exportFrom(s: Screen) {
  await open(s)
  await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))
  return doc()
}

describe.each(SCREENS.map((s) => [s.name, s] as const))('%s', (_name, s) => {
  it('has an Export PDF button on it', async () => {
    await open(s)

    expect(screen.getByRole('button', { name: /export pdf/i })).toBeEnabled()
  })

  it('prints a document when it is clicked', async () => {
    const printed = await exportFrom(s)

    expect(print).toHaveBeenCalledOnce()
    expect(printed).not.toBeNull()
  })

  it('heads the page with its own title and the company', async () => {
    const printed = await exportFrom(s)
    const masthead = within(printed.querySelector('.report-masthead') as HTMLElement)

    expect(masthead.getByText(s.title)).toBeInTheDocument()
    expect(masthead.getByText('Nestle Lebanon')).toBeInTheDocument()
  })

  it('counts the rows the screen actually shows', async () => {
    // The denominator is the easy thing to get wrong: a screen that filters a
    // subset and then reports the whole book prints a number nobody can check.
    const printed = await exportFrom(s)

    expect(printed.querySelector('.report-subtitle')!.textContent).toContain(s.scope)
  })

  it('prints the rows themselves, not an empty table', async () => {
    const printed = await exportFrom(s)

    for (const text of s.prints) {
      expect(within(printed).getAllByText(text).length).toBeGreaterThan(0)
    }
  })

  it('writes no NaN, undefined or Invalid Date anywhere on the page', async () => {
    // The three ways a report says "this system is broken" to its reader.
    const printed = await exportFrom(s)

    expect(printed.textContent).not.toContain('NaN')
    expect(printed.textContent).not.toContain('undefined')
    expect(printed.textContent).not.toContain('Invalid Date')
    expect(printed.textContent).not.toContain('[object Object]')
  })

  it('repeats its headings and totals in real thead/tfoot elements', async () => {
    // What makes a multi-page PDF readable, and what a div-built table loses.
    const printed = await exportFrom(s)

    expect(printed.querySelector('.report-table thead')).not.toBeNull()
    expect(printed.querySelector('.report-table')).not.toBeNull()
  })

  it('prints only what the filter left on screen', async () => {
    // The claim the whole feature rests on: what is printed is what is shown.
    // A screen that narrows its table and then exports the full list produces a
    // page that is wrong in the one way nobody checks, because it looks right.
    if (!s.filter) return

    await open(s)
    await userEvent.type(screen.getByPlaceholderText(s.filter.box), s.filter.query)
    // The search boxes are debounced, so wait for the table itself to narrow
    // before exporting — otherwise this would test the unfiltered list again.
    await waitForNarrowed(s.filter.drops)

    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))
    const printed = doc()

    expect(within(printed).getAllByText(s.filter.keeps).length).toBeGreaterThan(0)
    expect(within(printed).queryByText(s.filter.drops)).toBeNull()
  })

  it('says on the page that it is a narrowed view', async () => {
    // Without the count and the reason, a filtered page is read as the whole
    // book — and somebody totals it and acts on the total.
    if (!s.filter) return

    await open(s)
    await userEvent.type(screen.getByPlaceholderText(s.filter.box), s.filter.query)
    await waitForNarrowed(s.filter.drops)

    await userEvent.click(screen.getByRole('button', { name: /export pdf/i }))
    const subtitle = doc().querySelector('.report-subtitle')!.textContent

    expect(subtitle).toContain(s.filter.scope)
    expect(subtitle).toContain(s.filter.query)
  })
})

