import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import api from '../services/api'
import { formatDate, formatPrice, getErrorMessage } from '../utils/helpers'

export default function OrderConfirmation() {
  const { id } = useParams() // the :id from /order-confirmation/:id
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

      <h2 className="mt-8 text-xl font-semibold">Ordered products</h2>
      <ul className="mt-3 divide-y divide-brand-gold/30 rounded-xl border border-brand-gold/40 bg-white">
        {order.items.map((item) => (
          <li key={`${item.product_id}-${item.variant_weight}`} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{item.product_name}</p>
              <p className="text-sm text-brand-charcoal/70">
                {item.variant_weight} &middot; {item.quantity} x {formatPrice(item.unit_price)}
              </p>
            </div>
            <p className="font-semibold">{formatPrice(item.item_total)}</p>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <dt>Subtotal</dt>
          <dd>{formatPrice(order.subtotal)}</dd>
        </div>
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
