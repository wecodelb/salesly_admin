import type { AdminCustomer, SalesmanOption } from './types'

// ─── DEMO DATA — design preview only ────────────────────────────────────────
// Served by hooks/use-customers.ts while USE_MOCK_DATA is true (backend part 1
// is with the backend developer). The store is module-level and mutable so
// assign / credit-limit flows feel real within a session; nothing persists.
// "Al Watan Grocery" and "Fresh Corner Mart" match the Flutter app's demo
// cards so both apps preview the same book.

export const MOCK_SALESMEN: SalesmanOption[] = [
  { id: 11, name: 'Ahmad Khalil' },
  { id: 12, name: 'Omar Nasser' },
  { id: 13, name: 'Rami Haddad' },
  { id: 14, name: 'Sara Fares' },
]

let customers: AdminCustomer[] = [
  {
    id: 1, code: 'C-0142', name: 'Al Watan Grocery',
    phone1: '+961 3 456 789', phone2: '', email: 'alwatan@shops.lb',
    address: 'Verdun, Beirut', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 1500, balance: 486,
  },
  {
    id: 2, code: 'C-0093', name: 'Fresh Corner Mart',
    phone1: '+961 70 123 456', phone2: '', email: 'freshcorner@shops.lb',
    address: 'Hamra, Beirut', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 1000, balance: 1240,
  },
  {
    id: 3, code: 'C-0201', name: 'City Star Supermarket',
    phone1: '+961 1 789 456', phone2: '+961 3 111 222', email: 'citystar@shops.lb',
    address: 'Mar Elias, Beirut', salesman_id: 12, salesman_name: 'Omar Nasser',
    credit_limit: 5000, balance: 2140,
  },
  {
    id: 4, code: 'C-0057', name: 'Nour Mini Market',
    phone1: '+961 76 654 321', phone2: '', email: '',
    address: 'Verdun, Beirut', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 800, balance: 0,
  },
  {
    id: 5, code: 'C-0310', name: 'Baraka Store',
    phone1: '+961 71 222 333', phone2: '', email: 'baraka@shops.lb',
    address: 'Ras Beirut', salesman_id: null, salesman_name: null,
    credit_limit: null, balance: 0,
  },
  {
    id: 6, code: 'C-0188', name: 'Green Valley Foods',
    phone1: '+961 3 987 654', phone2: '', email: 'greenvalley@shops.lb',
    address: 'Achrafieh, Beirut', salesman_id: 13, salesman_name: 'Rami Haddad',
    credit_limit: 3000, balance: 3450,
  },
  {
    id: 7, code: 'C-0264', name: 'Sunrise Bakery & Market',
    phone1: '+961 81 445 566', phone2: '', email: '',
    address: 'Furn El Chebbak', salesman_id: 13, salesman_name: 'Rami Haddad',
    credit_limit: 1200, balance: 320,
  },
  {
    id: 8, code: 'C-0335', name: 'Cedars Corner Shop',
    phone1: '+961 70 778 899', phone2: '', email: 'cedars@shops.lb',
    address: 'Jounieh', salesman_id: null, salesman_name: null,
    credit_limit: 500, balance: 150,
  },
  {
    id: 9, code: 'C-0402', name: 'Phoenix Wholesale',
    phone1: '+961 1 334 455', phone2: '', email: 'phoenix@shops.lb',
    address: 'Dora Highway', salesman_id: 14, salesman_name: 'Sara Fares',
    credit_limit: 10000, balance: 6800,
  },
  {
    id: 10, code: 'C-0419', name: 'Marina Mini Mart',
    phone1: '+961 76 909 808', phone2: '', email: '',
    address: 'Zaitunay Bay', salesman_id: null, salesman_name: null,
    credit_limit: null, balance: 75,
  },
  {
    id: 11, code: 'C-0431', name: 'Bella Vista Grocery',
    phone1: '+961 3 210 987', phone2: '', email: 'bellavista@shops.lb',
    address: 'Badaro, Beirut', salesman_id: 12, salesman_name: 'Omar Nasser',
    credit_limit: 2000, balance: 640,
  },
  {
    id: 12, code: 'C-0448', name: 'Golden Wheat Bakery',
    phone1: '+961 70 556 677', phone2: '', email: '',
    address: 'Tariq El Jdideh', salesman_id: 12, salesman_name: 'Omar Nasser',
    credit_limit: 900, balance: 1080,
  },
  {
    id: 13, code: 'C-0455', name: 'Liban Fresh Market',
    phone1: '+961 1 445 667', phone2: '+961 3 445 667', email: 'libanfresh@shops.lb',
    address: 'Sin El Fil', salesman_id: 13, salesman_name: 'Rami Haddad',
    credit_limit: 4000, balance: 0,
  },
  {
    id: 14, code: 'C-0467', name: 'Snack Time Corner',
    phone1: '+961 71 334 455', phone2: '', email: '',
    address: 'Bourj Hammoud', salesman_id: 14, salesman_name: 'Sara Fares',
    credit_limit: 600, balance: 210,
  },
  {
    id: 15, code: 'C-0473', name: 'Mount Cedar Supermarket',
    phone1: '+961 9 887 766', phone2: '', email: 'mountcedar@shops.lb',
    address: 'Zouk Mikael', salesman_id: 14, salesman_name: 'Sara Fares',
    credit_limit: 7500, balance: 3900,
  },
  {
    id: 16, code: 'C-0480', name: 'Daily Basket',
    phone1: '+961 76 121 212', phone2: '', email: '',
    address: 'Ain El Remmaneh', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 1000, balance: -120,
  },
  {
    id: 17, code: 'C-0494', name: 'Sea Breeze Minimarket',
    phone1: '+961 81 656 565', phone2: '', email: 'seabreeze@shops.lb',
    address: 'Raouche', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 1500, balance: 880,
  },
  {
    id: 18, code: 'C-0502', name: 'Orient Sweets & Nuts',
    phone1: '+961 1 777 888', phone2: '', email: 'orient@shops.lb',
    address: 'Basta, Beirut', salesman_id: 13, salesman_name: 'Rami Haddad',
    credit_limit: 2500, balance: 2750,
  },
  {
    id: 19, code: 'C-0516', name: 'Family Choice Market',
    phone1: '+961 3 909 090', phone2: '', email: '',
    address: 'Chiyah', salesman_id: null, salesman_name: null,
    credit_limit: 1200, balance: 0,
  },
  {
    id: 20, code: 'C-0523', name: 'Harbor View Store',
    phone1: '+961 70 787 878', phone2: '', email: 'harborview@shops.lb',
    address: 'Byblos', salesman_id: null, salesman_name: null,
    credit_limit: null, balance: 430,
  },
  {
    id: 21, code: 'C-0538', name: 'Petit Marché',
    phone1: '+961 76 232 323', phone2: '', email: '',
    address: 'Gemmayzeh', salesman_id: 12, salesman_name: 'Omar Nasser',
    credit_limit: 800, balance: 95,
  },
  {
    id: 22, code: 'C-0549', name: 'Al Salam Wholesale',
    phone1: '+961 1 565 656', phone2: '+961 3 565 656', email: 'alsalam@shops.lb',
    address: 'Corniche El Mazraa', salesman_id: 14, salesman_name: 'Sara Fares',
    credit_limit: 12000, balance: 9400,
  },
  {
    id: 23, code: 'C-0561', name: 'Green Hills Market',
    phone1: '+961 5 454 545', phone2: '', email: '',
    address: 'Baabda', salesman_id: 13, salesman_name: 'Rami Haddad',
    credit_limit: 1800, balance: 260,
  },
  {
    id: 24, code: 'C-0577', name: 'Star Light Grocery',
    phone1: '+961 71 898 989', phone2: '', email: 'starlight@shops.lb',
    address: 'Hazmieh', salesman_id: null, salesman_name: null,
    credit_limit: null, balance: 0,
  },
  {
    id: 25, code: 'C-0584', name: 'Cedar Valley Foods',
    phone1: '+961 6 343 434', phone2: '', email: 'cedarvalley@shops.lb',
    address: 'Tripoli', salesman_id: 11, salesman_name: 'Ahmad Khalil',
    credit_limit: 3500, balance: 1420,
  },
]

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

export async function mockFetchCustomers(): Promise<AdminCustomer[]> {
  await delay()
  return customers.map((c) => ({ ...c }))
}

export async function mockFetchSalesmen(): Promise<SalesmanOption[]> {
  await delay(200)
  return [...MOCK_SALESMEN]
}

export async function mockAssignSalesman(
  id: number,
  salesmanId: number | null,
): Promise<void> {
  await delay()
  const salesman = MOCK_SALESMEN.find((s) => s.id === salesmanId) ?? null
  customers = customers.map((c) =>
    c.id === id
      ? { ...c, salesman_id: salesman?.id ?? null, salesman_name: salesman?.name ?? null }
      : c,
  )
}

export async function mockSetCreditLimit(
  id: number,
  creditLimit: number | null,
): Promise<void> {
  await delay()
  customers = customers.map((c) =>
    c.id === id ? { ...c, credit_limit: creditLimit } : c,
  )
}
