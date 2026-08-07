# Salesly System Architecture — Design Prompt for Claude Design

## CONTEXT

You are a senior software architect. Below is the complete technical specification of the **Salesly** platform — a multi-tenant SaaS CRM + field sales tool. It consists of three systems:

1. **Salesly Backend** — Laravel 11 REST API (`/api/v1/`)
2. **Salesly Admin** — React 19 + TypeScript web app (for Owners, Managers, Supervisors)
3. **Salesly Mobile** — Flutter app (for field Salesmen)

Your task is to produce a full set of **architecture diagrams** covering:

- [A] High-level system architecture
- [B] Multi-tenant data model
- [C] Authentication & authorization flow (both Sanctum + API Key)
- [D] Admin web app — pages, navigation, RBAC
- [E] Mobile app — screens, navigation, offline strategy
- [F] Sequence diagrams for every major endpoint group
- [G] Phase-based feature roadmap tree

Use **Mermaid diagrams** throughout. Make each diagram self-contained and labeled. Use swimlanes in sequence diagrams. Color-code by system (admin=blue, mobile=green, backend=orange, database=gray).

---

## SYSTEM 1 — BACKEND (Laravel 11)

### Base URL
```
http://<host>/api/v1/
```

### Authentication Methods
- **Sanctum Bearer Token** — used by Admin web + Mobile app after login
- **API Key (X-Api-Key header)** — used for external sync routes only

### Middleware
- `AttachCompanyMiddleware` — extracts `company_id` from query param or `X-Company-Id` header; validates company subscription; sets company context on all requests.

### Route Groups

#### 1. Public (no auth)
```
POST   /login             → AuthController@login
GET    /company/info      → CompanyController@info
```

#### 2. Sanctum-Protected (auth:sanctum)
```
# Auth
GET    /user              → AuthController@user
POST   /logout            → AuthController@logout

# Warehouses
GET    /warehouses                    → index
GET    /warehouses/{id}               → view
POST   /warehouses                    → store
PATCH  /warehouses/{id}               → update
DELETE /warehouses/{id}               → destroy

# Units of Measure
GET    /uoms                          → index
GET    /uoms/{id}                     → view
POST   /uoms                          → store
PATCH  /uoms/{id}                     → update
DELETE /uoms/{id}                     → destroy

# Items (Products)
GET    /items                         → index
GET    /items/{id}                    → view
GET    /items/{id}/distribution       → distribution (per warehouse)
POST   /items                         → store
PATCH  /items/{id}                    → update
DELETE /items/{id}                    → destroy

# Suppliers
GET    /suppliers                     → index
GET    /suppliers/{id}                → view
POST   /suppliers                     → store
PATCH  /suppliers/{id}                → update
DELETE /suppliers/{id}                → destroy

# Customers
GET    /customers                     → index
GET    /customers/{id}                → view
POST   /customers                     → store
PATCH  /customers/{id}                → update
DELETE /customers/{id}                → destroy

# Sales Deliveries
GET    /deliveries                    → index (with filters)
GET    /deliveries/invoices           → list invoices
GET    /deliveries/invoices/{id}      → single invoice
GET    /deliveries/{id}               → view delivery
POST   /deliveries                    → store (create delivery)
PATCH  /deliveries/{id}               → update
DELETE /deliveries/{id}               → destroy

# Mobile App Sync Endpoints (bulk, no pagination)
GET    /app/warehouses                → bulk warehouse list
GET    /app/uoms                      → bulk UOM list
GET    /app/items                     → bulk item list
GET    /app/item-uoms                 → item-UOM mappings
GET    /app/item-barcodes             → all barcodes
```

#### 3. API-Key Sync (external/ERP integration)
```
POST   /sync/warehouses               → sync warehouses from ERP
POST   /sync/warehouses/bulk-delete   → bulk delete warehouses
POST   /sync/items                    → sync items from ERP
POST   /sync/items/bulk-delete        → bulk delete items
```

### Controllers (8 total)
```
AuthController          → login, user, logout
CompanyController       → info
DashboardController     → transfers
WarehouseController     → CRUD + sync + appGet
UomController           → CRUD + sync + appGet
ItemController          → CRUD + sync + appGet + distribution + appGetUoms + appGetBarcodes
SupplierController      → CRUD
CustomerController      → CRUD
SalesDeliveryController → CRUD + invoices + invoice
```

