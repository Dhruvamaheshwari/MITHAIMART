import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, Gift, Tag, Trash2, X } from 'lucide-react'
import AddressForm from '../components/AddressForm'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import { formatPrice, getErrorMessage } from '../utils/helpers'

export default function Checkout() {
  // Cart data comes from the backend (through the Cart Context)
  const { cartItems, cartTotal, cartCount, loading: cartLoading, refreshCart } = useContext(CartContext)
  const navigate = useNavigate()

  const [addresses, setAddresses] = useState([])
  const [addressesLoading, setAddressesLoading] = useState(true)
  const [addressesError, setAddressesError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [showForm, setShowForm] = useState(false)

  const [placing, setPlacing] = useState(false) // true while the order request is running
  const placingRef = useRef(false) // blocks a second click even before React re-renders
  const [result, setResult] = useState(null) // error to show: { message, problems? }

  // Coupon state
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState(null)
  const [couponLoading, setCouponLoading] = useState(false)
  const [couponError, setCouponError] = useState('')

  async function handleApplyCoupon(e) {
    if (e) e.preventDefault()
    if (!couponInput.trim()) return
    setCouponLoading(true)
    setCouponError('')
    try {
      const res = await api.post('/coupons/validate/', { code: couponInput.trim() })
      setAppliedCoupon(res.data)
      setCouponError('')
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Invalid or expired coupon code.'
      setCouponError(errMsg)
      setAppliedCoupon(null)
    } finally {
      setCouponLoading(false)
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null)
    setCouponInput('')
    setCouponError('')
  }

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

  // Place Order. We send ONLY the address id. The backend takes the cart, prices and stock from
  // MongoDB, calculates the total itself, saves the order and empties the cart.
  async function handlePlaceOrder() {
    // A second click (double click) while the first request is running does nothing
    if (placingRef.current) return
    setResult(null)
    if (cartItems.length === 0) {
      setResult({ message: 'Your cart is empty.' })
      return
    }
    if (!selectedId) {
      setResult({ message: 'Please select a delivery address.' })
      return
    }

    placingRef.current = true
    setPlacing(true)
    try {
      const response = await api.post('/orders/create/', {
        address_id: selectedId,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
      })
      // Success: open the confirmation page. It loads the order from the backend by its id.
      navigate(`/order-confirmation/${response.data.id}`)
      refreshCart() // the backend emptied the cart, so update the Navbar count
    } catch (err) {
      const data = err.response && err.response.data
      setResult({ message: (data && data.error) || getErrorMessage(err), problems: data && data.problems })
      refreshCart() // stock or cart may have changed, so show the latest data
    } finally {
      placingRef.current = false
      setPlacing(false)
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
            {cartItems.map((item) =>
              item.is_hamper ? (
                <li key={`hamper-${item.hamper_id}`} className="py-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-red">
                    <Gift size={12} /> Custom Mithai Hamper
                  </div>
                  <p className="font-semibold text-brand-charcoal">{item.box_name} ({item.box_size})</p>
                  <p className="text-xs text-brand-charcoal/70">
                    Includes {item.items?.length || 0} sweets
                    {item.gift_wrap_price > 0 && ' • Festive Gift Wrapping'}
                  </p>
                  <p className="text-right font-semibold text-brand-red">{formatPrice(item.item_total)}</p>
                  {!item.available && <p className="text-brand-red text-xs">This hamper needs attention.</p>}
                </li>
              ) : (
                <li key={`${item.product_id}-${item.variant_weight}`} className="py-3">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-brand-charcoal/70">
                    {item.variant_weight} &middot; {item.quantity} x {formatPrice(item.variant_price)}
                  </p>
                  <p className="text-right font-semibold">{formatPrice(item.item_total)}</p>
                  {!item.available && <p className="text-brand-red">This item needs attention. Check your cart.</p>}
                </li>
              )
            )}
          </ul>

          {/* Coupon Code Section */}
          <div className="mt-4 border-t border-brand-gold/40 pt-4">
            <label className="block text-xs font-bold text-brand-charcoal mb-1.5 flex items-center gap-1.5">
              <Tag size={13} className="text-brand-saffron" /> Have a Discount Coupon?
            </label>
            {appliedCoupon ? (
              <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600" />
                  <span>
                    <b>{appliedCoupon.code}</b> ({formatPrice(appliedCoupon.discount_amount)} OFF)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveCoupon}
                  className="text-emerald-700 hover:text-red-600 transition p-1"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="e.g. HAMPER10-XXXX"
                  className="w-full rounded-full border border-brand-gold/40 bg-white px-3.5 py-1.5 text-xs uppercase outline-none focus:border-brand-red"
                />
                <button
                  type="submit"
                  disabled={couponLoading || !couponInput.trim()}
                  className="rounded-full bg-brand-charcoal px-4 py-1.5 text-xs font-bold text-white hover:bg-brand-red transition disabled:opacity-50 cursor-pointer"
                >
                  {couponLoading ? '...' : 'Apply'}
                </button>
              </form>
            )}
            {couponError && <p className="mt-1 text-[11px] text-red-600 font-medium">{couponError}</p>}
          </div>

          <dl className="mt-4 space-y-2 border-t border-brand-gold/40 pt-4 text-sm">
            <div className="flex justify-between">
              <dt>Total quantity</dt>
              <dd>{cartCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatPrice(cartTotal)}</dd>
            </div>
            {appliedCoupon && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <dt>Coupon Discount ({appliedCoupon.code})</dt>
                <dd>-{formatPrice(appliedCoupon.discount_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>Delivery charge</dt>
              <dd>To be confirmed</dd>
            </div>
            <div className="flex justify-between border-t border-brand-gold/40 pt-2 text-base font-semibold">
              <dt>Final total</dt>
              <dd className="text-brand-red">
                {formatPrice(Math.max(0, cartTotal - (appliedCoupon?.discount_amount || 0)))}
              </dd>
            </div>
          </dl>
          <p className="mt-1 text-xs text-brand-charcoal/60">The final total does not include delivery yet.</p>

          <button
            type="button"
            onClick={handlePlaceOrder}
            disabled={placing}
            className="mt-6 w-full rounded-full bg-brand-red px-6 py-3 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60"
          >
            {placing ? 'Placing your order...' : 'Place Order'}
          </button>
          <Link to="/cart" className="mt-3 block text-center text-sm underline hover:text-brand-red">
            Back to cart
          </Link>

          {result && (
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
        </aside>
      </div>
    </section>
  )
}
