import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { formatDate, formatPrice, getErrorMessage } from '../utils/helpers'

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .get('/orders/')
      .then((response) => setOrders(response.data))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="bg-[#FFF8EC]/50 min-h-screen py-10">
      <section className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#542B24]">My Orders</h1>
        <div className="mt-2 h-1 w-14 rounded bg-[#C99A42]" />

        <div className="mt-7">
          {loading && <p className="py-10 text-center text-xs text-[#542B24]/70">Loading your orders...</p>}

          {!loading && error && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-xs text-red-700">{error}</p>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#E8D5B5] bg-white p-10 text-center">
              <p className="text-xs text-[#542B24]/70">You have not placed any orders yet.</p>
              <Link
                to="/products"
                className="mt-4 inline-block rounded-full bg-[#9B4A32] px-6 py-2 text-xs font-bold text-white transition-colors hover:bg-[#542B24]"
              >
                Start Shopping
              </Link>
            </div>
          )}

          <ul className="space-y-3.5">
            {orders.map((order) => (
              <li key={order.id} className="rounded-xl border border-[#E8D5B5] bg-white p-5 shadow-2xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-sans text-base font-bold text-[#542B24]">{order.order_number}</p>
                    <p className="text-xs text-[#542B24]/60 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-[#FFF8EC] border border-[#E8D5B5] px-3 py-1 text-xs font-semibold text-[#542B24]">
                    {order.order_status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E8D5B5]/50 pt-3">
                  <p className="text-xs text-[#542B24]">
                    Total: <span className="font-bold text-[#9B4A32] text-sm">{formatPrice(order.total_amount)}</span>
                  </p>
                  <Link
                    to={`/order-confirmation/${order.id}`}
                    className="rounded-full bg-[#9B4A32] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#542B24]"
                  >
                    View Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