### Domain Models (22 Models)
```
# Tenancy
User, Company, Plan, Subscription, Key, RequestLog, Bill, PrepaidCard

# Inventory
Warehouse, Item, Uom, Category, Brand, Supplier
ItemUom, ItemBarcode, ItemDistribution
NumberSequence

# Transactions
Transaction, TransactionRow

# Sales/Purchase
Customer
```

### Database Tables (28 tables)
```
users, roles, company_user, personal_access_tokens
companies, plans, subscriptions, keys, request_logs
warehouses, items, uoms, categories, brands, suppliers
item_uoms, item_barcodes, item_distributions, number_sequences
transactions, transaction_rows
customers
bills, prepaid_cards
cache, jobs
```

### Enums
- `APIKeyStatusEnum`: ACTIVE | INACTIVE
- `TransactionStatusEnum`: draft | confirmed | cancelled
- `SubscriptionStatusEnum`: active | expired | cancelled
- `BillTypeEnum`, `PaymentTypeEnum`, `BillingCycleEnum`

---

## SYSTEM 2 — ADMIN WEB APP (React 19)

### Stack
- React 19 + TypeScript, Vite, Tailwind CSS v4
- Zustand (auth, theme, splash), TanStack React Query, Axios
- React Router v7

### Routes (24 routes)
```
/login              → LoginPage          (public)
/dashboard          → DashboardPage
/live-map           → LiveMapPage
/activity           → ActivityPage
/orders             → OrdersPage         (permission: orders.view)
/invoices           → InvoicesPage       (permission: invoices.view)
/returns            → ReturnsPage        (permission: returns.view)
/collections        → CollectionsPage    (permission: collections.view)
/visits             → VisitsPage         (permission: visits.checkin)
/routes             → RoutesPage         (permission: route.view)
/tasks              → TasksPage          (permission: tasks.view)
/salesmen           → SalesmenPage
/customers          → CustomersPage      (permission: customers.view)
/products           → ProductsPage       (permission: products.view)
/price-lists        → PriceListsPage
/promotions         → PromotionsPage
/reports            → ReportsPage        (permission: reports.view)
/leaderboard        → LeaderboardPage    (permission: leaderboard.view)
/users              → UsersPage
/subscription       → SubscriptionPage
/api-keys           → ApiKeysPage
/settings           → SettingsPage
/whatsapp           → WhatsappPage
/audit              → AuditPage
```

### Sidebar Navigation Groups
```
OVERVIEW:    Dashboard, Live Map, Activity
SALES:       Orders, Invoices, Returns, Collections
FIELD:       Visits, Routes, Tasks
PEOPLE:      Salesmen, Customers
CATALOG:     Products, Price Lists, Promotions
ANALYTICS:   Reports, Leaderboard
ADMIN:       Users, Subscription, API Keys, WhatsApp, Audit Log, Settings
```

### RBAC (3 roles, 22 permissions)
```
PERMISSIONS:
  customers.view   customers.create  customers.edit
  orders.view      orders.create     orders.confirm
  invoices.view    invoices.send
  collections.view collections.collect
  returns.view     returns.create
  route.view       route.optimize
  visits.checkin
  tasks.view       tasks.complete
  calendar.view    calendar.plan
  reports.view
  leaderboard.view
  products.view

ROLES:
  owner      → ALL 22 permissions
  manager    → 19 permissions (no calendar.plan, no route.optimize, etc.)
  supervisor → 9 permissions (view-only for most, can checkin & complete tasks)
```

### Auth Flow (Admin)
```
1. POST /login → { token, user: { id, name, email, image, companies } }
2. Store token in Zustand (persisted to localStorage as "salesly-auth")
3. Attach token as "Authorization: Bearer {token}" on all requests
4. 401 response → clearAuth() + redirect to /login
5. ProtectedRoute checks permission before rendering each page
```

### State Management
```
auth-store (Zustand, persisted):   token, user, role, permissions
theme-store (Zustand, persisted):  theme ('light' | 'dark')
splash-store (Zustand, ephemeral): show/hide splash screen
toast-store (Zustand, ephemeral):  array of Toast notifications
```

