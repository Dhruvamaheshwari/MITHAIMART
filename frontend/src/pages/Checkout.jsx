import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AddressForm from '../components/AddressForm'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import { formatPrice, getErrorMessage } from '../utils/helpers'

export default function Checkout() {
  // Cart data comes from the backend (through the Cart Context)
  const { cartItems, cartTotal, cartCount, loading: cartLoading } = useContext(CartContext)

  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [checking, setChecking] = useState(false) // true while the backend validates
  const [result, setResult] = useState(null) // { ok, message, problems?, data? }

  // Load saved addresses and pre-select the default one (the backend lists it first)
  function loadAddresses(selectThisId) {
    return api
      .get('/addresses/')
      .then((response) => {
        setAddresses(response.data)
        setAddressesError('')
        setSelectedId(selectThisId || (response.data.length > 0 ? response.data[0].id : ''))
      })
      .catch((err) => setAddressesError(getErrorMessage(err)))
      .finally(() => setAddressesLoading(false))
  }

  useEffect(() => {
    loadAddresses()
  }, [])

  // A new address was saved from the form: reload the list and select it
  function handleAddressSaved(savedAddress) {
    setShowForm(false)
    setResult(null)
    loadAddresses(savedAddress.id)
  }

  // Place Order (preparation only). The backend re-checks cart, address, prices and stock.
  // No order is created and the cart is not changed in this phase.
  async function handlePlaceOrder() {
    setResult(null)
    if (cartItems.length === 0) {
      setResult({ ok: false, message: 'Your cart is empty.' })
      return
    }
    if (!selectedId) {
      setResult({ ok: false, message: 'Please select a delivery address.' })
      return
    }

    setChecking(true)
    try {
      const response = await api.post('/checkout/validate/', { address_id: selectedId })
      setResult({ ok: true, data: response.data })
    } catch (err) {
      const data = err.response && err.response.data
      setResult({ ok: false, message: (data && data.error) || getErrorMessage(err), problems: data && data.problems })
    } finally {
      setChecking(false)
    }
  }

  if (cartLoading) {
    return <p className="py-20 text-center text-brand-charcoal/70">Loading checkout...</p>
  }

  if (cartItems.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-16 text-center">
        <h1 className="text-3xl font-semibold">Checkout</h1>
        <p className="mt-4 text-brand-charcoal/70">Your cart is empty. Add some sweets before checking out.</p>
        <Link
          to="/products"
          className="mt-6 inline-block rounded-full bg-brand-red px-6 py-2 text-white transition-colors hover:bg-brand-saffron"
        >
          Continue Shopping
        </Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Checkout</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* Left side: delivery address */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold">Delivery address</h2>

          {addressesLoading && <p className="mt-4 text-brand-charcoal/70">Loading addresses...</p>}
          {addressesError && (
            <p className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/5 p-3 text-brand-red">{addressesError}</p>
          )}
          {!addressesLoading && !addressesError && addresses.length === 0 && !showForm && (
            <p className="mt-4 rounded-lg border border-dashed border-brand-gold/60 p-6 text-center text-brand-charcoal/70">
              You have no saved address yet. Please add one.
            </p>
          )}

          <ul className="mt-4 space-y-3">
            {addresses.map((address) => (
              <li key={address.id}>
                <label
                  className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${
                    selectedId === address.id ? 'border-brand-red bg-brand-red/5' : 'border-brand-gold/40 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="delivery-address"
                    checked={selectedId === address.id}
                    onChange={() => {
                      setSelectedId(address.id)
                      setResult(null)
                    }}
                    className="mt-1"
                  />
                  <span className="text-sm">
                    <span className="font-semibold">{address.full_name}</span>
                    {address.is_default && (
                      <span className="ml-2 rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs font-semibold">Default</span>
                    )}
                    <br />
                    {address.house_number}, {address.street}, {address.area}, {address.city}, {address.state} -{' '}
                    {address.pincode}
                    {address.landmark && <> (Landmark: {address.landmark})</>}
                    <br />
                    Phone: {address.phone_number}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {showForm ? (
            <div className="mt-4">
              <AddressForm onSaved={handleAddressSaved} onCancel={() => setShowForm(false)} />
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="rounded-full border border-brand-red px-5 py-2 text-sm font-medium text-brand-red transition-colors hover:bg-brand-red hover:text-white"
              >
                Add new address
              </button>
              <Link to="/addresses" className="text-sm underline hover:text-brand-red">
                Manage addresses
              </Link>
            </div>
          )}
        </div>

        {/* Right side: order summary */}
        <aside className="h-fit rounded-xl border border-brand-gold/40 bg-brand-cream p-6">
          <h2 className="text-xl font-semibold">Order summary</h2>

          <ul className="mt-4 divide-y divide-brand-gold/30 text-sm">
            {cartItems.map((item) => (
              <li key={`${item.product_id}-${item.variant_weight}`} className="py-3">
                <p className="font-medium">{item.product_name}</p>
                <p className="text-brand-charcoal/70">
                  {item.variant_weight} &middot; {item.quantity} x {formatPrice(item.variant_price)}
                </p>
                <p className="text-right font-semibold">{formatPrice(item.item_total)}</p>
                {!item.available && <p className="text-brand-red">This item needs attention. Check your cart.</p>}
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-brand-gold/40 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Total quantity</dt>
              <dd>{cartCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPrice(cartTotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Delivery charge</dt>
              <dd>To be confirmed</dd>
            </div>
            <div className="flex justify-between border-t border-brand-gold/40 pt-2 text-base font-semibold">
              <dt>Final total</dt>
              <dd className="text-brand-red">{formatPrice(cartTotal)}</dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-brand-charcoal/60">The final total does not include delivery yet.</p>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={checking}
            className="mt-6 w-full rounded-full bg-brand-red px-6 py-3 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60"
          >
            {checking ? 'Checking...' : 'Place Order'}
          </button>
          <Link to="/cart" className="mt-3 block text-center text-sm underline hover:text-brand-red">
            Back to cart
          </Link>

          {result && !result.ok && (
            <div role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-white p-3 text-sm text-brand-red">
              <p>{result.message}</p>
              {result.problems && (
                <ul className="mt-2 list-disc pl-5">
                  {result.problems.map((problem) => (
                    <li key={`${problem.product_name}-${problem.variant_weight}`}>
                      {problem.product_name} ({problem.variant_weight}): {problem.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {result && result.ok && (
            <div role="status" className="mt-4 rounded-lg border border-brand-gold/60 bg-white p-3 text-sm">
              <p className="font-semibold">Checkout details are ready for order placement in the next phase.</p>
              <p className="mt-1 text-brand-charcoal/70">
                Confirmed by the server: {result.data.total_quantity} item(s), total{' '}
                {formatPrice(result.data.total)} (delivery: {result.data.delivery_charge_note}). Deliver to{' '}
                {result.data.address.full_name}, {result.data.address.city}. No order has been placed and your cart is
                unchanged.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}
