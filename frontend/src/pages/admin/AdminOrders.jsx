import { useEffect, useState } from 'react'
import adminApi from '../../services/adminApi'
import { formatDate, formatPrice, getErrorMessage } from '../../utils/helpers'

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [message, setMessage] = useState(null) // { ok, text }
  const [choices, setChoices] = useState({}) // order id -> the new status picked in the dropdown
  const [updatingId, setUpdatingId] = useState('')

  useEffect(() => {
    adminApi
      .get('/admin/orders/')
      .then((response) => setOrders(response.data))
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // The backend decides which statuses are allowed next (allowed_next_statuses) and checks again on save.
  async function handleUpdateStatus(order) {
    const newStatus = choices[order.id]
    if (!newStatus) return
    if (
      newStatus === 'Cancelled' &&
      !window.confirm(`Cancel order ${order.order_number}? The ordered items go back into stock. This cannot be undone.`)
    ) {
      return
    }
    setMessage(null)
    setUpdatingId(order.id)
    try {
      const response = await adminApi.patch(`/admin/orders/${order.id}/status/`, { order_status: newStatus })
      setOrders((list) => list.map((item) => (item.id === order.id ? response.data : item)))
      setChoices((current) => {
        const next = { ...current }
        delete next[order.id]
        return next
      })
      setMessage({ ok: true, text: `Order ${order.order_number} is now ${newStatus}.` })
    } catch (err) {
      const text = (err.response && err.response.data && err.response.data.error) || getErrorMessage(err)
      setMessage({ ok: false, text })
    } finally {
      setUpdatingId('')
    }
  }

  return (
    <section>
      <h1 className="text-3xl font-semibold">Orders</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      {message && (
        <p role={message.ok ? 'status' : 'alert'} className={`mt-6 rounded-lg border p-3 text-sm ${message.ok ? 'border-brand-gold/60 bg-brand-cream' : 'border-brand-red/40 bg-brand-red/5 text-brand-red'}`}>
          {message.text}
        </p>
      )}

      {loading && <p className="mt-8 text-brand-charcoal/70">Loading orders...</p>}
      {loadError && <p className="mt-6 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{loadError}</p>}
      {!loading && !loadError && orders.length === 0 && (
        <p className="mt-8 rounded-lg border border-dashed border-brand-gold/60 p-10 text-center text-brand-charcoal/70">
          No orders have been placed yet.
        </p>
      )}

      <ul className="mt-8 space-y-4">
        {orders.map((order) => (
          <li key={order.id} className="rounded-xl border border-brand-gold/40 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold">{order.order_number}</p>
                <p className="text-sm text-brand-charcoal/70">
                  {order.customer_name || 'Customer name not available'} &middot; {formatDate(order.created_at)}
                </p>
              </div>
              <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-sm font-semibold">{order.order_status}</span>
            </div>

            <ul className="mt-3 text-sm text-brand-charcoal/80">
              {order.items.map((item) => (
                <li key={`${item.product_name}-${item.variant_weight}`}>
                  {item.quantity} x {item.product_name} ({item.variant_weight})
                </li>
              ))}
            </ul>

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-brand-charcoal/60">Total amount</dt>
                <dd className="font-semibold text-brand-red">{formatPrice(order.total_amount)}</dd>
              </div>
              <div>
                <dt className="text-brand-charcoal/60">Payment method</dt>
                <dd className="font-medium">{order.payment_method}</dd>
              </div>
              <div>
                <dt className="text-brand-charcoal/60">Payment status</dt>
                <dd className="font-medium">{order.payment_status}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-brand-gold/30 pt-4">
              {order.allowed_next_statuses.length === 0 ? (
                <p className="text-sm text-brand-charcoal/60">This order is {order.order_status}. No further changes.</p>
              ) : (
                <>
                  <label htmlFor={`status-${order.id}`} className="text-sm font-medium">Change status to</label>
                  <select
                    id={`status-${order.id}`}
                    value={choices[order.id] || ''}
                    onChange={(e) => setChoices({ ...choices, [order.id]: e.target.value })}
                    className="rounded-lg border border-brand-gold/60 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">Choose...</option>
                    {order.allowed_next_statuses.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(order)}
                    disabled={!choices[order.id] || updatingId === order.id}
                    className="rounded-full bg-brand-red px-5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-50"
                  >
                    {updatingId === order.id ? 'Updating...' : 'Update'}
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
