import '@/features/reports/report-print.css'
import { formatDay, formatLbp, formatMoney, orderPill } from '../orders-logic'
import { goodsStage } from '../order-stage'
import type { Order } from '../types'

interface Props {
  order: Order
  companyName: string
}

/**
 * The order on paper: what the warehouse picks from and the shop checks
 * against when the goods arrive.
 *
 * Print-only — the page around it is the screen copy — and built on the same
 * report rules as the printed invoice, so the two documents a shop receives
 * look like they came from one system.
 */
export function OrderPrintSheet({ order, companyName }: Props) {
  const rows = order.rows ?? []

  return (
    <article className="report-doc is-print-only" aria-hidden>
      <header className="report-masthead">
        <div>
          <p className="report-company">{companyName}</p>
          <h1 className="report-title">Order #{order.trs_number}</h1>
          {order.trs_date && <p className="report-subtitle">Taken {order.trs_date}</p>}
        </div>
        <div className="report-stamp">
          <p>{orderPill(order.status).label}</p>
          <p>Delivery {formatDay(order.delivery_date)}</p>
        </div>
      </header>

      <section className="invoice-parties">
        <div className="invoice-party">
          <h3>For</h3>
          <p className="is-name">{order.customer.name || '—'}</p>
          {order.customer.code && <p>{order.customer.code}</p>}
          {order.customer.phone && <p>{order.customer.phone}</p>}
        </div>
        <div className="invoice-party">
          <h3>Taken by</h3>
          <p className="is-name">{order.salesman.name || '—'}</p>
          <p>Delivered by {order.deliverer.name || '—'}</p>
          <p>From {order.warehouse.name || '—'}</p>
        </div>
      </section>

      <table className="report-table">
        <colgroup>
          <col style={{ width: '12%' }} />
          <col style={{ width: '40%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '12%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '13%' }} />
        </colgroup>
        <thead>
          <tr>
            <th className="is-text">Code</th>
            <th className="is-text">Item</th>
            <th className="is-number">Qty</th>
            <th className="is-text">Unit</th>
            <th className="is-money">Price</th>
            <th className="is-money">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="is-text">{row.item_code || '—'}</td>
              <td className="is-text">{row.item_name || '—'}</td>
              <td className="is-number">{row.trs_qty}</td>
              <td className="is-text">{row.uom_name || '—'}</td>
              <td className="is-money">{formatMoney(row.price * (row.unit || 1))}</td>
              <td className="is-money">{formatMoney(row.total)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="is-text" colSpan={5}>Total · {formatLbp(order.total_price_lbp)}</td>
            <td className="is-money">{formatMoney(order.total_price)}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="report-footer">
        <p>{goodsStage(order).sentence}</p>
        {order.memo && <p>Note: {order.memo}</p>}
      </footer>
    </article>
  )
}
