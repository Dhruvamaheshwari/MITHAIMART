import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Info,
  MapPin,
  Minus,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { CartContext } from '../context/CartContext'
import api from '../services/api'
import { formatDate, formatPrice } from '../utils/helpers'

export default function BulkOrders() {
  const navigate = useNavigate()
  const { user } = useContext(AuthContext)
  const { refreshCart } = useContext(CartContext)

  // Data from backend
  const [products, setProducts] = useState([])
  const [rules, setRules] = useState(null)
  const [loading, setLoading] = useState(true)

  // Customer selections
  const [selectedItems, setSelectedItems] = useState([]) // [ { product_id, product_name, product_image, variant_weight, quantity, unit_price, grams, stock } ]
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedState, setSelectedState] = useState('All')

  // Live estimate
  const [estimate, setEstimate] = useState(null)
  const [estimating, setEstimating] = useState(false)
  const [addingToCart, setAddingToCart] = useState(false)
  const [feedback, setFeedback] = useState(null) // { type: 'success' | 'error', message }

  // Tabs: 'shop' or 'quotations'
  const [activeTab, setActiveTab] = useState('shop')

  // Quotation Request Modal state
  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState(false)
  const [quoteForm, setQuoteForm] = useState({
    customer_name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
    business_name: '',
    preferred_delivery_date: '',
    delivery_city: '',
    delivery_pincode: '',
    delivery_state: '',
    additional_notes: '',
  })
  const [submittingQuote, setSubmittingQuote] = useState(false)

  // Customer's previous quotations
  const [myQuotations, setMyQuotations] = useState([])
  const [loadingQuotations, setLoadingQuotations] = useState(false)
  const [addresses, setAddresses] = useState([])
  const [selectedAddressId, setSelectedAddressId] = useState('')
  const [acceptingQuoteId, setAcceptingQuoteId] = useState(null)

  // Fetch initial bulk products and discount rules
  useEffect(() => {
    async function init() {
      setLoading(true)
      try {
        const [prodRes, rulesRes] = await Promise.all([
          api.get('/bulk/products/'),
          api.get('/bulk/rules/'),
        ])
        setProducts(prodRes.data.products || [])
        setRules(rulesRes.data || null)
      } catch (err) {
        setFeedback({ type: 'error', message: 'Unable to load bulk pricing. Please refresh the page.' })
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  // Load customer's quotations & addresses when switching to quotations tab or logged in
  useEffect(() => {
    if (activeTab === 'quotations' || isQuoteModalOpen) {
      loadMyQuotations()
      if (user) {
        api.get('/addresses/').then((res) => {
          setAddresses(res.data || [])
          if (res.data?.length > 0 && !selectedAddressId) {
            setSelectedAddressId(res.data[0].id)
          }
        }).catch(() => {})
      }
    }
  }, [activeTab, isQuoteModalOpen, user])

  function loadMyQuotations() {
    setLoadingQuotations(true)
    api.get('/wholesale/my-requests/')
      .then((res) => setMyQuotations(res.data.requests || []))
      .catch(() => {})
      .finally(() => setLoadingQuotations(false))
  }

  // Live Backend Price Estimate Calculation (debounced)
  useEffect(() => {
    if (selectedItems.length === 0) {
      setEstimate(null)
      return
    }

    let isMounted = true
    const timer = setTimeout(async () => {
      setEstimating(true)
      try {
        const payload = {
          items: selectedItems.map((item) => ({
            product_id: item.product_id,
            variant_weight: item.variant_weight,
            quantity: item.quantity,
          })),
        }
        const res = await api.post('/bulk/estimate/', payload)
        if (isMounted) setEstimate(res.data)
      } catch (err) {
        // silence transient typing errors
      } finally {
        if (isMounted) setEstimating(false)
      }
    }, 250)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [selectedItems])

  // Sweet list helpers
  const availableStates = useMemo(() => {
    const s = new Set()
    products.forEach((p) => {
      if (p.state) s.add(p.state)
    })
    return ['All', ...Array.from(s).sort()]
  }, [products])

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchState = selectedState === 'All' || p.state === selectedState
      return matchSearch && matchState
    })
  }, [products, searchQuery, selectedState])

  function handleAddItem(product, variant, initialQty = 5) {
    setFeedback(null)
    setSelectedItems((prev) => {
      const idx = prev.findIndex(
        (it) => it.product_id === product.id && it.variant_weight === variant.weight
      )
      if (idx > -1) {
        const updated = [...prev]
        const newQty = Math.min(variant.stock, updated[idx].quantity + initialQty)
        updated[idx] = { ...updated[idx], quantity: newQty }
        return updated
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            product_image: product.image_url,
            variant_weight: variant.weight,
            quantity: Math.min(variant.stock, initialQty),
            unit_price: variant.price,
            grams: variant.grams || 1000,
            stock: variant.stock,
          },
        ]
      }
    })
  }

  function handleUpdateQuantity(productId, variantWeight, newQty) {
    setFeedback(null)
    setSelectedItems((prev) => {
      if (newQty <= 0) {
        return prev.filter((it) => !(it.product_id === productId && it.variant_weight === variantWeight))
      }
      return prev.map((it) => {
        if (it.product_id === productId && it.variant_weight === variantWeight) {
          return { ...it, quantity: Math.min(it.stock, newQty) }
        }
        return it
      })
    })
  }

  function handleRemoveItem(productId, variantWeight) {
    setFeedback(null)
    setSelectedItems((prev) =>
      prev.filter((it) => !(it.product_id === productId && it.variant_weight === variantWeight))
    )
  }

  // Instant order submission to Cart
  async function handleAddBulkToCart() {
    setFeedback(null)
    if (selectedItems.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least one sweet to order.' })
      return
    }

    setAddingToCart(true)
    try {
      const payload = {
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          variant_weight: item.variant_weight,
          quantity: item.quantity,
        })),
      }
      await api.post('/bulk/cart/add/', payload)
      await refreshCart()
      setFeedback({
        type: 'success',
        message: 'Bulk order items added to your cart with wholesale pricing applied!',
      })
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to add bulk items to cart.'
      setFeedback({ type: 'error', message: msg })
    } finally {
      setAddingToCart(false)
    }
  }

  // Submit Quotation Request
  async function handleSubmitQuotation(e) {
    e.preventDefault()
    if (!quoteForm.customer_name.trim()) {
      alert('Please enter your name.')
      return
    }
    if (!quoteForm.phone.trim() || quoteForm.phone.trim().length < 10) {
      alert('Please enter a valid 10-digit contact number.')
      return
    }
    if (selectedItems.length === 0) {
      alert('Please select at least one sweet for your quotation request.')
      return
    }

    setSubmittingQuote(true)
    try {
      const payload = {
        ...quoteForm,
        items: selectedItems.map((item) => ({
          product_id: item.product_id,
          variant_weight: item.variant_weight,
          quantity: item.quantity,
        })),
      }
      const res = await api.post('/wholesale/request/', payload)
      setIsQuoteModalOpen(false)
      setActiveTab('quotations')
      loadMyQuotations()
      setFeedback({
        type: 'success',
        message: `Wholesale Quotation Request #${res.data.request_id} submitted! Our team will send your custom quote shortly.`,
      })
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit quotation request.')
    } finally {
      setSubmittingQuote(false)
    }
  }

  // Customer accepts quotation
  async function handleAcceptQuotation(requestId) {
    if (!user) {
      navigate('/login')
      return
    }
    if (!selectedAddressId) {
      alert('Please add or select a delivery address to accept this quotation.')
      return
    }

    setAcceptingQuoteId(requestId)
    try {
      const res = await api.post(`/wholesale/${requestId}/accept/`, {
        address_id: selectedAddressId,
      })
      navigate(`/order-confirmation/${res.data.order_id}`)
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert quotation to order.')
    } finally {
      setAcceptingQuoteId(null)
    }
  }

  // Customer declines quotation
  async function handleRejectQuotation(requestId) {
    if (!window.confirm('Are you sure you want to decline this quotation?')) return
    try {
      await api.post(`/wholesale/${requestId}/reject/`)
      loadMyQuotations()
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update quotation.')
    }
  }

  if (loading) {
    return (
      <div className="bg-[#FFF8EC] min-h-screen py-24 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#E8D5B5] border-t-[#9B4A32]" />
        <p className="mt-4 text-sm font-semibold text-[#542B24]">Loading Wholesale Pricing Engine...</p>
      </div>
    )
  }

  const slabs = rules?.slabs || []
  const totalWeightKg = estimate ? estimate.total_weight_kg : 0
  const instantOrderMaxKg = rules?.instant_order_max_kg || 50.0

  return (
    <div className="min-h-screen bg-[#FFF8EC]/60 pb-24 pt-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb & Hero */}
        <div className="mb-6">
          <nav className="mb-3 flex items-center gap-2 text-xs font-semibold text-[#542B24]/60">
            <Link to="/" className="hover:text-[#9B4A32]">Home</Link>
            <span>/</span>
            <span className="text-[#9B4A32]">Bulk Orders & Wholesale</span>
          </nav>

          <div className="rounded-3xl border border-[#E8D5B5] bg-gradient-to-r from-[#542B24] via-[#753426] to-[#9B4A32] p-6 sm:p-10 text-[#FFF8EC] shadow-md relative overflow-hidden">
            <div className="relative z-10 max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#C99A42]/20 border border-[#C99A42]/40 px-3.5 py-1 text-xs font-bold text-[#C99A42] uppercase tracking-wider mb-3">
                <Boxes size={14} /> Buy More, Save More
              </span>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                Buying Sweets in Bulk? Get Special Wholesale Prices!
              </h1>
              <p className="mt-2 text-sm sm:text-base text-[#FFF8EC]/90 leading-relaxed">
                Order your favourite authentic sweets in larger quantities and enjoy exclusive tiered bulk discounts. Perfect for weddings, corporate gifting, festivals, and retail resale.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-medium text-[#FFF8EC]/90">
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full">
                  <Check size={14} className="text-[#C99A42]" /> Instant Online Order up to {instantOrderMaxKg} kg
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full">
                  <FileText size={14} className="text-[#C99A42]" /> Custom Quotation for 50+ kg
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full">
                  <Package size={14} className="text-[#C99A42]" /> Hygienic Bulk Packaging
                </span>
              </div>
            </div>
            <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none hidden md:block">
              <Boxes size={260} />
            </div>
          </div>
        </div>

        {/* Global Feedback Banner */}
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

        {/* Slabs Tier Banner */}
        <div className="mb-8 rounded-2xl border border-[#E8D5B5] bg-white p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <h2 className="text-xs sm:text-sm font-bold text-[#542B24] flex items-center gap-1.5">
              <Tag size={15} className="text-[#9B4A32]" /> Automatic Volume Discount Slabs (Per Sweet)
            </h2>
            <span className="text-[11px] text-[#542B24]/60 font-medium">
              Applied automatically based on each product&apos;s total quantity
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {slabs.map((slab, sIdx) => (
              <div
                key={sIdx}
                className="rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/60 p-3 text-center shadow-2xs hover:border-[#9B4A32] transition"
              >
                <span className="block text-[11px] font-bold text-[#542B24]/70">
                  {slab.label || `${slab.min_kg} kg+`}
                </span>
                <span className="block text-base sm:text-lg font-black text-[#9B4A32] mt-0.5">
                  {slab.discount_percentage}% OFF
                </span>
                <span className="block text-[10px] text-[#542B24]/50 mt-0.5">Instant Discount</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Tabs (Shop Sweets vs My Quotations) */}
        <div className="flex border-b border-[#E8D5B5] mb-6 gap-6 text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('shop')}
            className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'shop'
                ? 'border-b-2 border-[#9B4A32] text-[#9B4A32]'
                : 'text-[#542B24]/60 hover:text-[#542B24]'
            }`}
          >
            <Boxes size={16} /> Choose Bulk Sweets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('quotations')}
            className={`pb-3 transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'quotations'
                ? 'border-b-2 border-[#9B4A32] text-[#9B4A32]'
                : 'text-[#542B24]/60 hover:text-[#542B24]'
            }`}
          >
            <FileText size={16} /> My Wholesale Quotations
            {myQuotations.length > 0 && (
              <span className="rounded-full bg-[#9B4A32] px-2 py-0.2 text-[10px] font-bold text-white">
                {myQuotations.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: SHOP SWEETS & LIVE ESTIMATE */}
        {activeTab === 'shop' && (
          <div className="grid gap-8 lg:grid-cols-12 items-start">
            {/* Products Selector Grid */}
            <div className="space-y-6 lg:col-span-8">
              {/* Search & State Filter */}
              <div className="rounded-2xl border border-[#E8D5B5] bg-white p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#542B24]/40" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sweets by name..."
                    className="w-full rounded-full border border-[#E8D5B5] bg-[#FFF8EC]/40 pl-9 pr-3 py-1.5 text-xs text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white transition"
                  />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none text-xs">
                  {availableStates.slice(0, 8).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedState(st)}
                      className={`shrink-0 rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
                        selectedState === st
                          ? 'bg-[#542B24] text-[#FFF8EC]'
                          : 'border border-[#E8D5B5] bg-white text-[#542B24]/70 hover:border-[#9B4A32]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Cards */}
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredProducts.slice(0, 24).map((product) => (
                  <BulkProductCard
                    key={product.id}
                    product={product}
                    selectedItems={selectedItems}
                    slabs={slabs}
                    onAdd={handleAddItem}
                    onUpdate={handleUpdateQuantity}
                    onRemove={handleRemoveItem}
                  />
                ))}
              </div>

              {filteredProducts.length === 0 && (
                <div className="py-14 text-center text-xs text-[#542B24]/60 bg-white rounded-2xl border border-[#E8D5B5]">
                  No sweets found matching &quot;{searchQuery}&quot;. Please try a different name.
                </div>
              )}
            </div>

            {/* Sticky Live Volume Summary & Cart Sidebar */}
            <aside className="space-y-6 lg:col-span-4 lg:sticky lg:top-24">
              <div className="rounded-3xl border border-[#E8D5B5] bg-white p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-[#E8D5B5] pb-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#542B24]">Wholesale Summary</h3>
                    <p className="text-[11px] text-[#542B24]/60">
                      {selectedItems.length} Product(s) Selected
                    </p>
                  </div>
                  {estimating && (
                    <span className="flex items-center gap-1 text-[11px] text-[#9B4A32]">
                      <RefreshCw size={11} className="animate-spin" /> Calculating...
                    </span>
                  )}
                </div>

                {/* Selected Items List */}
                {selectedItems.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#542B24]/50">
                    Your bulk selection is empty. Choose sweets and enter quantities on the left to view bulk discounts.
                  </div>
                ) : (
                  <ul className="mt-3 divide-y divide-[#E8D5B5]/50 max-h-56 overflow-y-auto pr-1">
                    {selectedItems.map((item) => {
                      const estItem = estimate?.items?.find(
                        (i) => i.product_id === item.product_id && i.variant_weight === item.variant_weight
                      )
                      const discPct = estItem ? estItem.discount_percentage : 0
                      const finalTotal = estItem ? estItem.discounted_total : item.unit_price * item.quantity

                      return (
                        <li key={`${item.product_id}-${item.variant_weight}`} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-[#542B24] truncate">{item.product_name}</p>
                            <div className="flex items-center gap-1.5 text-[11px] text-[#542B24]/60 mt-0.5">
                              <span>{item.variant_weight} × {item.quantity}</span>
                              {discPct > 0 && (
                                <span className="rounded bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 text-[10px]">
                                  {discPct}% OFF
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-[#9B4A32] text-xs">
                              {formatPrice(finalTotal)}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.product_id, item.variant_weight)}
                              className="text-[#542B24]/40 hover:text-red-600 transition p-1"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* Totals Breakdown */}
                <dl className="mt-4 space-y-2 border-t border-[#E8D5B5] pt-3 text-xs text-[#542B24]/80">
                  <div className="flex justify-between">
                    <dt>Total Order Weight</dt>
                    <dd className="font-bold text-[#542B24] text-xs">
                      {totalWeightKg} kg
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Original Value</dt>
                    <dd className="font-semibold text-[#542B24]">
                      {formatPrice(estimate ? estimate.original_total : 0)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <dt>Total Bulk Savings</dt>
                    <dd>-{formatPrice(estimate ? estimate.total_bulk_discount : 0)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-[#E8D5B5] pt-2 text-sm font-bold text-[#542B24]">
                    <dt>Estimated Total</dt>
                    <dd className="text-base font-black text-[#9B4A32]">
                      {formatPrice(estimate ? estimate.final_estimated_total : 0)}
                    </dd>
                  </div>
                </dl>

                {/* Instant Order vs Quotation Trigger */}
                <div className="mt-5 space-y-3">
                  {estimate && estimate.requires_quotation ? (
                    <div className="rounded-2xl border border-[#C99A42] bg-[#FFF8EC] p-3.5 text-xs">
                      <p className="font-bold text-[#9B4A32] flex items-center gap-1.5">
                        <Sparkles size={14} /> Wholesale Volume ({totalWeightKg} kg)
                      </p>
                      <p className="text-[11px] text-[#542B24]/80 mt-1">
                        For orders exceeding {instantOrderMaxKg} kg, our culinary masters prepare custom packaging and customized commercial rates.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsQuoteModalOpen(true)}
                        className="mt-3 w-full rounded-full bg-[#9B4A32] py-3 text-xs font-bold text-white shadow-md hover:bg-[#542B24] transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <FileText size={15} /> Request Wholesale Quotation
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleAddBulkToCart}
                        disabled={addingToCart || selectedItems.length === 0}
                        className="w-full rounded-full bg-[#9B4A32] py-3.5 text-xs font-bold text-white shadow-md hover:bg-[#542B24] transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {addingToCart ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Adding Bulk Order to Cart...
                          </>
                        ) : (
                          <>
                            <ShoppingBag size={15} /> Add Bulk Order to Cart
                          </>
                        )}
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setIsQuoteModalOpen(true)}
                          className="text-xs font-semibold text-[#9B4A32] hover:text-[#542B24] hover:underline"
                        >
                          Need a custom quotation or scheduled date? Click here
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {/* TAB 2: MY WHOLESALE QUOTATIONS */}
        {activeTab === 'quotations' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-[#542B24]">My Wholesale Enquiries &amp; Quotations</h2>
                <button
                  type="button"
                  onClick={loadMyQuotations}
                  className="text-xs font-bold text-[#9B4A32] flex items-center gap-1 hover:underline"
                >
                  <RefreshCw size={13} /> Refresh
                </button>
              </div>

              {loadingQuotations ? (
                <div className="py-12 text-center text-xs text-[#542B24]/70">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-3 border-[#E8D5B5] border-t-[#9B4A32] mb-2" />
                  Loading your quotations...
                </div>
              ) : myQuotations.length === 0 ? (
                <div className="py-14 text-center text-xs text-[#542B24]/60">
                  <p>You have not submitted any wholesale quotation requests yet.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('shop')}
                    className="mt-3 inline-block rounded-full bg-[#9B4A32] px-6 py-2 text-xs font-bold text-white hover:bg-[#542B24]"
                  >
                    Explore Bulk Sweets
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {myQuotations.map((quote) => {
                    const isQuoted = quote.status === 'Quotation Sent'
                    const isConverted = quote.status === 'Converted to Order'

                    return (
                      <div
                        key={quote.id}
                        className={`rounded-2xl border p-5 transition ${
                          isQuoted
                            ? 'border-2 border-[#C99A42] bg-[#FFF8EC]/60 shadow-sm'
                            : 'border-[#E8D5B5] bg-white shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <span className="font-mono text-xs font-bold text-[#9B4A32]">
                              {quote.request_id}
                            </span>
                            <h3 className="font-bold text-sm text-[#542B24] mt-0.5">
                              {quote.business_name || quote.customer_name}
                            </h3>
                            <p className="text-[11px] text-[#542B24]/60">
                              Submitted: {formatDate(quote.created_at)} • Delivery: {quote.preferred_delivery_date || 'Flexible'}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              quote.status === 'Quotation Sent'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : quote.status === 'Converted to Order'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : quote.status === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </div>

                        {/* Items list */}
                        <div className="mt-3 rounded-xl border border-[#E8D5B5] bg-white p-3 text-xs">
                          <p className="font-bold text-[#542B24] text-[11px] mb-1 text-[#9B4A32]">
                            Requested Products ({quote.total_weight_kg} kg total):
                          </p>
                          <ul className="divide-y divide-[#E8D5B5]/40 space-y-1">
                            {quote.selected_items?.map((it, idx) => (
                              <li key={idx} className="flex justify-between items-center pt-1 text-[#542B24]/90">
                                <span>{it.product_name} ({it.variant_weight})</span>
                                <span>Qty: {it.quantity} • {formatPrice(it.item_total)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Admin Quotation Proposal details if sent */}
                        {isQuoted && (
                          <div className="mt-4 rounded-xl border-2 border-[#C99A42] bg-white p-4 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#9B4A32] flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                                <Sparkles size={14} /> Official Quoted Price
                              </span>
                              <span className="text-base sm:text-lg font-black text-[#9B4A32]">
                                {formatPrice(quote.quoted_price)}
                              </span>
                            </div>

                            {quote.quotation_notes && (
                              <p className="mt-2 text-xs italic text-[#542B24]/80 bg-[#FFF8EC] p-2.5 rounded-lg border border-[#E8D5B5]">
                                &quot;{quote.quotation_notes}&quot;
                              </p>
                            )}

                            {quote.quotation_expires_at && (
                              <p className="mt-2 text-[11px] text-[#542B24]/60 flex items-center gap-1">
                                <Clock size={12} className="text-[#9B4A32]" />
                                Valid until: {formatDate(quote.quotation_expires_at)}
                              </p>
                            )}

                            {/* Address Selector to Accept */}
                            <div className="mt-4 border-t border-[#E8D5B5] pt-3">
                              <label className="block font-bold text-[#542B24] mb-1.5">
                                Select Delivery Address for this Order:
                              </label>
                              {addresses.length === 0 ? (
                                <p className="text-red-600 text-xs mb-2">
                                  You have no saved addresses. Please add an address in your account to accept this quotation.
                                </p>
                              ) : (
                                <select
                                  value={selectedAddressId}
                                  onChange={(e) => setSelectedAddressId(e.target.value)}
                                  className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2 text-xs text-[#542B24] outline-none"
                                >
                                  {addresses.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.full_name} - {a.house_number}, {a.street}, {a.city} ({a.pincode})
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div className="mt-3 flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  onClick={() => handleRejectQuotation(quote.request_id)}
                                  className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                                >
                                  Decline
                                </button>
                                <button
                                  type="button"
                                  disabled={acceptingQuoteId === quote.request_id || addresses.length === 0}
                                  onClick={() => handleAcceptQuotation(quote.request_id)}
                                  className="rounded-full bg-[#9B4A32] px-6 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#542B24] transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                                >
                                  {acceptingQuoteId === quote.request_id ? (
                                    <>
                                      <RefreshCw size={12} className="animate-spin" /> Placing Order...
                                    </>
                                  ) : (
                                    <>
                                      <Check size={14} /> Accept Quotation &amp; Place Order
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {isConverted && quote.order_id && (
                          <div className="mt-3 flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                            <span>Order Confirmed: #{quote.order_number}</span>
                            <Link
                              to={`/order-confirmation/${quote.order_id}`}
                              className="font-bold underline hover:text-emerald-950"
                            >
                              View Order Details &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* WHOLESALE QUOTATION MODAL */}
      {isQuoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-[#E8D5B5] bg-white p-6 sm:p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsQuoteModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-[#542B24] p-1"
            >
              <X size={20} />
            </button>

            <div className="mb-4">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#C99A42]/20 px-2.5 py-0.5 text-[10px] font-bold text-[#9B4A32] uppercase tracking-wide">
                <FileText size={12} /> Custom Commercial Quote
              </span>
              <h2 className="text-xl font-bold text-[#542B24] mt-1">Request Wholesale Quotation</h2>
              <p className="text-xs text-[#542B24]/70 mt-0.5">
                For events, corporate orders, and large shipments ({totalWeightKg} kg requested).
              </p>
            </div>

            <form onSubmit={handleSubmitQuotation} className="space-y-4 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={quoteForm.customer_name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, customer_name: e.target.value })}
                    placeholder="e.g. Ramesh Gupta"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Contact Phone *</label>
                  <input
                    type="tel"
                    required
                    value={quoteForm.phone}
                    onChange={(e) => setQuoteForm({ ...quoteForm, phone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Email Address</label>
                  <input
                    type="email"
                    value={quoteForm.email}
                    onChange={(e) => setQuoteForm({ ...quoteForm, email: e.target.value })}
                    placeholder="name@example.com"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Company / Event Name</label>
                  <input
                    type="text"
                    value={quoteForm.business_name}
                    onChange={(e) => setQuoteForm({ ...quoteForm, business_name: e.target.value })}
                    placeholder="e.g. Sharma Wedding / ABC Corp"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Preferred Date</label>
                  <input
                    type="date"
                    value={quoteForm.preferred_delivery_date}
                    onChange={(e) => setQuoteForm({ ...quoteForm, preferred_delivery_date: e.target.value })}
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">City</label>
                  <input
                    type="text"
                    value={quoteForm.delivery_city}
                    onChange={(e) => setQuoteForm({ ...quoteForm, delivery_city: e.target.value })}
                    placeholder="e.g. Ludhiana"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-[#542B24] mb-1">Pincode</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={quoteForm.delivery_pincode}
                    onChange={(e) => setQuoteForm({ ...quoteForm, delivery_pincode: e.target.value })}
                    placeholder="6-digit pincode"
                    className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-[#542B24] mb-1">Special Requirements &amp; Notes</label>
                <textarea
                  rows={3}
                  value={quoteForm.additional_notes}
                  onChange={(e) => setQuoteForm({ ...quoteForm, additional_notes: e.target.value })}
                  placeholder="e.g. Need individual 500g boxes with customized wedding tags and express courier delivery."
                  className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/40 p-2.5 text-[#542B24] outline-none focus:border-[#9B4A32] focus:bg-white"
                />
              </div>

              {/* Items Snapshot */}
              <div className="rounded-xl border border-[#E8D5B5] bg-[#FFF8EC] p-3">
                <p className="font-bold text-[#542B24]">Enquiry Items ({selectedItems.length}):</p>
                <p className="text-[11px] text-[#542B24]/70 mt-0.5">
                  {selectedItems.map((i) => `${i.product_name} (${i.variant_weight} × ${i.quantity})`).join(', ')}
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsQuoteModalOpen(false)}
                  className="rounded-full border border-gray-300 px-5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingQuote}
                  className="rounded-full bg-[#9B4A32] px-7 py-2.5 text-xs font-bold text-white shadow-md hover:bg-[#542B24] transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  {submittingQuote ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={13} /> Submit Quotation Request
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function BulkProductCard({ product, selectedItems, slabs, onAdd, onUpdate, onRemove }) {
  const activeVariants = product.variants || []
  const [selectedWeight, setSelectedWeight] = useState(
    activeVariants.length > 0 ? activeVariants[0].weight : ''
  )
  const [customQty, setCustomQty] = useState(5)

  const currentVariant = useMemo(() => {
    return activeVariants.find((v) => v.weight === selectedWeight) || activeVariants[0]
  }, [activeVariants, selectedWeight])

  const existingInSelection = useMemo(() => {
    return selectedItems.find(
      (it) => it.product_id === product.id && it.variant_weight === currentVariant?.weight
    )
  }, [selectedItems, product.id, currentVariant])

  // Calculate current item discount slab based on quantity
  const qty = existingInSelection ? existingInSelection.quantity : customQty
  const grams = currentVariant?.grams || 1000
  const itemWeightKg = (grams * qty) / 1000.0

  const activeSlab = useMemo(() => {
    return slabs.find(
      (s) => itemWeightKg >= s.min_kg && (s.max_kg === null || itemWeightKg <= s.max_kg)
    )
  }, [slabs, itemWeightKg])

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[#E8D5B5] bg-white p-4 shadow-2xs hover:shadow-sm transition">
      <div className="flex gap-3.5">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]">
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

          {/* Weight variant options */}
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

          {/* Active Slab preview tag */}
          {activeSlab && (
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
              <Sparkles size={11} className="text-emerald-600" />
              {activeSlab.discount_percentage}% Bulk Slab ({itemWeightKg} kg)
            </div>
          )}
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between border-t border-[#E8D5B5]/60 pt-3 text-xs">
        <div>
          <span className="font-extrabold text-[#9B4A32] text-sm">
            {formatPrice(currentVariant ? currentVariant.price : 0)}
          </span>
          <span className="text-[10px] text-[#542B24]/50 ml-1.5">
            ({currentVariant ? currentVariant.stock : 0} in stock)
          </span>
        </div>

        {existingInSelection ? (
          <div className="flex items-center gap-1.5">
            <div className="inline-flex items-center rounded-full border border-[#E8D5B5] bg-white">
              <button
                type="button"
                onClick={() => onUpdate(product.id, currentVariant.weight, existingInSelection.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32]"
              >
                <Minus size={12} />
              </button>
              <input
                type="number"
                min={1}
                max={currentVariant.stock}
                value={existingInSelection.quantity}
                onChange={(e) => onUpdate(product.id, currentVariant.weight, parseInt(e.target.value) || 1)}
                className="w-10 text-center font-bold text-[#542B24] text-xs outline-none"
              />
              <button
                type="button"
                onClick={() => onUpdate(product.id, currentVariant.weight, existingInSelection.quantity + 1)}
                disabled={existingInSelection.quantity >= currentVariant.stock}
                className="flex h-7 w-7 items-center justify-center text-[#542B24] hover:text-[#9B4A32] disabled:opacity-30"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-[#E8D5B5] bg-white px-2 py-1">
              <span className="text-[10px] text-[#542B24]/60 mr-1.5">Qty:</span>
              <input
                type="number"
                min={1}
                max={currentVariant?.stock || 50}
                value={customQty}
                onChange={(e) => setCustomQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-9 font-bold text-xs text-[#542B24] outline-none"
              />
            </div>
            <button
              type="button"
              disabled={!currentVariant || currentVariant.stock === 0}
              onClick={() => onAdd(product, currentVariant, customQty)}
              className="flex items-center gap-1 rounded-full bg-[#542B24] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#9B4A32] transition disabled:opacity-40 cursor-pointer"
            >
              <Plus size={12} /> Add Bulk
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