### API Client Config
```
Base URL: VITE_API_URL (default: http://localhost:8000/api/v1)
Stale time: 2 minutes
Retry: 1 (queries), 0 (mutations)
Refetch on focus: disabled
```

---

## SYSTEM 3 — MOBILE APP (Flutter)

### Stack
- Flutter + Dart
- BLoC/Cubit state management
- GoRouter (navigation)
- Drift (SQLite offline DB, v6 schema)
- GetIt (dependency injection)
- Dio (HTTP client)
- Firebase (FCM push notifications)
- flutter_screenutil (responsive sizing)

### Screens (29 screens)
```
PUBLIC:
  /splash          → SplashScreen
  /onboarding      → OnboardingScreen
  /login           → LoginScreen
  /change-password → ChangePasswordScreen

BOTTOM NAV (5 tabs):
  /home            → DashboardScreen
  /route           → RouteMapScreen (GPS route)
  /orders          → OrdersScreen
  /collections     → CollectionsScreen
  /more            → MoreMenuScreen

ORDERS FLOW:
  /orders/new      → NewOrderScreen
  /orders/cart     → OrderCartScreen

CUSTOMERS:
  /customers       → CustomerListScreen
  /customers/profile/:id → CustomerProfileScreen

INVOICES:
  /invoices/:id    → InvoiceScreen

COLLECTIONS:
  /collections/new → CollectionPaymentScreen

FIELD OPERATIONS:
  /visits/check-in        → GpsCheckInScreen
  /visits/merchandising   → MerchandisingChecklistScreen

ENGAGEMENT:
  /suggestions     → SmartSuggestionsScreen
  /leaderboard     → LeaderboardScreen
  /returns         → ReturnsScreen
  /reports         → ReportsScreen

ACCOUNT:
  /settings        → SettingsScreen
  /profile         → ProfileScreen
  /notifications   → NotificationsScreen

LEGACY WMS:
  /inventory                    → InventoryScreen
  /inventory/items              → InventoryItemsScreen
  /sales/deliveries/view/:id    → SalesViewDeliveryPage
```

### All API Endpoints Called from Mobile
```
AUTH:
  POST   /login
  POST   /logout
  POST   /forgot-password
  POST   /reset-password
  POST   /change-password
  GET    /user
  PATCH  /user/language

MASTER DATA SYNC (offline cache):
  GET    /items
  GET    /app/items
  GET    /app/warehouses
  GET    /app/uoms
  GET    /app/item-uoms
  GET    /app/item-barcodes
  GET    /app/adjustmentTypes
  GET    /categories
  GET    /subcategories
  GET    /departments
  GET    /sub-departments

INVENTORY:
  GET    /items/:id/movement
  GET    /items/:id/distribution
  POST   /transfers
  GET    /transfers
  POST   /counts
  GET    /counts
  POST   /adjustments
  GET    /adjustments

PURCHASE:
  GET    /receptions
  POST   /receptions
  GET    /receptions/invoices
  GET    /receptions/purchase-orders

SALES:
  GET    /deliveries
  POST   /deliveries
  GET    /deliveries/:id
  GET    /deliveries/invoices

MATERIAL REQUESTS:
  GET    /material-requests
  POST   /material-requests
  GET    /material-requests/available-items
  POST   /material-requests/items-availability

EQUIPMENT:
  GET/POST /equipment
  GET/POST /equipment/:id/transfers
  POST     /equipment/:id/hourmeter
  GET      /equipment/:id/history

FUEL:
  GET/POST /fuel/storages
  POST     /fuel/load
  POST     /fuel/issue

PURCHASE ORDERS:
  GET/POST /purchase-orders
  PATCH    /purchase-orders/:id/receive
  POST     /purchase-orders/:id/clearance

NOTIFICATIONS:
  GET    /notifications
  POST   /notifications/read-all
  POST   /admin/notifications/push
  POST   /devices/register
  POST   /devices/unregister
```

