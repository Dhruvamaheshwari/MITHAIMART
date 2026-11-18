import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Package, Sparkles, Tag } from 'lucide-react'
import api from '../services/api'
import { formatDate, formatPrice, getErrorMessage } from '../utils/helpers'

export default function MyOrders() {
  const [orders, setOrders] = useState([])
  const [coupons, setCoupons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState('')

  useEffect(() => {
    Promise.all([
      api.get('/orders/'),
      api.get('/coupons/my/').catch(() => ({ data: { coupons: [] } })),
    ])
      .then(([ordersRes, couponsRes]) => {
        setOrders(ordersRes.data)
        setCoupons(couponsRes.data.coupons || [])
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  function handleCopy(code) {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => setCopiedCode(''), 2000)
  }

  return (
    <div className="bg-[#FFF8EC]/50 min-h-screen py-10">
      <section className="mx-auto max-w-3xl px-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-[#542B24]">My Orders</h1>
        <div className="mt-2 h-1 w-14 rounded bg-[#C99A42]" />

        {/* Unlocked Coupons Section */}
        {coupons.length > 0 && (
          <div className="mt-6 rounded-2xl border border-[#C99A42] bg-[#FFF8EC] p-5 shadow-xs">
            <h2 className="text-sm font-bold text-[#542B24] flex items-center gap-1.5 mb-3">
              <Sparkles size={16} className="text-[#C99A42]" /> My Discount Coupons ({coupons.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {coupons.map((cp) => (
                <div
                  key={cp.id}
                  className={`rounded-xl border p-3 flex items-center justify-between gap-2 ${
                    cp.is_used
                      ? 'border-gray-200 bg-gray-50 opacity-60'
                      : 'border-[#C99A42]/60 bg-white shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-xs font-bold text-[#9B4A32]">{cp.code}</span>
                      {cp.is_used && (
                        <span className="rounded bg-gray-200 px-1.5 py-0.2 text-[9px] font-bold text-gray-600">
                          Redeemed
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#542B24]/70 mt-0.5">
                      {cp.discount_value}% OFF on orders above ₹{cp.minimum_order_amount}
                    </p>
                  </div>
                  {!cp.is_used && (
                    <button
                      type="button"
                      onClick={() => handleCopy(cp.code)}
                      className="shrink-0 rounded-lg bg-[#FFF8EC] border border-[#E8D5B5] px-2.5 py-1 text-[11px] font-bold text-[#9B4A32] hover:bg-[#9B4A32] hover:text-white transition flex items-center gap-1"
                    >
                      {copiedCode === cp.code ? (
                        <>
                          <Check size={12} className="text-emerald-600" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-sans text-base font-bold text-[#542B24]">{order.order_number}</p>
                      {order.is_wholesale_order ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <Package size={11} /> Wholesale Quotation {order.wholesale_request_code ? `#${order.wholesale_request_code}` : ''}
                        </span>
                      ) : order.items?.some((i) => i.is_bulk) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                          <Package size={11} /> Bulk Order
                        </span>
                      ) : null}
                    </div>
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
