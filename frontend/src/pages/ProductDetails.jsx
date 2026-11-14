import { useContext, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Candy } from 'lucide-react'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import { formatPrice, getErrorMessage, isVariantAvailable } from '../utils/helpers'

export default function ProductDetails() {
  const { id } = useParams() // the :id from the URL /products/:id
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [selectedWeight, setSelectedWeight] = useState('')
  const [quantity, setQuantity] = useState(1)
  const { addToCart, updating } = useContext(CartContext)
  const [cartMessage, setCartMessage] = useState(null) // { ok, text } shown after Add to Cart

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setError('')
    setProduct(null)
    setImageFailed(false)
    setCartMessage(null)
    api
      .get(`/products/${id}/`)
      .then((response) => {
        if (ignore) return
        setProduct(response.data)
        // Start with the first variant that can be bought
        const firstAvailable = response.data.variants.find(isVariantAvailable)
        setSelectedWeight(firstAvailable ? firstAvailable.weight : '')
        setQuantity(1)
      })
      .catch((err) => {
        if (ignore) return
        // The backend answers 400 for a malformed id and 404 for an unknown id
        const status = err.response && err.response.status
        setError(status === 400 || status === 404 ? 'This product was not found.' : getErrorMessage(err))
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id])

  const backLink = (
    <Link to="/products" className="text-sm text-brand-saffron hover:underline">
      &larr; Back to all sweets
    </Link>
  )

  if (loading) {
    return <p className="py-20 text-center text-brand-charcoal/70">Loading product...</p>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        {backLink}
        <p className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">
          {error}
        </p>
      </div>
    )
  }

  const selectedVariant = product.variants.find((variant) => variant.weight === selectedWeight)

  function chooseVariant(variant) {
    setSelectedWeight(variant.weight)
    setQuantity(1) // a new weight has its own stock, so start again from 1
    setCartMessage(null)
  }

  // Sends only the product id, weight and quantity. The backend looks up the real price and stock.
  async function handleAddToCart() {
    if (!selectedVariant) return // no valid variant chosen, so nothing is sent
    setCartMessage(null)
    const result = await addToCart(product.id, selectedVariant.weight, quantity)
    if (result.ok) {
      setCartMessage({ ok: true, text: `Added ${quantity} x ${product.name} (${selectedVariant.weight}) to your cart.` })
      setQuantity(1)
    } else {
      setCartMessage({ ok: false, text: result.message })
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      {backLink}

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-xl border border-brand-gold/40 bg-brand-cream">
          {product.image_url && !imageFailed ? (
            <img
              src={product.image_url}
              alt={product.name}
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-brand-gold">
              <Candy size={96} strokeWidth={1.25} />
            </div>
          )}
        </div>

        <div>
          <h1 className="text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
          <p className="mt-4 whitespace-pre-line text-brand-charcoal/80">{product.description}</p>

          <h2 className="mt-8 text-lg font-semibold">Choose weight</h2>
          <ul className="mt-3 space-y-2">
            {product.variants.map((variant) => {
              const available = isVariantAvailable(variant)
              const selected = variant.weight === selectedWeight
              return (
                <li key={variant.weight}>
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => chooseVariant(variant)}
                    aria-pressed={selected}
                    className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                      selected
                        ? 'border-brand-red bg-brand-red/5'
                        : 'border-brand-gold/50 hover:border-brand-red'
                    } ${available ? '' : 'cursor-not-allowed opacity-50'}`}
                  >
                    <span>
                      <span className="font-medium">{variant.weight}</span>
                      <span className="ml-3 text-sm text-brand-charcoal/70">
                        {available ? `${variant.stock} in stock` : 'Out of stock'}
                      </span>
                    </span>
                    <span className="font-semibold text-brand-red">{formatPrice(variant.price)}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          {/* Quantity cannot go below 1 or above the stock of the chosen weight. No cart yet. */}
          {selectedVariant ? (
            <div className="mt-6">
              <p className="text-sm font-medium">Quantity</p>
              <div className="mt-2 flex items-center gap-4">
                <div className="inline-flex items-center rounded-full border border-brand-gold/60">
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity - 1)}
                    disabled={quantity <= 1}
                    aria-label="Decrease quantity"
                    className="h-10 w-10 text-lg disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="w-10 text-center font-medium" aria-live="polite">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity(quantity + 1)}
                    disabled={quantity >= selectedVariant.stock}
                    aria-label="Increase quantity"
                    className="h-10 w-10 text-lg disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <p className="text-brand-charcoal/80">
                  Total: <span className="font-semibold text-brand-red">{formatPrice(selectedVariant.price * quantity)}</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                disabled={updating}
                className="mt-6 w-full rounded-full bg-brand-red px-6 py-3 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60 sm:w-auto"
              >
                {updating ? 'Adding...' : 'Add to Cart'}
              </button>
            </div>
          ) : (
            <p className="mt-6 rounded-lg bg-brand-cream p-4 text-brand-charcoal/80">
              This product is currently unavailable.
            </p>
          )}

          {cartMessage && (
            <p
              role="status"
              className={`mt-4 rounded-lg border p-3 text-sm ${
                cartMessage.ok
                  ? 'border-brand-gold/60 bg-brand-cream text-brand-charcoal'
                  : 'border-brand-red/40 bg-brand-red/5 text-brand-red'
              }`}
            >
              {cartMessage.text}{' '}
              {cartMessage.ok && (
                <Link to="/cart" className="font-semibold text-brand-red underline">
                  View cart
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