### Cubits (State Management — 15 Cubits)
```
AuthCubit              → login, logout, session bootstrap, permissions
PasswordManagementCubit→ password change flow
HomeCubit              → dashboard aggregation
ItemsCubit             → items list, search, sync
CatalogLookupCubit     → catalog picker
WarehousesCubit        → warehouse list
SalesDeliverysListCubit→ deliveries list (paginated + filtered)
SalesDeliveryCreateCubit→ create delivery
SalesDeliveryDraftsCubit→ offline draft management
ViewSalesDeliveryCubit → view/edit single delivery
PurchaseDashboardCubit → purchase dashboard
NotificationsCubit     → notifications + mark-read
SettingsCubit          → user preferences
LocaleCubit            → language switch (en/ar/fr)
ThemeCubit             → light/dark theme
NetworkCubit           → connectivity status
```

### Offline Strategy (Drift SQLite)
```
Tables: Users, Companies, Items, Uoms, ItemUoms, ItemBarcodes,
        Warehouses, Drafts, AdjustmentTypes

Sync Pattern:
  - /app/* endpoints → bulk fetch → write to SQLite on login/refresh
  - Drafts table → JSON blobs for offline-created orders/transfers
  - On reconnect → upload drafts → mark synced
```

### DI Singletons (GetIt)
```
AppDb, SharedPreferences, CacheManager, ApiService,
AuthCubit, ConnectivityService, FirebaseService, AppRefreshBus
```

---

## PHASE ROADMAP

```
PHASE 1 — FOUNDATION (✅ Complete)
  Admin: Project setup, auth, RBAC, all 24 page routes (placeholders), shared components
  Mobile: Auth, bottom nav, core screens (orders, customers, collections, visits, route)
  Backend: Auth, company tenancy, items, warehouses, UOMs, customers, deliveries, suppliers

PHASE 2 — INVENTORY DEEP DIVE (✅ In Progress)
  Mobile: Item master, warehouse distribution, inventory counts, transfers, adjustments
  Backend: Transaction model, item distributions, sync endpoints, API key auth

PHASE 3 — EQUIPMENT & SPARE PARTS (🔲 Planned)
  Mobile: Equipment CRUD, transfers, hourmeter tracking, spare parts issuance
  Backend: Equipment model, equipment transfers, history

PHASE 4 — DIESEL / FUEL MANAGEMENT (🔲 Planned)
  Mobile: Fuel storages, fuel load/issue, tanker workflow
  Backend: Fuel module, diesel inventory type

PHASE 5 — MATERIAL REQUESTS & POs (🔄 Partial)
  Mobile: Material request creation, approval, auto-PO generation
  Backend: Purchase orders, partial goods receipt, clearance charges

PHASE 6 — REPORTING & NOTIFICATIONS (🔄 Partial)
  Mobile: Equipment/stock/purchase/diesel reports, FCM push, in-app notifications
  Admin: Reports page, leaderboard, analytics dashboard, live map, audit log
  Backend: Notification endpoints, device registration, report aggregations
```

---

## DIAGRAM REQUESTS

Please generate ALL of the following diagrams in **Mermaid syntax**. Output each diagram in its own labeled code block with a title heading.

---

### DIAGRAM A — High-Level System Architecture

Show all three systems (Admin Web, Mobile App, Backend API), the database, Firebase, and external ERP. Show which system calls which endpoints. Use a `graph TD` or `C4Context` style.

---

### DIAGRAM B — Multi-Tenant Data Model (ERD)

Show the key entities and their relationships:
- Company ←→ User (many-to-many via company_user with role_id)
- Company → Plan → Subscription
- Company → Key (API keys)
- Company → Warehouse, Item, Uom, Customer, Supplier
- Item → ItemUom → ItemBarcode
- Item → ItemDistribution → Warehouse
- Transaction → TransactionRow → Item + Warehouse

Use `erDiagram` Mermaid syntax.

---

### DIAGRAM C — Authentication & Authorization Flow

#### C1: Admin Login (Sanctum)
Sequence: Browser → POST /login → Backend validates → Returns token → Store in Zustand → Protected routes check permissions

#### C2: Mobile Login (Sanctum + Offline Sync)
Sequence: Flutter App → POST /login → Get token → GET /app/items, /app/warehouses, /app/uoms (bulk sync) → Write to SQLite → Navigate to Home

