import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  Gift,
  Heart,
  Info,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import { formatPrice } from '../utils/helpers'

export default function BuildHamper() {
  const navigate = useNavigate()
  const { refreshCart } = useContext(CartContext)

  // Remote data
  const [boxes, setBoxes] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [giftWrapPrice, setGiftWrapPrice] = useState(50)
  const [couponThreshold, setCouponThreshold] = useState(1000)
  const [couponDiscountVal, setCouponDiscountVal] = useState(10)

  // User selections
  const [selectedBoxId, setSelectedBoxId] = useState('')
  const [selectedSweets, setSelectedSweets] = useState([]) // [ { product_id, product_name, product_image, variant_weight, quantity, unit_price, grams_per_unit, stock } ]
  const [recipientName, setRecipientName] = useState('')
  const [senderName, setSenderName] = useState('')
  const [greetingMessage, setGreetingMessage] = useState('')
  const [giftWrap, setGiftWrap] = useState(false)

  // Filters for sweets
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedState, setSelectedState] = useState('All')

  // Live estimate from backend
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message }

  // Load initial boxes and products
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [boxRes, prodRes] = await Promise.all([
          api.get('/hamper/boxes/'),
          api.get('/hamper/products/'),
        ])
        const availableBoxes = boxRes.data.boxes || []
        setBoxes(availableBoxes)
        if (availableBoxes.length > 0) {
          // Default to medium if present, else first
          const med = availableBoxes.find((b) => b.code === 'medium') || availableBoxes[0]
          setSelectedBoxId(med.id)
        }
        setGiftWrapPrice(boxRes.data.gift_wrap_price || 50)
        setCouponThreshold(boxRes.data.min_order_amount_for_coupon || 1000)
        setCouponDiscountVal(boxRes.data.coupon_discount_value || 10)
        setProducts(prodRes.data.products || [])
      } catch (err) {
        setFeedback({ type: 'error', message: 'Unable to load hamper builder data. Please try again.' })
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Currently selected box object
  const currentBox = useMemo(() => {
    return boxes.find((b) => b.id === selectedBoxId) || null
  }, [boxes, selectedBoxId])

  // Backend live estimate recalculation
  useEffect(() => {
    if (!selectedBoxId || selectedSweets.length === 0) {
      setEstimate(null)
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      setEstimating(true)
      try {
        const payload = {
          box_id: selectedBoxId,
          items: selectedSweets.map((s) => ({
            product_id: s.product_id,
            variant_weight: s.variant_weight,
            quantity: s.quantity,
          })),
          gift_wrap: giftWrap,
        }
        const res = await api.post('/hamper/estimate/', payload)
        if (isMounted) {
          setEstimate(res.data)
        }
      } catch (err) {
        // Fallback or silence debounce errors
      } finally {
        if (isMounted) setEstimating(false)
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [selectedBoxId, selectedSweets, giftWrap])

  // Client-side quick capacity calculation (re-verified securely by backend)
  const totalUsedGrams = useMemo(() => {
    return selectedSweets.reduce((sum, item) => sum + (item.grams_per_unit || 250) * item.quantity, 0)
  }, [selectedSweets])

  const maxCapacityGrams = currentBox ? currentBox.max_capacity_grams : 1000
  const capacityPct = Math.min(100, Math.round((totalUsedGrams / (maxCapacityGrams || 1)) * 100))
  const isOverCapacity = totalUsedGrams > maxCapacityGrams

  // Unique states for filtering
  const availableStates = useMemo(() => {
    const states = new Set()
    products.forEach((p) => {
      if (p.state) states.add(p.state)
    })
    return ['All', ...Array.from(states).sort()]
  }, [products])

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchState = selectedState === 'All' || p.state === selectedState
      return matchSearch && matchState
    })
  }, [products, searchQuery, selectedState])

  // Sweet addition handler
  function handleAddSweet(product, variant) {
    setFeedback(null)
    setSelectedSweets((prev) => {
      const existingIdx = prev.findIndex(
        (s) => s.product_id === product.id && s.variant_weight === variant.weight
      )
      if (existingIdx > -1) {
        const item = prev[existingIdx]
        if (item.quantity >= variant.stock) return prev // cannot exceed stock
        const updated = [...prev]
        updated[existingIdx] = { ...item, quantity: item.quantity + 1 }
        return updated
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            variant_weight: variant.weight,
            quantity: 1,
            unit_price: variant.price,
            grams_per_unit: variant.grams || 250,
            stock: variant.stock,
          },
        ]
      }
    })
  }

  // Update quantity in selection
  function handleUpdateQuantity(productId, variantWeight, delta) {
    setFeedback(null)
    setSelectedSweets((prev) => {
      return prev
        .map((item) => {
          if (item.product_id === productId && item.variant_weight === variantWeight) {
            const newQty = item.quantity + delta
            if (newQty <= 0) return null
            if (newQty > item.stock) return item
            return { ...item, quantity: newQty }
          }
          return item
        })
        .filter(Boolean)
    })
  }

  // Remove sweet
  function handleRemoveSweet(productId, variantWeight) {
    setFeedback(null)
    setSelectedSweets((prev) =>
      prev.filter((s) => !(s.product_id === productId && s.variant_weight === variantWeight))
    )
  }

  // Quick box upgrade when capacity is exceeded
  function handleUpgradeBox() {
    if (!currentBox) return
    const sorted = [...boxes].sort((a, b) => a.max_capacity_grams - b.max_capacity_grams)
    const nextBox = sorted.find((b) => b.max_capacity_grams > currentBox.max_capacity_grams)
    if (nextBox) {
      setSelectedBoxId(nextBox.id)
    }
  }

  // Add to cart submission
  async function handleAddToCart() {
    setFeedback(null)
    if (!selectedBoxId) {
      setFeedback({ type: 'error', message: 'Please select a gift box size.' })
      return
    }
    if (selectedSweets.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one sweet to your hamper.' })
      return
    }
    if (isOverCapacity) {
      setFeedback({
        type: 'error',
        message: `Box capacity exceeded by ${totalUsedGrams - maxCapacityGrams}g. Please remove items or select a larger box.`,
      })
      return
    }

    setAddingToCart(true)
    try {
      const payload = {
        box_id: selectedBoxId,
        items: selectedSweets.map((s) => ({
          product_id: s.product_id,
          variant_weight: s.variant_weight,
          quantity: s.quantity,
        })),
        customization: {
          recipient_name: recipientName.trim(),
          sender_name: senderName.trim(),
          greeting_message: greetingMessage.trim(),
          gift_wrap: giftWrap,
        },
      }

      await api.post('/hamper/cart/add/', payload)
      await refreshCart()
      setFeedback({
        type: 'success',
        message: 'Your custom hamper has been added to your cart!',
      })
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to add hamper to cart. Please try again.'
      setFeedback({ type: 'error', message: errMsg })
    } finally {
      setAddingToCart(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-[#FFF8EC] min-h-screen py-24 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#E8D5B5] border-t-[#9B4A32]" />
        <p className="mt-4 text-sm font-semibold text-[#542B24]">Loading Hamper Crafting Studio...</p>
      </div>
    )
  }

  const liveTotal = estimate ? estimate.total_estimated_price : 0
  const qualifiesForCoupon = liveTotal >= couponThreshold

  return (
    <div className="min-h-screen bg-[#FFF8EC]/60 pb-20 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb & Hero Header */}
        <div className="mb-8">
          <nav className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#542B24]/60">
            <Link to="/" className="hover:text-[#9B4A32]">Home</Link>
            <span>/</span>
            <span className="text-[#9B4A32]">Customize Your Hamper</span>
          </nav>

          <div className="rounded-3xl border border-[#E8D5B5] bg-gradient-to-r from-[#542B24] to-[#9B4A32] p-6 sm:p-10 text-[#FFF8EC] shadow-md relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C99A42]/20 border border-[#C99A42]/40 px-3.5 py-1 text-xs font-bold text-[#C99A42] uppercase tracking-wider mb-3">
                <Sparkles size={14} /> Bespoke Gifting Experience
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Build Your Own Mithai Hamper
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#FFF8EC]/90 leading-relaxed">
                Hand-pick your favourite artisanal sweets, choose a handcrafted gift box, add a personalized greeting card, and create a heartfelt gift.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-medium text-[#FFF8EC]/80">
                <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full">
                  <Check size={14} className="text-[#C99A42]" /> Pure Desi Ghee Sweets
                </span>
                <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full">
                  <Check size={14} className="text-[#C99A42]" /> Safe Pan-India Courier
                </span>
                <span className="flex items-center gap-1.5 bg-black/20 px-3 py-1.5 rounded-full">
                  <Gift size={14} className="text-[#C99A42]" /> 10% OFF Coupon on ₹{couponThreshold}+
                </span>
              </div>
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none hidden md:block">
              <Gift size={280} />
            </div>
          </div>
        </div>

        {/* Global Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 flex items-center justify-between rounded-2xl p-4 shadow-xs text-sm font-semibold ${
              feedback.type === 'success'
                ? 'border border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border border-red-300 bg-red-50 text-red-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 size={20} className="shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle size={20} className="shrink-0 text-red-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            {feedback.type === 'success' && (
              <Link
                to="/cart"
                className="ml-4 inline-flex items-center gap-1 rounded-full bg-[#9B4A32] px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[#542B24]"
              >
                Go to Cart <ArrowRight size={13} />
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Main Left Studio (Steps 1, 2, 3, 4) */}
          <div className="space-y-8 lg:col-span-8">
            {/* STEP 1: SELECT GIFT BOX */}
            <section className="rounded-3xl border border-[#E8D5B5] bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9B4A32] text-xs font-black text-white">
                    1
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-[#542B24]">Select Gift Box Size</h2>
                </div>
                <span className="text-xs text-[#542B24]/60 font-medium">3 Sizes Available</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {boxes.map((box) => {
                  const isSelected = selectedBoxId === box.id
                  return (
                    <button
                      key={box.id}
                      type="button"
                      onClick={() => setSelectedBoxId(box.id)}
                      className={`relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#9B4A32] bg-[#FFF8EC]/60 shadow-md ring-2 ring-[#C99A42]/40'
                          : 'border-[#E8D5B5] bg-white hover:border-[#9B4A32]/40 hover:bg-[#FFF8EC]/20'
                      }`}
                    >
                      {isSelected && (
                        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#9B4A32] text-white">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      )}
                      <div className="h-32 w-full overflow-hidden rounded-xl border border-[#E8D5B5] bg-[#FFF8EC] mb-3">
                        <img
                          src={box.image_url}
                          alt={box.name}
                          className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        />
                      </div>
                      <h3 className="text-sm font-bold text-[#542B24]">{box.name}</h3>
                      <p className="text-[11px] text-[#542B24]/70 mt-1 line-clamp-2">{box.description}</p>

                      <div className="mt-3 flex items-center justify-between border-t border-[#E8D5B5]/60 pt-2.5 text-xs">
                        <span className="font-bold text-[#C99A42] bg-[#C99A42]/10 px-2 py-0.5 rounded-md">
                          Up to {box.max_capacity_grams}g
                        </span>
                        <span className="font-extrabold text-[#9B4A32]">
                          +{formatPrice(box.packaging_price)}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* STEP 2 & 3: SELECT MITHAI & QUANTITIES */}
            <section className="rounded-3xl border border-[#E8D5B5] bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9B4A32] text-xs font-black text-white">
                    2
                  </span>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-[#542B24]">Choose Your Sweets</h2>
                    <p className="text-xs text-[#542B24]/60">Select desired portion size & quantity for each item</p>
                  </div>
                </div>

                {/* Search Box */}
                <div className="relative w-full sm:w-64">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#542B24]/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sweets by name..."
                    className="w-full rounded-full border border-[#E8D5B5] bg-[#FFF8EC]/40 pl-9 pr-3 py-1.5 text-xs text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white transition"
                  />
                </div>
              </div>

              {/* State Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none text-xs">
                {availableStates.map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setSelectedState(st)}
                    className={`shrink-0 rounded-full px-3 py-1 font-semibold transition ${
                      selectedState === st
                        ? 'bg-[#542B24] text-[#FFF8EC]'
                        : 'border border-[#E8D5B5] bg-white text-[#542B24]/70 hover:border-[#9B4A32]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              {/* Product Grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredProducts.slice(0, 24).map((product) => {
                  return (
                    <SweetPickerCard
                      key={product.id}
                      product={product}
                      selectedSweets={selectedSweets}
                      onAdd={handleAddSweet}
                      onUpdate={handleUpdateQuantity}
                      onRemove={handleRemoveSweet}
                    />
                  )
                })}
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-12 text-center text-[#542B24]/60 text-xs">
                  No sweets found matching "{searchQuery}". Try a different search term.
                </div>
              )}
            </section>

            {/* STEP 4: GIFT CUSTOMIZATION */}
            <section className="rounded-3xl border border-[#E8D5B5] bg-white p-6 sm:p-8 shadow-xs">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#9B4A32] text-xs font-black text-white">
                  3
                </span>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#542B24]">Personalize Your Gift</h2>
                  <p className="text-xs text-[#542B24]/60">Add a heartfelt message and optional gift wrapping</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block font-bold text-[#542B24] mb-1">
                      Recipient Name (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="e.g., Pooja Sharma"
                      className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-3.5 py-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-[#542B24] mb-1">
                      Sender Name (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={100}
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="e.g., Rajesh & Family"
                      className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-3.5 py-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-[#542B24]">
                      Greeting Card Message (Optional)
                    </label>
                    <span className="text-[10px] text-[#542B24]/50">
                      {greetingMessage.length}/200 characters
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={200}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value)}
                    placeholder="Wishing you health, joy, and sweetness on this special occasion!"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 p-3 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>

                {/* Gift Wrap Toggle */}
                <label className="flex items-center justify-between rounded-2xl border border-[#E8D5B5] bg-[#FFF8EC]/50 p-4 cursor-pointer hover:border-[#9B4A32] transition">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#9B4A32]/10 text-[#9B4A32]">
                      <Gift size={18} />
                    </div>
                    <div>
                      <p className="font-bold text-[#542B24]">Add Luxury Festive Gift Wrapping</p>
                      <p className="text-[11px] text-[#542B24]/70">
                        Includes handcrafted satin ribbon, golden gift seal, and personalized printed card.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-[#9B4A32]">+{formatPrice(giftWrapPrice)}</span>
                    <input
                      type="checkbox"
                      checked={giftWrap}
                      onChange={(e) => setGiftWrap(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#9B4A32] cursor-pointer"
                    />
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* Sticky Sidebar: Capacity Meter, Live Breakdown & Cart Action */}
          <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-24">
            {/* CAPACITY METER CARD */}
            <div className="rounded-3xl border border-[#E8D5B5] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-sm text-[#542B24] flex items-center gap-1.5">
                  <Box size={16} className="text-[#9B4A32]" /> Box Capacity
                </h3>
                <span className="text-xs font-extrabold text-[#9B4A32]">
                  {totalUsedGrams}g / {maxCapacityGrams}g
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#E8D5B5]/40 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isOverCapacity
                      ? 'bg-red-500'
                      : capacityPct > 85
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, capacityPct)}%` }}
                />
              </div>

              <div className="mt-2.5 flex items-center justify-between text-[11px]">
                <span className="text-[#542B24]/60">
                  {currentBox ? currentBox.size_label : 'Select Box'}
                </span>
                <span
                  className={`font-bold ${
                    isOverCapacity
                      ? 'text-red-600'
                      : capacityPct > 85
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {isOverCapacity ? `Exceeded by ${totalUsedGrams - maxCapacityGrams}g!` : `${capacityPct}% full`}
                </span>
              </div>

              {/* Warning or Helper Alert */}
              {isOverCapacity && (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <p className="font-semibold">⚠️ Box is over capacity!</p>
                  <p className="mt-0.5 text-[11px]">
                    Please remove some sweets or upgrade to a larger box.
                  </p>
                  {currentBox && currentBox.code !== 'large' && (
                    <button
                      type="button"
                      onClick={handleUpgradeBox}
                      className="mt-2 w-full rounded-lg bg-red-600 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition"
                    >
                      Upgrade Box Size
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SELECTED SWEETS SUMMARY */}
            <div className="rounded-3xl border border-[#E8D5B5] bg-white p-6 shadow-xs">
              <h3 className="font-bold text-sm text-[#542B24] border-b border-[#E8D5B5] pb-3 flex items-center justify-between">
                <span>Selected Sweets</span>
                <span className="text-xs font-bold text-[#9B4A32]">
                  {selectedSweets.reduce((s, i) => s + i.quantity, 0)} Items
                </span>
              </h3>

              {selectedSweets.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#542B24]/50">
                  No sweets added yet. Click &quot;Add&quot; on sweets from the left to start packing your hamper.
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-[#E8D5B5]/50 max-h-56 overflow-y-auto pr-1">
                  {selectedSweets.map((sweet) => (
                    <li key={`${sweet.product_id}-${sweet.variant_weight}`} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[#542B24] truncate">{sweet.product_name}</p>
                        <p className="text-[11px] text-[#542B24]/60">
                          {sweet.variant_weight} • {formatPrice(sweet.unit_price)} each
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <div className="inline-flex items-center rounded-full border border-[#E8D5B5] bg-white">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(sweet.product_id, sweet.variant_weight, -1)}
                            className="flex h-6 w-6 items-center justify-center text-[#542B24] hover:text-[#9B4A32]"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-5 text-center font-bold text-[#542B24] text-[11px]">
                            {sweet.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(sweet.product_id, sweet.variant_weight, 1)}
                            disabled={sweet.quantity >= sweet.stock}
                            className="flex h-6 w-6 items-center justify-center text-[#542B24] hover:text-[#9B4A32] disabled:opacity-30"
                          >
                            <Plus size={11} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveSweet(sweet.product_id, sweet.variant_weight)}
                          className="text-[#542B24]/40 hover:text-red-600 transition p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Greeting Card Preview snippet */}
              {(recipientName || senderName || greetingMessage) && (
                <div className="mt-4 rounded-xl border border-dashed border-[#C99A42] bg-[#FFF8EC] p-3 text-xs">
                  <p className="font-bold text-[#9B4A32] flex items-center gap-1">
                    <Heart size={12} /> Gift Card Attached
                  </p>
                  {recipientName && <p className="text-[11px] text-[#542B24]/80 mt-1">To: {recipientName}</p>}
                  {senderName && <p className="text-[11px] text-[#542B24]/80">From: {senderName}</p>}
                  {greetingMessage && (
                    <p className="text-[10px] italic text-[#542B24]/70 mt-1 line-clamp-2">
                      &quot;{greetingMessage}&quot;
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* LIVE PRICE BREAKDOWN & ADD TO CART */}
            <div className="rounded-3xl border border-[#E8D5B5] bg-[#FFF8EC] p-6 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E8D5B5] pb-3">
                <h3 className="font-bold text-sm text-[#542B24]">Estimated Price</h3>
                {estimating && (
                  <span className="flex items-center gap-1 text-[11px] text-[#9B4A32]">
                    <RefreshCw size={11} className="animate-spin" /> Calculating...
                  </span>
                )}
              </div>

              <dl className="mt-3 space-y-2 text-xs text-[#542B24]/80">
                <div className="flex justify-between">
                  <dt>Sweets Subtotal</dt>
                  <dd className="font-semibold text-[#542B24]">
                    {formatPrice(estimate ? estimate.sweets_subtotal : 0)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt>Gift Box Packaging</dt>
                  <dd className="font-semibold text-[#542B24]">
                    {formatPrice(currentBox ? currentBox.packaging_price : 0)}
                  </dd>
                </div>
                {giftWrap && (
                  <div className="flex justify-between">
                    <dt>Festive Gift Wrapping</dt>
                    <dd className="font-semibold text-[#542B24]">+{formatPrice(giftWrapPrice)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-[#E8D5B5] pt-2 text-sm font-bold text-[#542B24]">
                  <dt>Estimated Total</dt>
                  <dd className="text-base font-black text-[#9B4A32]">
                    {formatPrice(liveTotal)}
                  </dd>
                </div>
              </dl>

              {/* Automatic Coupon Callout Banner */}
              <div className="mt-4 rounded-2xl border border-[#C99A42]/50 bg-gradient-to-r from-[#FFF8EC] to-[#E8D5B5]/40 p-3 text-xs">
                {qualifiesForCoupon ? (
                  <div className="flex items-start gap-2 text-emerald-800">
                    <Sparkles size={16} className="text-[#C99A42] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Next-Purchase Discount Unlocked!</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        Placing this hamper order qualifies you for a <b>{couponDiscountVal}% OFF coupon</b> on your next sweet purchase!
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[#542B24]/70">
                    <Info size={15} className="text-[#9B4A32] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-[#542B24]">Unlock {couponDiscountVal}% OFF Coupon</p>
                      <p className="text-[11px] mt-0.5">
                        Add {formatPrice(couponThreshold - liveTotal)} more to this hamper to earn a {couponDiscountVal}% discount coupon!
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={addingToCart || selectedSweets.length === 0 || isOverCapacity}
                className="mt-5 w-full flex items-center justify-center gap-2 rounded-full bg-[#9B4A32] py-3.5 text-xs font-bold text-white shadow-md transition hover:bg-[#542B24] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {addingToCart ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Adding Hamper to Cart...
                  </>
                ) : (
                  <>
                    <ShoppingBag size={15} /> Add Custom Hamper to Cart
                  </>
                )}
              </button>

              <p className="mt-2 text-center text-[10px] text-[#542B24]/60">
                Prices and box capacity verified live with our kitchen stock
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function SweetPickerCard({ product, selectedSweets, onAdd, onUpdate, onRemove }) {
  const activeVariants = product.variants || []
  const [selectedWeight, setSelectedWeight] = useState(
    activeVariants.length > 0 ? activeVariants[0].weight : ''
  )

  const currentVariant = useMemo(() => {
    return activeVariants.find((v) => v.weight === selectedWeight) || activeVariants[0]
  }, [activeVariants, selectedWeight])

  const existingInHamper = useMemo(() => {
    return selectedSweets.find(
      (s) => s.product_id === product.id && s.variant_weight === currentVariant?.weight
    )
  }, [selectedSweets, product.id, currentVariant])

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E8D5B5] bg-white p-3.5 shadow-2xs hover:shadow-sm transition">
      <div className="flex gap-3">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]">
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover"
            onError={(e) => {
              e.currentTarget.src = '/images/sweets/assorted-sweets-box-1.jpg'
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="text-xs sm:text-sm font-bold text-[#542B24] truncate">{product.name}</h4>
            {product.state && (
              <span className="text-[10px] font-semibold bg-[#FFF8EC] text-[#9B4A32] border border-[#E8D5B5] px-1.5 py-0.2 rounded">
                {product.state}
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#542B24]/70 mt-0.5 line-clamp-1">
            {product.description || 'Authentic traditional confectionery.'}
          </p>

          {/* Weight selector */}
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            {activeVariants.map((v) => (
              <button
                key={v.weight}
                type="button"
                onClick={() => setSelectedWeight(v.weight)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                  selectedWeight === v.weight
                    ? 'bg-[#9B4A32] text-white'
                    : 'border border-[#E8D5B5] text-[#542B24]/70 hover:border-[#9B4A32]'
                }`}
              >
                {v.weight}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-[#E8D5B5]/60 pt-2.5 text-xs">
        <div>
          <span className="font-extrabold text-[#9B4A32] text-sm">
            {formatPrice(currentVariant ? currentVariant.price : 0)}
          </span>
          <span className="text-[10px] text-[#542B24]/50 ml-1.5">
            ({currentVariant ? currentVariant.stock : 0} in stock)
          </span>
        </div>

        {existingInHamper ? (
          <div className="inline-flex items-center rounded-full border border-[#E8D5B5] bg-white">
            <button
              type="button"
              onClick={() => onUpdate(product.id, currentVariant.weight, -1)}
              className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32]"
            >
              <Minus size={12} />
            </button>
            <span className="w-6 text-center font-bold text-[#542B24] text-xs">
              {existingInHamper.quantity}
            </span>
            <button
              type="button"
              onClick={() => onUpdate(product.id, currentVariant.weight, 1)}
              disabled={existingInHamper.quantity >= currentVariant.stock}
              className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32] disabled:opacity-30"
            >
              <Plus size={12} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={!currentVariant || currentVariant.stock === 0}
            onClick={() => onAdd(product, currentVariant)}
            className="flex items-center gap-1 rounded-full bg-[#542B24] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#9B4A32] transition disabled:opacity-40 cursor-pointer"
          >
            <Plus size={12} /> Add to Box
          </button>
        )}
      </div>
    </div>
  )
}
