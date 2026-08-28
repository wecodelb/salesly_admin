/**
 * Data for the printed proofs.
 *
 * Deliberately not tidy. Every list has the awkward rows a real book has — a
 * customer with no phone, a product nobody has priced in lira, an unmanned
 * depot, a promotion with no end date, a mixed-tender receipt — because a
 * printed page that only ever renders clean rows looks perfect right up until
 * somebody prints a real one.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
const any = <T,>(v: unknown) => v as T

export const PROOF_DATA = {
  customers: any<any[]>([
    { id: 1, code: 'C-0001', name: 'Corner Shop Hamra', salesman_name: 'Ahmad Khalil', customer_group_name: 'Retail', area_name: 'Beirut', phone1: '+961 3 456 789', phone2: '', balance: 4288.5, credit_limit: 3000, is_active: true, address: 'Hamra Street, Beirut' },
    { id: 2, code: 'C-0002', name: 'Bakery Nour', salesman_name: 'Sara Fares', customer_group_name: 'Wholesale', area_name: 'Tripoli', phone1: '', phone2: '', balance: 0, credit_limit: null, is_active: true, address: '' },
    { id: 3, code: 'C-0003', name: 'Zahle Wholesale Depot & Cold Store', salesman_name: 'Ahmad Khalil', customer_group_name: 'Key account', area_name: 'Bekaa', phone1: '+961 8 800 123', phone2: '', balance: 12400, credit_limit: 0, is_active: true, address: 'Zahle industrial zone' },
    { id: 4, code: 'C-0004', name: 'Closed Minimarket', salesman_name: '', customer_group_name: '', area_name: '', phone1: '', phone2: '', balance: 150.25, credit_limit: null, is_active: false, address: '' },
  ]),

  products: any<any[]>([
    { id: 1, code: 'P-0001', name: 'Cola 330ml can', category: 'Drinks', brand: 'Coca-Cola', price_usd: 0.5, price_lbp: 44750, available_qty: 4820 },
    { id: 2, code: 'P-0002', name: 'Sparkling water 1.5L six-pack', category: 'Drinks', brand: 'Sohat', price_usd: 3.25, price_lbp: null, available_qty: 0 },
    { id: 3, code: 'P-0003', name: 'Salted crisps 40g', category: 'Snacks', brand: 'Lays', price_usd: 0.75, price_lbp: 67125, available_qty: 1290 },
    { id: 4, code: 'P-0004', name: 'Unclassified sample', category: '', brand: '', price_usd: 0, price_lbp: 0, available_qty: -12 },
  ]),

  invoices: any<any[]>([
    { id: 1, trs_number: 'SI-1041', trs_date: '02/03/2026 09:12', customer: 'Corner Shop Hamra', customer_id: 1, salesman: { id: 1, name: 'Ahmad Khalil' }, total_qty: 240, total_price: 1288.75, paid_amount: 1288.75, due_amount: 0, rows: [] },
    { id: 2, trs_number: 'SI-1042', trs_date: '11/03/2026 16:40', customer: 'Zahle Wholesale Depot & Cold Store', customer_id: 3, salesman: { id: 1, name: 'Ahmad Khalil' }, total_qty: 1800, total_price: 9840, paid_amount: 2000, due_amount: 7840, rows: [] },
    { id: 3, trs_number: 'SI-1043', trs_date: '15/03/2026 08:05', customer: 'Bakery Nour', customer_id: 2, salesman: null, total_qty: 12, total_price: 64.5, paid_amount: 0, due_amount: 64.5, rows: [] },
  ]),

  collections: any<any[]>([
    { id: 1, trs_number: 'RC-88', trs_date: '15/03/2026 10:30', customer: 'Corner Shop Hamra', customer_id: 1, amount: 500, payment_method: 'cash', source: 'balance', currency: 'USD', exchange_rate: 89500, payments: [{ method: 'cash', currency: 'USD', amount: 500, value: 500, exchange_rate: null }], allocations: [{ invoice_id: 1, was_due: 1288.75, applied: 500, still_due: 788.75 }], balance_before: 4788.5, balance_after: 4288.5, salesman: { id: 1, name: 'Ahmad Khalil' } },
    { id: 2, trs_number: 'RC-89', trs_date: '15/03/2026 14:02', customer: 'Zahle Wholesale Depot & Cold Store', customer_id: 3, amount: 620, payment_method: 'cash', source: 'invoice', currency: 'USD', exchange_rate: 89500, payments: [{ method: 'cash', currency: 'USD', amount: 400, value: 400, exchange_rate: null }, { method: 'whish', currency: 'LBP', amount: 19690000, value: 220, exchange_rate: 89500 }], allocations: [{ invoice_id: 2, was_due: 7840, applied: 620, still_due: 7220 }], balance_before: 13020, balance_after: 12400, salesman: { id: 2, name: 'Sara Fares' } },
    { id: 3, trs_number: 'RC-90', trs_date: '16/03/2026 09:15', customer: 'Bakery Nour', customer_id: 2, amount: 64.5, payment_method: 'cheque', source: 'invoice', currency: 'USD', exchange_rate: null, payments: [{ method: 'cheque', currency: 'USD', amount: 64.5, value: 64.5, exchange_rate: null, reference: 'CH-40119' }], allocations: [], balance_before: 64.5, balance_after: 0, salesman: null },
  ]),

  users: any<any[]>([
    { id: 1, name: 'Ahmad Khalil', email: 'ahmad.khalil@nestle-lb.com', phone: '+961 3 456 789', role: 'salesman', permissions: new Array(24).fill('x'), status: 'active' },
    { id: 2, name: 'Sara Fares', email: 'sara@nestle-lb.com', phone: null, role: 'salesman', permissions: new Array(22).fill('x'), status: 'active' },
    { id: 3, name: 'Rami Haddad', email: 'rami@nestle-lb.com', phone: '+961 1 999 888', role: 'manager', permissions: [], status: 'inactive' },
  ]),

  areas: any<any[]>([
    { id: 1, code: 'A-01', name: 'Beirut', customers_count: 128 },
    { id: 2, code: 'A-02', name: 'Tripoli & the north', customers_count: 0 },
    { id: 3, code: '', name: 'Bekaa', customers_count: 44 },
  ]),

  brands: any<any[]>([
    { id: 1, code: 'B-01', name: 'Coca-Cola', items_count: 42 },
    { id: 2, code: 'B-02', name: 'Lays', items_count: 0 },
    { id: 3, code: '', name: 'Sohat', items_count: 7 },
  ]),

  categories: any<any[]>([
    { id: 1, code: 'K-01', name: 'Drinks', items_count: 96 },
    { id: 2, code: 'K-02', name: 'Snacks', items_count: 41 },
    { id: 3, code: 'K-03', name: 'Discontinued', items_count: 0 },
  ]),

  groups: any<any[]>([
    { id: 1, name: 'Retail', sort_order: 1, customers_count: 210 },
    { id: 2, name: 'Wholesale', sort_order: 2, customers_count: 64 },
    { id: 3, name: 'Key account', sort_order: 3, customers_count: 0 },
  ]),

  uoms: any<any[]>([
    { id: 1, code: 'PC', name: 'Piece', items_count: 480, packagings_count: 12 },
    { id: 2, code: 'CS', name: 'Case', items_count: 0, packagings_count: 96 },
    { id: 3, code: 'PAL', name: 'Pallet', items_count: 0, packagings_count: 0 },
  ]),

  currencies: any<any[]>([
    { id: 1, code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', decimal_places: 0, symbol_position: 'after', is_base: true, is_active: true },
    { id: 2, code: 'USD', name: 'US Dollar', symbol: '$', decimal_places: 2, symbol_position: 'before', is_base: false, is_active: true },
    { id: 3, code: 'EUR', name: 'Euro', symbol: '€', decimal_places: 2, symbol_position: 'before', is_base: false, is_active: false },
  ]),

  rates: any<any[]>([
    { id: 3, currency_id: 2, currency: { id: 2, code: 'USD', symbol: '$' }, rate: 89500, effective_at: '2026-03-01', effective_to: null, created_by_name: 'Rami Haddad', created_at: '2026-03-01 08:00' },
    { id: 2, currency_id: 2, currency: { id: 2, code: 'USD', symbol: '$' }, rate: 89000, effective_at: '2026-02-01', effective_to: null, created_by_name: 'Rami Haddad', created_at: '2026-02-01 08:00' },
    { id: 1, currency_id: 3, currency: null, rate: 97000, effective_at: '2026-01-15', effective_to: null, created_by_name: null, created_at: null },
  ]),

  promotions: any<any[]>([
    { id: 1, name: 'Ramadan drinks', type: 'percent', value: 15, item: null, category: 'Drinks', starts_at: '2026-03-01', ends_at: '2026-04-15', is_active: true },
    { id: 2, name: 'Clearance', type: 'amount', value: 0.25, item: 'Salted crisps 40g', category: null, starts_at: '2026-02-01', ends_at: null, is_active: false },
  ]),

  priceLists: any<any[]>([
    { id: 1, name: 'Wholesale', is_default: false, is_active: true, items_count: 340, customers: new Array(64).fill({ id: 1, name: 'x' }) },
    { id: 2, name: 'Retail (default)', is_default: true, is_active: true, items_count: 0, customers: [] },
  ]),

  warehouses: any<any[]>([
    { id: 1, code: 'W-01', name: 'Main store', location: 'Beirut port road', area_name: 'Beirut', is_depot: false, is_main: true, salesman: null },
    { id: 2, code: 'V-03', name: 'Van 3', location: '', area_name: null, is_depot: true, is_main: false, salesman: { id: 1, name: 'Ahmad Khalil' } },
    { id: 3, code: 'V-07', name: 'Van 7', location: '', area_name: null, is_depot: true, is_main: false, salesman: null },
  ]),

  transfers: any<any[]>([
    { id: 1, trs_type: 'LR', trs_number: 'LR-220', trs_date: '15/03/2026 07:30', status: 'DRAFT', source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad Khalil' }, total_qty: 1420 },
    { id: 2, trs_type: 'LI', trs_number: 'LI-198', trs_date: '15/03/2026 08:05', status: 'CONFIRMED', source: { id: 1, name: 'Main store' }, destination: { id: 2, name: 'Van 3' }, salesman: { id: 1, name: 'Ahmad Khalil' }, total_qty: 1380 },
    { id: 3, trs_type: 'TRI', trs_number: 'TRI-97', trs_date: '15/03/2026 18:40', status: 'COMPLETED', source: { id: 2, name: 'Van 3' }, destination: { id: 1, name: 'Main store' }, salesman: null, total_qty: 96 },
  ]),

  /** One invoice with lines, for the card. */
  invoice: any<any>({
    id: 1042,
    trs_number: 'SI-1042',
    trs_date: '11/03/2026 16:40',
    notes: 'Delivered to the back entrance. Two cases short-dated, agreed with the owner.',
    customer: 'Zahle Wholesale Depot & Cold Store',
    customer_id: 3,
    customer_phone: '+961 8 800 123',
    customer_address: 'Zahle industrial zone, Bekaa',
    total_qty: 1800,
    total_price: 9840,
    paid_amount: 2000,
    due_amount: 7840,
    payment_method: 'cash',
    currency: 'USD',
    exchange_rate: 89500,
    is_van_sale: true,
    salesman: { id: 1, name: 'Ahmad Khalil' },
    signature_path: 'signatures/1042.png',
    latitude: 33.846,
    longitude: 35.902,
    payments: [
      { method: 'cash', amount: 1200, currency: 'USD', value: 1200, exchange_rate: null, reference: null },
      { method: 'whish', amount: 71600000, currency: 'LBP', value: 800, exchange_rate: 89500, reference: 'W-77120' },
    ],
    rows: [
      { id: 1, lno: 1, item_id: 1, item_code: 'P-0001', item_name: 'Cola 330ml can', uom_id: 2, uom_name: 'Case', unit: 24, trs_qty: 50, qty: 1200, price: 0.5, cost: null, line_memo: null },
      { id: 2, lno: 2, item_id: 3, item_code: 'P-0003', item_name: 'Salted crisps 40g', uom_id: 2, uom_name: 'Case', unit: 12, trs_qty: 40, qty: 480, price: 0.75, cost: null, line_memo: 'short-dated' },
      { id: 3, lno: 3, item_id: 2, item_code: 'P-0002', item_name: 'Sparkling water 1.5L six-pack', uom_id: 1, uom_name: 'Piece', unit: 1, trs_qty: 120, qty: 120, price: 3.25, cost: null, line_memo: null },
    ],
  }),
}
