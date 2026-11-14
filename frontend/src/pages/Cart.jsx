import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { Candy } from 'lucide-react'
import { CartContext } from '../context/CartContext'
import { formatPrice } from '../utils/helpers'

// Small picture for one cart row. Shows an icon if the image is missing or broken.
function CartImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-brand-gold/40 bg-brand-cream">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-brand-gold">
          <Candy size={28} />
        </div>
      )}
    </div>
  )
}

export default function Cart() {
  const { cartItems, cartTotal, cartCount, loading, updating, loadError, updateQuantity, removeFromCart, clearCart } =
    useContext(CartContext)
  const [message, setMessage] = useState('') // error from the backend, e.g. "Only 5 available."

  // Every action asks the backend first. We only show a message if the backend refuses.
  async function runAction(action) {
    setMessage('')
    const result = await action()
    if (!result.ok) setMessage(result.message)
  }

  function handleClearCart() {
    if (window.confirm('Remove all items from your cart?')) runAction(clearCart)
  }

  const hasUnavailableItems = cartItems.some((item) => !item.available)

  if (loading) {
    return <p className="py-20 text-center text-brand-charcoal/70">Loading your cart...</p>
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">Your Cart</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      {loadError && (
        <p className="mt-6 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">
          {loadError}
        </p>
      )}

      {!loadError && cartItems.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-brand-gold/60 p-10 text-center">
          <p className="text-brand-charcoal/70">Your cart is empty.</p>
          <Link
            to="/products"
            className="mt-4 inline-block rounded-full bg-brand-red px-6 py-2 text-white transition-colors hover:bg-brand-saffron"
          >
            Continue Shopping
          </Link>
        </div>
      )}

      {cartItems.length > 0 && (
        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <ul className="space-y-4 lg:col-span-2">
            {cartItems.map((item) => (
              <li
                key={`${item.product_id}-${item.variant_weight}`}
                className="flex gap-4 rounded-xl border border-brand-gold/40 bg-white p-4"
              >
                <CartImage src={item.product_image} alt={item.product_name} />

                <div className="flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link to={`/products/${item.product_id}`} className="font-display text-lg font-semibold hover:text-brand-red">
                        {item.product_name}
                      </Link>
                      <p className="text-sm text-brand-charcoal/70">
                        {item.variant_weight} &middot; {formatPrice(item.variant_price)} each
                      </p>
                    </div>
                    <p className="font-semibold text-brand-red">{formatPrice(item.item_total)}</p>
                  </div>

                  {!item.available && (
                    <p className="mt-2 text-sm text-brand-red">
                      {item.stock > 0
                        ? `Only ${item.stock} left. Please lower the quantity.`
                        : 'This item is no longer available. Please remove it.'}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Quantity can not go below 1 or above the stock.
                        If stock dropped below the quantity, "-" jumps straight down to the stock. */}
                    <div className="inline-flex items-center rounded-full border border-brand-gold/60">
                      <button
                        type="button"
                        disabled={updating || item.quantity <= 1 || item.stock === 0}
                        onClick={() => runAction(() => updateQuantity(item.product_id, item.variant_weight, Math.min(item.quantity - 1, item.stock)))}
                        aria-label={`Decrease quantity of ${item.product_name}`}
                        className="h-9 w-9 disabled:opacity-40"
                      >
                        -
                      </button>
                      <span className="w-9 text-center font-medium">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={updating || item.quantity >= item.stock}
                        onClick={() => runAction(() => updateQuantity(item.product_id, item.variant_weight, item.quantity + 1))}
                        aria-label={`Increase quantity of ${item.product_name}`}
                        className="h-9 w-9 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={updating}
                      onClick={() => runAction(() => removeFromCart(item.product_id, item.variant_weight))}
                      className="text-sm text-brand-charcoal/70 underline hover:text-brand-red disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-xl border border-brand-gold/40 bg-brand-cream p-6">
            <h2 className="text-xl font-semibold">Order Summary</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt>Total quantity</dt>
                <dd>{cartCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatPrice(cartTotal)}</dd>
              </div>
              <div className="flex justify-between border-t border-brand-gold/40 pt-2 text-base font-semibold">
                <dt>Grand total</dt>
                <dd className="text-brand-red">{formatPrice(cartTotal)}</dd>
              </div>
            </dl>

            {hasUnavailableItems && (
              <p className="mt-4 text-sm text-brand-red">Fix the items marked above before checkout.</p>
            )}
            {message && (
              <p role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-white p-3 text-sm text-brand-red">
                {message}
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3">
              {hasUnavailableItems ? (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-full bg-brand-red px-6 py-3 font-medium text-white opacity-50"
                >
                  Proceed to Checkout
                </button>
              ) : (
                <Link
                  to="/checkout"
                  className="rounded-full bg-brand-red px-6 py-3 text-center font-medium text-white transition-colors hover:bg-brand-saffron"
                >
                  Proceed to Checkout
                </Link>
              )}
              <Link
                to="/products"
                className="rounded-full border border-brand-red px-6 py-3 text-center font-medium text-brand-red transition-colors hover:bg-brand-red hover:text-white"
              >
                Continue Shopping
              </Link>
              <button
                type="button"
                disabled={updating}
                onClick={handleClearCart}
                className="text-sm text-brand-charcoal/70 underline hover:text-brand-red disabled:opacity-40"
              >
                Clear Cart
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
