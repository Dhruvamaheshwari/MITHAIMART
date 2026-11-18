import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Copy, Gift, Package, Sparkles } from 'lucide-react'
import api from '../services/api'
import { formatDate, formatPrice, getErrorMessage } from '../utils/helpers'

export default function OrderConfirmation() {
  const { id } = useParams() // the :id from /order-confirmation/:id
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  function handleCopyCode(code) {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // The order is always loaded from the backend, so refreshing this page works.
  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    api
      .get(`/orders/${id}/`)
      .then((response) => {
        if (!ignore) setOrder(response.data)
      })
      .catch((err) => {
        if (ignore) return
        const status = err.response && err.response.status
        // 404 also happens when the order belongs to someone else
        setError(status === 400 || status === 404 ? 'This order was not found.' : getErrorMessage(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  if (loading) {
    return <p className="py-20 text-center text-brand-charcoal/70">Loading your order...</p>
  }

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{error}</p>
        <Link
          to="/my-orders"
          className="mt-6 inline-block rounded-full border border-brand-red px-6 py-2 text-brand-red transition-colors hover:bg-brand-red hover:text-white"
        >
          My Orders
        </Link>
      </section>
    )
  }

  const address = order.delivery_address

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Order placed</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
      <p className="mt-4 text-brand-charcoal/80">Thank you for shopping with MithaiMart.</p>

      <dl className="mt-6 grid gap-4 rounded-xl border border-brand-gold/40 bg-brand-cream p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-brand-charcoal/70">Order number</dt>
          <dd className="font-semibold">{order.order_number}</dd>
        </div>
        <div>
          <dt className="text-sm text-brand-charcoal/70">Order date</dt>
          <dd className="font-semibold">{formatDate(order.created_at)}</dd>
        </div>
        <div>
          <dt className="text-sm text-brand-charcoal/70">Order status</dt>
          <dd>
            <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-sm font-semibold">{order.order_status}</span>
          </dd>
        </div>
        <div>
          <dt className="text-sm text-brand-charcoal/70">Payment method</dt>
          <dd className="font-semibold">
            {order.payment_method} <span className="font-normal text-brand-charcoal/70">({order.payment_status})</span>
          </dd>
        </div>
      </dl>

      {order.is_wholesale_order && (
        <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 text-sm flex items-center gap-3">
          <Package className="h-5 w-5 text-emerald-600 shrink-0" />
          <div>
            <p className="font-bold">Wholesale Commercial Quotation Order</p>
            <p className="text-xs text-emerald-700">
              Placed under approved quotation <strong>#{order.wholesale_request_code}</strong>. Special wholesale commercial pricing applied.
            </p>
          </div>
        </div>
      )}

      {/* Next-Purchase Coupon Reward Card */}
      {order.coupon_generated && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-[#C99A42] bg-gradient-to-r from-[#FFF8EC] via-white to-[#FFF8EC] p-6 shadow-sm text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#C99A42]/20 border border-[#C99A42]/40 px-3 py-1 text-xs font-bold text-[#9B4A32] uppercase tracking-wider mb-2">
            <Sparkles size={14} className="text-[#C99A42]" /> Next-Purchase Reward Unlocked!
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#542B24]">
            Congratulations! You Earned {order.coupon_generated.discount_value}% OFF
          </h2>
          <p className="mt-1 text-xs text-[#542B24]/70 max-w-md mx-auto">
            As a thank-you for curating a customized hamper, here is your exclusive discount code for your next order!
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <div className="rounded-xl border-2 border-[#9B4A32] bg-white px-5 py-2.5 font-mono text-lg font-black tracking-widest text-[#9B4A32] shadow-xs">
              {order.coupon_generated.code}
            </div>
            <button
              type="button"
              onClick={() => handleCopyCode(order.coupon_generated.code)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#9B4A32] px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#542B24] transition cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-300" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={14} /> Copy Code
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-[#542B24]/60">
            Valid on minimum cart value of ₹{order.coupon_generated.minimum_order_amount || 500}
          </p>
        </div>
      )}

      <h2 className="mt-8 text-xl font-semibold">Ordered products</h2>
      <ul className="mt-3 divide-y divide-brand-gold/30 rounded-xl border border-brand-gold/40 bg-white">
        {order.items.map((item, idx) =>
          item.is_hamper ? (
            <li key={idx} className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-red bg-brand-gold/20 px-2 py-0.5 rounded">
                    <Gift size={11} /> Custom Hamper
                  </span>
                  <p className="font-semibold text-brand-charcoal mt-1">
                    {item.box_name} ({item.box_size})
                  </p>
                  <p className="text-xs text-brand-charcoal/70">
                    Packaging: {formatPrice(item.packaging_price)}
                    {item.gift_wrap_price > 0 && ` • Gift Wrap: +${formatPrice(item.gift_wrap_price)}`}
                  </p>
                </div>
                <p className="font-semibold text-brand-red">{formatPrice(item.item_total)}</p>
              </div>

              {/* Sweets list */}
              <div className="mt-2.5 rounded-lg border border-brand-gold/30 bg-brand-cream/40 p-2.5 text-xs">
                <p className="font-bold text-brand-charcoal text-[11px] mb-1">Hamper Contents:</p>
                <ul className="space-y-0.5">
                  {item.items?.map((sweet, sIdx) => (
                    <li key={sIdx} className="flex justify-between text-brand-charcoal/80">
                      <span>{sweet.product_name} ({sweet.variant_weight})</span>
                      <span>Qty: {sweet.quantity} • {formatPrice(sweet.item_total)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {item.customization?.greeting_message && (
                <p className="mt-2 text-xs italic text-brand-charcoal/70">
                  Greeting: &quot;{item.customization.greeting_message}&quot;
                  {item.customization.recipient_name && ` (To: ${item.customization.recipient_name})`}
                </p>
              )}
            </li>
          ) : item.is_bulk ? (
            <li key={`bulk-${item.product_id}-${item.variant_weight}-${idx}`} className="flex items-center justify-between gap-4 p-4">
              <div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                  <Package size={11} /> Bulk Order ({item.discount_percentage}% OFF)
                </span>
                <p className="font-semibold text-brand-charcoal mt-1">{item.product_name}</p>
                <p className="text-sm text-brand-charcoal/70">
                  {item.variant_weight} &middot; {item.quantity} units {item.total_weight_kg ? `(${item.total_weight_kg} kg)` : ''} &middot; {formatPrice(item.unit_price)}/unit
                </p>
                {item.discount_amount > 0 && (
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Original: <span className="line-through">{formatPrice(item.normal_total)}</span> &middot; Saved: {formatPrice(item.discount_amount)}
                  </p>
                )}
              </div>
              <p className="font-semibold text-brand-red">{formatPrice(item.item_total)}</p>
            </li>
          ) : (
            <li key={`${item.product_id}-${item.variant_weight}`} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">{item.product_name}</p>
                <p className="text-sm text-brand-charcoal/70">
                  {item.variant_weight} &middot; {item.quantity} x {formatPrice(item.unit_price)}
                </p>
              </div>
              <p className="font-semibold">{formatPrice(item.item_total)}</p>
            </li>
          )
        )}
      </ul>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
        {order.coupon_discount > 0 && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <dt>Coupon Discount {order.coupon_code ? `(${order.coupon_code})` : ''}</dt>
            <dd>-{formatPrice(order.coupon_discount)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt>Delivery charge</dt>
          <dd>{order.delivery_charge === null ? order.delivery_charge_note : formatPrice(order.delivery_charge)}</dd>
        </div>
        <div className="flex justify-between border-t border-brand-gold/40 pt-2 text-base font-semibold">
          <dt>Total amount</dt>
          <dd className="text-brand-red">{formatPrice(order.total_amount)}</dd>
        </div>
      </dl>
      {order.delivery_charge === null && (
        <p className="mt-1 text-xs text-brand-charcoal/60">The total does not include the delivery charge yet.</p>
      )}

      <h2 className="mt-8 text-xl font-semibold">Delivery address</h2>
      <p className="mt-3 rounded-xl border border-brand-gold/40 bg-white p-4 text-sm leading-relaxed">
        <span className="font-semibold">{address.full_name}</span>
        <br />
        {address.house_number}, {address.street}, {address.area}
        <br />
        {address.city}, {address.state} - {address.pincode}
        {address.landmark && (
          <>
            <br />
            Landmark: {address.landmark}
          </>
        )}
        <br />
        Phone: {address.phone_number}
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/products"
          className="rounded-full bg-brand-red px-6 py-3 font-medium text-white transition-colors hover:bg-brand-saffron"
        >
          Continue Shopping
        </Link>
        <Link
          to="/my-orders"
          className="rounded-full border border-brand-red px-6 py-3 font-medium text-brand-red transition-colors hover:bg-brand-red hover:text-white"
        >
          My Orders
        </Link>
      </div>
    </section>
  )
}
