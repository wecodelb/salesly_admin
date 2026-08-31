// Base URL points at the Laravel backend. Override via VITE_API_URL env var.
export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/login',         // POST /api/v1/login
    LOGOUT: '/logout',       // POST /api/v1/logout (auth:sanctum)
    USER: '/user',           // GET  /api/v1/user  (auth:sanctum)
  },
  COMPANY: '/company/info',  // GET  /api/v1/company/info (public)

  // The manager's dashboard, aggregated server-side and returned whole:
  // today's four figures against yesterday, a 14-day trend, the week's top
  // salesmen, the latest orders and what customers owe. Gated on orders.view.
  DASHBOARD_SUMMARY: '/dashboard/summary',

  // Inventory
  // GET/POST/PATCH/DELETE /api/v1/items, GET /{id}/distribution,
  // GET+POST /{id}/levels — the per-warehouse reorder points, read with
  // products.view and set with preferences.manage.
  ITEMS: '/items',
  WAREHOUSES: '/warehouses', // GET/POST, /{id} GET/POST/DELETE — depots included

  UOMS: '/uoms',
  CATEGORIES: '/categories', // GET/POST/PATCH/DELETE /api/v1/categories
  BRANDS: '/brands',         // GET/POST/PATCH/DELETE
  PROMOTIONS: '/promotions', // GET(+?scope=all)/POST/PATCH/DELETE
  PRICE_LISTS: '/price-lists',// GET/POST/PATCH/DELETE
  CURRENCIES: '/currencies', // GET/POST/PATCH/DELETE
  EXCHANGE_RATES: '/exchange-rates', // GET(+?currency_id)/POST/DELETE (no update)

  // Depot — loading a salesman's depot from the warehouse, and the evening's
  // return of what he didn't sell. All three documents (TRR/TRO/TRI) live on
  // one prefix because they are one flow.
  DEPOT_TRANSFERS: '/depot-transfers',   // GET/POST, /{id} GET/POST/DELETE, /{id}/issue|cancel|accept
  LOAD_REQUESTS: '/depot-transfers/load-requests', // POST, /{id}/approve, /{id}/reject
  DEPOT_STOCK: '/depot-stock', // GET — every depot at once, a line each
  MY_DEPOT: '/my-depot',     // GET(+?warehouse_id) — what a depot holds now

  // Sales
  CUSTOMERS: '/customers',
  AREAS: '/areas',           // GET/POST/PATCH/DELETE — sales territories
  CUSTOMER_GROUPS: '/customer-groups', // GET/POST/PATCH/DELETE — company's own status vocabulary
  DELIVERIES: '/deliveries',
  INVOICES: '/deliveries/invoices',
  // Every receipt the company has taken, newest first. A sibling of the two
  // above rather than a customer sub-route: the question it answers is "what
  // came in today", not "what did this shop pay".
  COLLECTIONS: '/collections',

  // Stock that moves without a sale behind it: a broken crate, an expired
  // pallet, an opening count. Reading is gated apart from writing, and writing
  // apart from approving.
  ADJUSTMENTS: '/adjustments',
  ADJUSTMENT_TYPES: '/adjustment-types',

  // Suppliers
  SUPPLIERS: '/suppliers',

  // Company users (admin management)
  USERS: '/users',           // GET/POST /api/v1/users, GET/PATCH/DELETE /api/v1/users/{id}

  // Mobile-sync (internal)
  APP: {
    ITEMS: '/app/items',
    WAREHOUSES: '/app/warehouses',
  },
} as const