#### C3: API Key Auth (Sync Routes)
Sequence: ERP System → POST /sync/items with X-Api-Key → AttachCompanyMiddleware validates key → checks subscription → logs request → Controller processes → 200 OK

Use `sequenceDiagram` with swimlanes. Show error paths (401, 403, expired subscription).

---

### DIAGRAM D — Admin Web App Navigation Tree

Show the full sidebar navigation tree with:
- Route paths
- Permission gates on each route
- Role access (owner/manager/supervisor) per section

Use `graph LR` or `mindmap`.

---

### DIAGRAM E — Mobile App Screen Navigation Flow

Show the full GoRouter navigation with:
- Public routes (splash → onboarding → login)
- Bottom nav 5 tabs
- Detail screens pushed over the shell
- Route parameters (:id)
- Auth redirect logic

Use `graph TD` with color-coded node shapes (rhombus for guards, rectangles for screens).

---

### DIAGRAM F — Sequence Diagrams for Every Endpoint Group

Generate one sequence diagram per group below. Each must show: Actor → Admin/Mobile → Backend → DB. Show happy path + at least one error path.

#### F1: Auth Endpoints
- POST /login (success + invalid credentials)
- GET /user
- POST /logout

#### F2: Customers CRUD
- GET /customers (list with pagination)
- POST /customers (create)
- PATCH /customers/:id (update)
- DELETE /customers/:id

#### F3: Items CRUD + Distribution
- GET /items (admin list view)
- GET /app/items (mobile bulk sync)
- GET /items/:id/distribution (per warehouse)
- POST /items (create)
- PATCH /items/:id

#### F4: Warehouses CRUD + Sync
- GET /warehouses
- POST /sync/warehouses (ERP → Backend, API Key auth)
- POST /sync/warehouses/bulk-delete

#### F5: Sales Deliveries
- GET /deliveries (with filters)
- GET /deliveries/invoices
- POST /deliveries (create delivery from mobile)
- GET /deliveries/:id
- PATCH /deliveries/:id

#### F6: Suppliers CRUD
- GET /suppliers
- POST /suppliers

#### F7: Mobile Master Data Sync (Offline Strategy)
Show: Mobile app launches → check connectivity → fetch /app/items + /app/warehouses + /app/uoms in parallel → write to SQLite → show cached data when offline

#### F8: Notifications & FCM
- POST /devices/register (FCM token on login)
- GET /notifications
- POST /notifications/read-all
- POST /devices/unregister (on logout)

---

### DIAGRAM G — Phase Feature Roadmap Tree

Show all 6 phases as a tree/timeline with:
- Phase name and status (✅/🔄/🔲)
- Which system is affected (Admin/Mobile/Backend)
- Key features per phase

Use `timeline` or `gantt` Mermaid diagram.

---

### DIAGRAM H — RBAC Permission Matrix

Show a table/matrix of:
- Rows: all 22 permissions
- Columns: owner, manager, supervisor
- Cell: ✅ or ✗

Use a `graph` or formatted table.

---

### DIAGRAM I — Mobile Clean Architecture Layers

Show the layered architecture for a single feature (e.g., Deliveries):
```
Presentation Layer:  Screen → Cubit → State
Domain Layer:        Repository Interface
Data Layer:          RemoteSource (Dio) + LocalDatasource (Drift DAO)
Infrastructure:      ApiService, AppDb, GetIt DI
```

---

### DIAGRAM J — Complete API Endpoint Map (All 50+ Routes)

One comprehensive diagram showing every route grouped by domain:
- Auth
- Company
- Inventory (Warehouses, Items, UOMs)
- Purchase (Suppliers, Purchase Orders, Receptions)
- Sales (Customers, Deliveries)
- Mobile App (/app/*)
- Sync (/sync/*)
- Notifications
- Equipment
- Fuel
- Material Requests

Color-code by HTTP method: GET=blue, POST=green, PATCH=yellow, DELETE=red.

---

## OUTPUT FORMAT

For each diagram:
1. Use a `##` heading with the diagram letter and title
2. Write 1–2 sentences of context
3. Provide the Mermaid code block
4. Note any important design decisions or open questions below

Keep all diagrams **accurate to the spec above**. Do not invent endpoints, models, or features not listed. If something is ambiguous, note it as a question.
