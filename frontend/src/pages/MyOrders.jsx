import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { formatDate, formatPrice, getErrorMessage } from '../utils/helpers'

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // The backend returns only this browser's orders (newest first)
  useEffect(() => {
    api
      .get('/orders/')
      .then((response) => setOrders(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">My Orders</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      <div className="mt-8">
        {loading && <p className="py-10 text-center text-brand-charcoal/70">Loading your orders...</p>}

        {!loading && error && (
          <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">{error}</p>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="rounded-lg border border-dashed border-brand-gold/60 p-10 text-center">
            <p className="text-brand-charcoal/70">You have not placed any orders yet.</p>
            <Link
              to="/products"
              className="mt-4 inline-block rounded-full bg-brand-red px-6 py-2 text-white transition-colors hover:bg-brand-saffron"
            >
              Start Shopping
            </Link>
          </div>
        )}

        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="rounded-xl border border-brand-gold/40 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">{order.order_number}</p>
                  <p className="text-sm text-brand-charcoal/70">{formatDate(order.created_at)}</p>
                </div>
                <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-sm font-semibold">{order.order_status}</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p>
                  Total: <span className="font-semibold text-brand-red">{formatPrice(order.total_amount)}</span>
                </p>
                <Link
                  to={`/order-confirmation/${order.id}`}
                  className="rounded-full bg-brand-red px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-saffron"
                >
                  View Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
