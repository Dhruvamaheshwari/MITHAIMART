import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Candy,
  Check,
  ChevronDown,
  Clock,
  Minus,
  Plus,
  Share2,
  ShoppingBag,
  Sparkles,
} from 'lucide-react'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import ProductCard from '../components/ProductCard'
import { formatPrice, getErrorMessage, isVariantAvailable } from '../utils/helpers'

function formatWeightLabel(weightStr) {
  if (!weightStr) return ''
  const clean = weightStr.toLowerCase().trim()
  if (clean === '250g' || clean === '250 g' || clean === '250gms') return '250 gms'
  if (clean === '500g' || clean === '500 g' || clean === '500gms') return '500 gms'
  if (clean === '1kg' || clean === '1 kg') return '1 kg'
  if (clean === '1pc' || clean === '1 pc' || clean === '1piece') return '1 Pc'
  if (clean === '2pcs' || clean === '2 pcs') return '2 Pcs'
  return weightStr
}

export default function ProductDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [imageFailed, setImageFailed] = useState(false)
  const [selectedWeight, setSelectedWeight] = useState('')
  const [quantity, setQuantity] = useState(1)
  const { addToCart, updating } = useContext(CartContext)
  const [cartMessage, setCartMessage] = useState(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [categoryNames, setCategoryNames] = useState({})
  const [related, setRelated] = useState([])
  const carouselRef = useRef(null)

  const [openAccordions, setOpenAccordions] = useState({
    ingredients: false,
    allergens: false,
    dietary: false,
    shipping: false,
    returns: false,
  })

  function toggleAccordion(key) {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

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
        const firstAvailable = response.data.variants.find(isVariantAvailable)
        setSelectedWeight(firstAvailable ? firstAvailable.weight : response.data.variants[0]?.weight || '')
        setQuantity(1)
      })
      .catch((err) => {
        if (ignore) return
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

  useEffect(() => {
    if (!product) return
    let ignore = false
    Promise.all([api.get('/categories/'), api.get('/products/', { params: { category_id: product.category_id } })])
      .then(([categoriesResponse, productsResponse]) => {
        if (ignore) return
        setCategoryNames(Object.fromEntries(categoriesResponse.data.map((c) => [c.id, c.name])))
        const others = productsResponse.data.filter(
          (item) => item.id !== product.id && item.variants.some(isVariantAvailable)
        )
        const sameState = others.filter((item) => product.state && item.state === product.state)
        const rest = others.filter((item) => !sameState.includes(item))
        setRelated([...sameState, ...rest].slice(0, 8))
      })
      .catch(() => {
        if (!ignore) setRelated([])
      })
    return () => {
      ignore = true
    }
  }, [product])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center py-24">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-purple-200 border-t-[#8A00C2]" />
          <p className="text-base font-bold text-gray-600">Loading delicious sweets...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center">
        <Link to="/products" className="inline-flex items-center gap-2 text-base font-bold text-[#8A00C2] hover:underline">
          <ArrowLeft size={18} /> Back to all sweets
        </Link>
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 font-semibold">
          {error}
        </p>
      </div>
    )
  }

  const selectedVariant = product.variants.find((v) => v.weight === selectedWeight)
  const canBuy = Boolean(selectedVariant && isVariantAvailable(selectedVariant))

  function chooseWeight(variant) {
    setSelectedWeight(variant.weight)
    setQuantity(1)
    setCartMessage(null)
  }

  function changeQuantity(newQuantity) {
    if (!selectedVariant || !Number.isInteger(newQuantity)) return
    setQuantity(Math.min(Math.max(newQuantity, 1), selectedVariant.stock))
    setCartMessage(null)
  }

  async function addSelectedToCart() {
    if (!selectedVariant) return { ok: false }
    setCartMessage(null)
    const result = await addToCart(product.id, selectedVariant.weight, quantity)
    if (result.ok) {
      setCartMessage({ ok: true, text: `Added ${quantity} × ${selectedVariant.weight} to your cart.` })
    } else {
      setCartMessage({ ok: false, text: result.message || 'Could not add to cart' })
    }
    return result
  }

  async function handleBuyNow() {
    const result = await addSelectedToCart()
    if (result.ok) navigate('/cart')
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    })
  }

  function scrollCarousel(direction) {
    if (!carouselRef.current) return
    const offset = direction === 'left' ? -340 : 340
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  const categoryName = categoryNames[product.category_id] || 'Sweets'

  return (
    <div className="bg-white pb-20">
      {/* Breadcrumb Navigation */}
      <div className="border-b border-[#E8D5B5] bg-[#FFF8EC]">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs sm:text-sm text-[#542B24]/70 lg:px-8">
          <Link to="/" className="text-[#542B24] hover:text-[#9B4A32] font-semibold transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            to={`/products?category_id=${product.category_id}`}
            className="text-[#542B24] hover:text-[#9B4A32] font-semibold transition-colors"
          >
            {categoryName}
          </Link>
          <span>/</span>
          <span className="font-bold text-[#9B4A32] truncate">{product.name}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-12 items-start">
          {/* Left Column: Big Product Image Card */}
          <div className="lg:col-span-6 sticky top-28">
            <div className="relative overflow-hidden rounded-2xl border border-[#E8D5B5] bg-gradient-to-b from-[#FFF8EC] to-[#E8D5B5]/25 shadow-sm group">
              <div className="aspect-square w-full overflow-hidden">
                {product.image_url && !imageFailed ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#FFF8EC] to-[#E8D5B5]/40 text-[#9B4A32]/40">
                    <Candy size={72} className="animate-float text-[#9B4A32]" />
                    <span className="mt-3 text-xs font-bold uppercase tracking-wider text-[#542B24]/50">MithaiMart Artisanal Sweets</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                title="Share product link"
                className="absolute top-3.5 right-3.5 rounded-full bg-[#FFF8EC]/90 p-2.5 text-[#542B24] shadow-xs backdrop-blur-xs transition-all hover:text-[#9B4A32] hover:bg-white hover:scale-105 active:scale-95 border border-[#E8D5B5]"
              >
                {linkCopied ? <Check size={18} className="text-emerald-700 animate-bounce" /> : <Share2 size={18} />}
              </button>

              {product.state && (
                <div className="absolute bottom-4 left-4 rounded-full bg-[#FFF8EC]/95 backdrop-blur-xs px-3.5 py-1 text-xs font-bold text-[#542B24] shadow-2xs border border-[#E8D5B5] flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#C99A42]" />
                  <span>Authentic • {product.state}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center gap-2">
              <span className="h-2 w-7 rounded-full bg-[#9B4A32] shadow-2xs" />
              <span className="h-2 w-2 rounded-full bg-[#E8D5B5]" />
              <span className="h-2 w-2 rounded-full bg-[#E8D5B5]" />
            </div>
          </div>

          {/* Right Column: Product Info & Purchase (Balanced Medium Typography) */}
          <div className="lg:col-span-6 flex flex-col">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#542B24] leading-tight tracking-tight">
              {product.name}
            </h1>

            <p className="mt-1.5 text-xs sm:text-sm font-semibold text-[#9B4A32] flex items-center gap-2">
              <span>{categoryName}</span>
              <span>•</span>
              <span className="text-[#542B24]/70 font-medium">{product.state || 'Traditional Indian Confectionery'}</span>
            </p>

            {/* Price (Medium balanced size) */}
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-extrabold text-[#9B4A32] tracking-tight">
                {selectedVariant ? formatPrice(selectedVariant.price) : 'Unavailable'}
              </span>
              <span className="text-xs text-[#542B24]/60">Inclusive of all taxes</span>
            </div>

            {/* Shelf Life & Desi Ghee Badges */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8EC] px-3 py-1 text-xs font-semibold text-[#9B4A32] border border-[#E8D5B5]">
                <Clock size={13} className="text-[#9B4A32]" />
                <span>Shelf life before 15 days</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8EC] px-3 py-1 text-xs font-semibold text-[#542B24] border border-[#C99A42]">
                <Sparkles size={13} className="text-[#C99A42]" />
                <span>100% Pure Desi Ghee</span>
              </div>
            </div>

            {/* Weight Selection Options (Radio Pills) */}
            <div className="mt-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#542B24]/70 mb-2">
                Select Weight:
              </label>
              <div className="flex flex-wrap gap-2.5">
                {product.variants.map((variant) => {
                  const isSelected = variant.weight === selectedWeight
                  const available = isVariantAvailable(variant)
                  return (
                    <button
                      key={variant.weight}
                      type="button"
                      onClick={() => chooseWeight(variant)}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-95 ${
                        isSelected
                          ? 'border-2 border-[#542B24] bg-[#FFF8EC] text-[#542B24] shadow-xs ring-1 ring-[#C99A42]'
                          : available
                          ? 'border border-[#E8D5B5] bg-white text-[#542B24] hover:border-[#9B4A32] hover:bg-[#E8D5B5]/30'
                          : 'border border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed line-through'
                      }`}
                    >
                      <span
                        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                          isSelected ? 'border-[#542B24] bg-[#542B24]' : 'border-[#E8D5B5]'
                        }`}
                      >
                        {isSelected && <span className="h-1 w-1 rounded-full bg-white" />}
                      </span>
                      <span>{formatWeightLabel(variant.weight)}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Quantity Selector + Action Buttons */}
            {canBuy ? (
              <div className="mt-7 space-y-4">
                <div className="flex items-center gap-3.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#542B24]/70">Quantity:</span>
                  <div className="inline-flex items-center rounded-full border border-[#E8D5B5] bg-white shadow-2xs">
                    <button
                      type="button"
                      onClick={() => changeQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                      aria-label="Decrease quantity"
                      className="flex h-9 w-9 items-center justify-center text-[#542B24] hover:text-[#9B4A32] transition-colors disabled:opacity-30 active:scale-90"
                    >
                      <Minus size={15} />
                    </button>
                    <span className="w-9 text-center text-sm font-bold text-[#542B24]">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQuantity(quantity + 1)}
                      disabled={quantity >= selectedVariant.stock}
                      aria-label="Increase quantity"
                      className="flex h-9 w-9 items-center justify-center text-[#542B24] hover:text-[#9B4A32] transition-colors disabled:opacity-30 active:scale-90"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                  <span className="text-xs font-medium text-[#542B24]/60">
                    ({selectedVariant.stock} fresh packs in stock)
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    type="button"
                    onClick={addSelectedToCart}
                    disabled={updating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FFF8EC] border-2 border-[#E8D5B5] py-3.5 px-6 font-bold text-xs sm:text-sm text-[#542B24] shadow-xs transition-all duration-200 hover:bg-[#9B4A32] hover:text-white hover:border-[#9B4A32] active:scale-95 disabled:opacity-50"
                  >
                    <ShoppingBag size={18} />
                    <span>{updating ? 'Adding...' : 'Add to Cart'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleBuyNow}
                    disabled={updating}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#9B4A32] py-3.5 px-6 font-bold text-xs sm:text-sm text-white shadow-md transition-all duration-200 hover:bg-[#542B24] active:scale-95 disabled:opacity-50"
                  >
                    <span>Buy Now</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-7 rounded-xl bg-[#FFF8EC] border border-[#E8D5B5] p-5 text-center">
                <p className="font-bold text-[#542B24] text-sm">Currently Out of Stock</p>
                <p className="mt-0.5 text-xs text-[#542B24]/60">This weight option is being freshly prepared. Check back soon!</p>
              </div>
            )}

            {cartMessage && (
              <div
                className={`mt-4 flex items-center justify-between rounded-xl p-3.5 text-xs font-bold animate-fade-in ${
                  cartMessage.ok
                    ? 'border border-[#C99A42] bg-[#FFF8EC] text-[#9B4A32]'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  {cartMessage.ok && <Check size={16} className="text-[#9B4A32]" />} {cartMessage.text}
                </span>
                {cartMessage.ok && (
                  <Link to="/cart" className="font-bold underline ml-2 hover:text-[#542B24]">
                    View Cart
                  </Link>
                )}
              </div>
            )}

            {product.description && (
              <p className="mt-6 text-xs sm:text-sm text-[#542B24]/80 leading-relaxed border-t border-[#E8D5B5] pt-5">
                {product.description}
              </p>
            )}

            {/* Accordion Sections with Warm Terracotta Icons */}
            <div className="mt-6 border-t border-[#E8D5B5] divide-y divide-[#E8D5B5]/60">
              <div className="py-3.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion('ingredients')}
                  className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-[#542B24] hover:text-[#9B4A32] transition-colors"
                >
                  <span>Ingredients</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF8EC] border border-[#E8D5B5] text-[#9B4A32] transition-transform duration-200 ${openAccordions.ingredients ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                {openAccordions.ingredients && (
                  <div className="mt-2.5 text-xs text-[#542B24]/70 leading-relaxed pr-6 animate-fade-in font-medium">
                    Fine Roasted Gram Flour (Besan), Pure Clarified Butter (Desi Ghee), Sugar, Cardamom Powder, Roasted Pistachio and Almond Flakes. No artificial flavors or coloring.
                  </div>
                )}
              </div>

              <div className="py-3.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion('allergens')}
                  className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-[#542B24] hover:text-[#9B4A32] transition-colors"
                >
                  <span>Allergen Information</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF8EC] border border-[#E8D5B5] text-[#9B4A32] transition-transform duration-200 ${openAccordions.allergens ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                {openAccordions.allergens && (
                  <div className="mt-2.5 text-xs text-[#542B24]/70 leading-relaxed pr-6 animate-fade-in font-medium">
                    Contains Milk solids (Pure Desi Ghee) and Tree Nuts (Almonds, Pistachios). Processed in an authentic confectionery facility that also processes wheat, sesame, and other nuts.
                  </div>
                )}
              </div>

              <div className="py-3.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion('dietary')}
                  className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-[#542B24] hover:text-[#9B4A32] transition-colors"
                >
                  <span>Dietary Information</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF8EC] border border-[#E8D5B5] text-[#9B4A32] transition-transform duration-200 ${openAccordions.dietary ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                {openAccordions.dietary && (
                  <div className="mt-2.5 text-xs text-[#542B24]/70 leading-relaxed pr-6 animate-fade-in font-medium">
                    100% Vegetarian (Pure Veg). Prepared in accordance with traditional Indian culinary standards without artificial preservatives or animal gelatin.
                  </div>
                )}
              </div>

              <div className="py-3.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion('shipping')}
                  className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-[#542B24] hover:text-[#9B4A32] transition-colors"
                >
                  <span>Shipping & Delivery</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF8EC] border border-[#E8D5B5] text-[#9B4A32] transition-transform duration-200 ${openAccordions.shipping ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                {openAccordions.shipping && (
                  <div className="mt-2.5 text-xs text-[#542B24]/70 leading-relaxed pr-6 animate-fade-in font-medium">
                    Dispatched within 24 hours of ordering. Sealed in tamper-evident food-grade nitrogen-flushed packaging to retain maximum freshness. Pan-India express courier delivery in 2-4 business days.
                  </div>
                )}
              </div>

              <div className="py-3.5">
                <button
                  type="button"
                  onClick={() => toggleAccordion('returns')}
                  className="flex w-full items-center justify-between text-left text-xs sm:text-sm font-bold text-[#542B24] hover:text-[#9B4A32] transition-colors"
                >
                  <span>Return & Refund</span>
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF8EC] border border-[#E8D5B5] text-[#9B4A32] transition-transform duration-200 ${openAccordions.returns ? 'rotate-180' : ''}`}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                {openAccordions.returns && (
                  <div className="mt-2.5 text-xs text-[#542B24]/70 leading-relaxed pr-6 animate-fade-in font-medium">
                    As sweets are perishable food products, returns are accepted within 24 hours of receipt in the rare event of damaged transit or spoiled packaging. Please contact customer care at contact@mithaimart.com.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Suggestions Carousel */}
        {related.length > 0 && (
          <div className="mt-16 border-t border-[#E8D5B5] pt-12">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-sans text-xl sm:text-2xl font-bold text-[#542B24] tracking-tight">
                  You might also like these
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#542B24]/70 mt-0.5">Handpicked traditional delicacies you'll love</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E8D5B5] bg-[#FFF8EC] text-[#542B24] hover:bg-[#E8D5B5]/50 transition-transform active:scale-95 shadow-2xs"
                  aria-label="Previous suggestions"
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9B4A32] text-white hover:bg-[#542B24] transition-transform active:scale-95 shadow-2xs"
                  aria-label="Next suggestions"
                >
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>

            <div
              ref={carouselRef}
              className="flex gap-4 overflow-x-auto pb-3 scroll-smooth no-scrollbar"
              style={{ scrollSnapType: 'x mandatory' }}
            >
              {related.map((item) => (
                <div key={item.id} className="w-60 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <ProductCard product={item} categoryName={categoryNames[item.category_id]} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
