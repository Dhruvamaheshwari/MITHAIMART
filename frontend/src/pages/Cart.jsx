import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Candy, Gift, Minus, Package, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { CartContext } from '../context/CartContext'
import { formatPrice } from '../utils/helpers'

function CartImage({ src, alt }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]">
      {src && !failed ? (
        <img src={src} alt={alt} onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[#9B4A32]/40">
          <Candy size={28} />
        </div>
      )}
    </div>
  )
}

export default function Cart() {
  const { cartItems, cartTotal, cartCount, loading, updating, loadError, updateQuantity, removeFromCart, clearCart } =
    useContext(CartContext)
  const { user } = useContext(AuthContext)
  const [message, setMessage] = useState('')

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
    return (
      <div className="py-24 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-[#E8D5B5] border-t-[#9B4A32]" />
        <p className="mt-3 text-xs text-[#542B24]/70">Loading your cart...</p>
      </div>
    )
  }

  return (
    <div className="bg-[#FFF8EC]/60 min-h-screen py-10">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#542B24]">Your Shopping Cart</h1>
            <p className="text-xs text-[#542B24]/70 mt-0.5">{cartCount} items ready for dispatch</p>
          </div>
          <Link to="/products" className="text-xs font-bold text-[#9B4A32] hover:text-[#542B24] hover:underline flex items-center gap-1">
            <ArrowLeft size={14} /> Continue Shopping
          </Link>
        </div>

        {loadError && (
          <p className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700">
            {loadError}
          </p>
        )}

        {!loadError && cartItems.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#E8D5B5] bg-white p-14 text-center shadow-2xs">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF8EC] text-[#9B4A32]">
              <ShoppingBag size={28} />
            </div>
            <h2 className="mt-4 font-bold text-[#542B24] text-lg">Your cart is empty</h2>
            <p className="mt-1 text-xs text-[#542B24]/60">Discover our signature fresh sweets, savouries, and luxury gift hampers.</p>
            <Link
              to="/products"
              className="mt-6 inline-block rounded-full bg-[#9B4A32] px-8 py-3 text-xs font-bold text-white shadow-2xs transition hover:bg-[#542B24]"
            >
              Start Shopping
            </Link>
          </div>
        )}

        {cartItems.length > 0 && (
          <div className="grid gap-8 lg:grid-cols-12">
            <ul className="space-y-3.5 lg:col-span-8">
              {cartItems.map((item) =>
                item.is_hamper ? (
                  <li
                    key={`hamper-${item.hamper_id}`}
                    className="rounded-2xl border-2 border-[#C99A42]/50 bg-gradient-to-br from-white to-[#FFF8EC] p-5 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                      <CartImage src={item.product_image} alt={item.product_name} />
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#C99A42]/20 border border-[#C99A42]/40 px-2.5 py-0.5 text-[10px] font-bold text-[#9B4A32] uppercase tracking-wide">
                              <Gift size={11} /> Custom Mithai Hamper
                            </span>
                            <h3 className="font-sans text-base font-bold text-[#542B24] mt-1">
                              {item.box_name} ({item.box_size})
                            </h3>
                            <p className="text-xs text-[#542B24]/70 mt-0.5">
                              Packaging: {formatPrice(item.packaging_price)}
                              {item.gift_wrap_price > 0 && ` • Luxury Gift Wrap: +${formatPrice(item.gift_wrap_price)}`}
                            </p>
                          </div>
                          <p className="text-base font-extrabold text-[#9B4A32]">{formatPrice(item.item_total)}</p>
                        </div>

                        {/* Sweets Breakdown */}
                        <div className="mt-3 rounded-xl border border-[#E8D5B5] bg-white p-3 text-xs">
                          <p className="font-bold text-[11px] uppercase tracking-wider mb-1.5 text-[#9B4A32]">
                            Included Sweets ({item.sweets_count || item.items?.length || 0}):
                          </p>
                          <ul className="space-y-1 divide-y divide-[#E8D5B5]/40">
                            {item.items?.map((sweet, sIdx) => (
                              <li key={sIdx} className="flex justify-between items-center pt-1 text-[#542B24]/90">
                                <span>
                                  {sweet.product_name} <span className="text-[#9B4A32] font-semibold">({sweet.variant_weight})</span>
                                </span>
                                <span className="font-medium text-[11px]">
                                  Qty: {sweet.quantity} • {formatPrice(sweet.item_total)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Customization Details */}
                        {(item.customization?.recipient_name || item.customization?.greeting_message) && (
                          <div className="mt-2.5 rounded-xl border border-dashed border-[#C99A42]/60 bg-[#FFF8EC] px-3 py-2 text-xs">
                            {item.customization.recipient_name && (
                              <p className="font-semibold text-[#542B24]">
                                To: <span className="font-normal">{item.customization.recipient_name}</span>
                                {item.customization.sender_name && <> | From: <span className="font-normal">{item.customization.sender_name}</span></>}
                              </p>
                            )}
                            {item.customization.greeting_message && (
                              <p className="text-[11px] italic text-[#542B24]/70 mt-0.5">
                                &quot;{item.customization.greeting_message}&quot;
                              </p>
                            )}
                          </div>
                        )}

                        {/* Availability Warning */}
                        {!item.available && (
                          <div className="mt-2 text-xs font-semibold text-red-600">
                            {item.problem_reasons?.map((r, rIdx) => (
                              <p key={rIdx}>⚠️ {r}</p>
                            )) || 'Some sweets in this hamper are no longer available.'}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-between border-t border-[#E8D5B5]/60 pt-2.5">
                          <span className="text-xs text-[#542B24]/60">Custom Hamper Quantity: 1</span>
                          <button
                            type="button"
                            disabled={updating}
                            onClick={() => runAction(() => removeFromCart(item.product_id, 'hamper'))}
                            className="flex items-center gap-1 text-xs font-semibold text-[#542B24]/50 hover:text-red-600 transition disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 size={13} /> Remove Hamper
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                ) : (
                  <li
                    key={`${item.product_id}-${item.variant_weight}`}
                    className="flex gap-4 rounded-xl border border-[#E8D5B5] bg-white p-4 shadow-2xs transition hover:shadow-sm"
                  >
                    <CartImage src={item.product_image} alt={item.product_name} />

                    <div className="flex-1 flex flex-col justify-between">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          {item.is_bulk && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#9B4A32]/10 border border-[#9B4A32]/30 px-2 py-0.5 text-[10px] font-bold text-[#9B4A32] uppercase tracking-wide mb-1">
                              <Package size={11} /> Bulk Order {item.discount_percentage > 0 ? `(${item.discount_percentage}% OFF)` : ''}
                            </span>
                          )}
                          <Link
                            to={`/products/${item.product_id}`}
                            className="font-sans text-sm sm:text-base font-bold text-[#542B24] hover:text-[#9B4A32] block"
                          >
                            {item.product_name}
                          </Link>
                          <p className="text-xs font-medium text-[#542B24]/70 mt-0.5">
                            Weight: <span className="text-[#9B4A32] font-semibold">{item.variant_weight}</span> • {formatPrice(item.variant_price)}
                            {item.total_weight_kg ? ` (${item.total_weight_kg} kg)` : ''}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm sm:text-base font-extrabold text-[#9B4A32]">{formatPrice(item.item_total)}</p>
                          {item.is_bulk && item.discount_amount > 0 && (
                            <p className="text-[11px] text-[#542B24]/60">
                              <span className="line-through mr-1 text-gray-400">{formatPrice(item.normal_total)}</span>
                              <span className="text-emerald-700 font-bold">Saved {formatPrice(item.discount_amount)}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {!item.available && (
                        <p className="mt-1.5 text-xs font-semibold text-red-600">
                          {item.stock > 0
                            ? `Only ${item.stock} left in stock. Please reduce quantity.`
                            : 'This weight is currently out of stock.'}
                        </p>
                      )}

                      <div className="mt-3 flex items-center justify-between border-t border-[#E8D5B5]/60 pt-3">
                        <div className="inline-flex items-center rounded-full border border-[#E8D5B5] bg-white">
                          <button
                            type="button"
                            disabled={updating || item.quantity <= 1 || item.stock === 0}
                            onClick={() => runAction(() => updateQuantity(item.product_id, item.variant_weight, Math.min(item.quantity - 1, item.stock)))}
                            aria-label="Decrease quantity"
                            className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32] disabled:opacity-30"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-[#542B24]">{item.quantity}</span>
                          <button
                            type="button"
                            disabled={updating || item.quantity >= item.stock}
                            onClick={() => runAction(() => updateQuantity(item.product_id, item.variant_weight, item.quantity + 1))}
                            aria-label="Increase quantity"
                            className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32] disabled:opacity-30"
                          >
                            <Plus size={13} />
                          </button>
                        </div>

                        <button
                          type="button"
                          disabled={updating}
                          onClick={() => runAction(() => removeFromCart(item.product_id, item.variant_weight))}
                          className="flex items-center gap-1 text-xs font-semibold text-[#542B24]/50 hover:text-red-600 transition disabled:opacity-30"
                        >
                          <Trash2 size={13} /> Remove
                        </button>
                      </div>
                    </div>
                  </li>
                )
              )}
            </ul>

            <aside className="h-fit rounded-2xl border border-[#E8D5B5] bg-[#FFF8EC] p-6 shadow-2xs lg:col-span-4">
              <h2 className="font-sans text-base font-bold text-[#542B24] border-b border-[#E8D5B5] pb-3">
                Order Summary
              </h2>

              <dl className="mt-4 space-y-2.5 text-xs text-[#542B24]/80">
                <div className="flex justify-between">
                  <dt>Items Quantity</dt>
                  <dd className="font-semibold text-[#542B24]">{cartCount}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-semibold text-[#542B24]">{formatPrice(cartTotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Courier Delivery</dt>
                  <dd className="font-semibold text-emerald-700">Calculated at Checkout</dd>
                </div>
                <div className="flex justify-between border-t border-[#E8D5B5] pt-3 text-sm font-bold text-[#542B24]">
                  <dt>Grand Total</dt>
                  <dd className="text-[#9B4A32] font-black text-base">{formatPrice(cartTotal)}</dd>
                </div>
              </dl>

              {hasUnavailableItems && (
                <p className="mt-3 text-xs font-semibold text-red-600">
                  Please resolve the unavailable items above to proceed.
                </p>
              )}
              {message && (
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {message}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                {hasUnavailableItems ? (
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full bg-gray-200 py-3 text-xs font-bold text-gray-400 cursor-not-allowed"
                  >
                    Proceed to Checkout
                  </button>
                ) : (
                  <Link
                    to="/checkout"
                    className="w-full text-center rounded-full bg-[#9B4A32] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#542B24] transition"
                  >
                    {user ? 'Proceed to Checkout' : 'Log in to Checkout'}
                  </Link>
                )}

                <button
                  type="button"
                  disabled={updating}
                  onClick={handleClearCart}
                  className="mt-2 text-center text-xs font-semibold text-[#542B24]/50 hover:text-red-600 transition"
                >
                  Clear Cart
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
