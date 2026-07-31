// Base URL points at the Laravel backend. Override via VITE_API_URL env var.
export const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'

export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/login',         // POST /api/v1/login
    LOGOUT: '/logout',       // POST /api/v1/logout (auth:sanctum)
    USER: '/user',           // GET  /api/v1/user  (auth:sanctum)
  },
  COMPANY: '/company/info',  // GET  /api/v1/company/info (public)

  // Inventory
  ITEMS: '/items',           // GET/POST/PATCH/DELETE /api/v1/items
  WAREHOUSES: '/warehouses',
  UOMS: '/uoms',
  CATEGORIES: '/categories', // GET/POST/PATCH/DELETE /api/v1/categories
  BRANDS: '/brands',         // GET/POST/PATCH/DELETE
  PROMOTIONS: '/promotions', // GET(+?scope=all)/POST/PATCH/DELETE
  PRICE_LISTS: '/price-lists',// GET/POST/PATCH/DELETE
  CURRENCIES: '/currencies', // GET/POST/PATCH/DELETE
  EXCHANGE_RATES: '/exchange-rates', // GET(+?currency_id)/POST/DELETE (no update)

  // Sales
  CUSTOMERS: '/customers',
  AREAS: '/areas',           // GET/POST/PATCH/DELETE — sales territories
  DELIVERIES: '/deliveries',
  INVOICES: '/deliveries/invoices',

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
