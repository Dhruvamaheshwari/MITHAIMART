import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, RotateCcw, SlidersHorizontal, Sparkles } from 'lucide-react'
import ProductGrid from '../components/ProductGrid'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

const DEBOUNCE_MS = 400

const SIDEBAR_CATEGORIES = [
  'Sweets',
  'Namkeens',
  'Snacks',
  'Bakery & Boulangerie',
  'Chocolates',
  'Gifting',
]

// Map a high-level section to its matching category IDs in MongoDB
function getCategoryIdsForSection(sectionName, categories) {
  if (!sectionName || !categories || !categories.length) return ''
  const target = sectionName.toLowerCase()
  const matched = categories.filter((c) => {
    const cName = c.name.toLowerCase()
    if (target === 'sweets') return cName.includes('sweet')
    if (target === 'namkeens') return cName.includes('namkeen')
    if (target === 'snacks') return cName.includes('snack')
    if (target === 'bakery & boulangerie') return cName.includes('baker')
    if (target === 'chocolates') return cName.includes('choc')
    if (target === 'gifting') return cName.includes('gift')
    return cName.includes(target) || target.includes(cName)
  })
  return matched.map((c) => c.id).join(',')
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const categoryId = searchParams.get('category_id') || ''
  const stateFilter = searchParams.get('state') || ''
  const minPrice = searchParams.get('min_price') || ''
  const maxPrice = searchParams.get('max_price') || ''
  const sort = searchParams.get('sort') || ''

  const [minInput, setMinInput] = useState(minPrice)
  const [maxInput, setMaxInput] = useState(maxPrice)

  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [states, setStates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setMinInput(minPrice)
  }, [minPrice])
  useEffect(() => {
    setMaxInput(maxPrice)
  }, [maxPrice])

  useEffect(() => {
    api
      .get('/categories/')
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    api
      .get('/states/')
      .then((response) => setStates(response.data))
      .catch(() => setStates([]))
  }, [])

  const minNumber = minInput === '' ? null : Number(minInput)
  const maxNumber = maxInput === '' ? null : Number(maxInput)
  let priceProblem = ''
  if ((minNumber !== null && (Number.isNaN(minNumber) || minNumber < 0)) || (maxNumber !== null && (Number.isNaN(maxNumber) || maxNumber < 0))) {
    priceProblem = 'Prices must be numbers, 0 or more.'
  } else if (minNumber !== null && maxNumber !== null && minNumber > maxNumber) {
    priceProblem = 'The minimum price cannot be more than the maximum price.'
  }

  // Debounced price range filter
  useEffect(() => {
    if (minInput === minPrice && maxInput === maxPrice) return
    if (priceProblem) return
    const timer = setTimeout(() => {
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          if (minInput) next.set('min_price', minInput)
          else next.delete('min_price')
          if (maxInput) next.set('max_price', maxInput)
          else next.delete('max_price')
          return next
        },
        { replace: true }
      )
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [minInput, maxInput, minPrice, maxPrice, priceProblem, setSearchParams])

  // Fetch products from backend
  useEffect(() => {
    let ignore = false
    const params = {}
    if (search) params.search = search
    if (categoryId) params.category_id = categoryId
    if (stateFilter) params.state = stateFilter
    if (minPrice) params.min_price = minPrice
    if (maxPrice) params.max_price = maxPrice
    if (sort) params.sort = sort

    setLoading(true)
    setError('')
    api
      .get('/products/', { params })
      .then((response) => {
        if (!ignore) setProducts(response.data)
      })
      .catch((err) => {
        if (!ignore) {
          setProducts([])
          const backendText = err.response?.data?.error
          setError(backendText || getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [search, categoryId, stateFilter, minPrice, maxPrice, sort])

  function updateFilter(name, value) {
    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)
      if (value) next.set(name, value)
      else next.delete(name)
      return next
    })
  }

  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  // Mutually exclusive active category resolver
  function getActiveSidebarCategory() {
    if (categoryId && categories.length > 0) {
      const activeIds = new Set(categoryId.split(',').map((id) => id.trim()))
      for (const catName of SIDEBAR_CATEGORIES) {
        const sectionIds = getCategoryIdsForSection(catName, categories).split(',')
        if (sectionIds.some((sid) => sid && activeIds.has(sid))) {
          return catName
        }
      }
      for (const id of activeIds) {
        const cat = categories.find((c) => c.id === id)
        if (cat) {
          const cName = cat.name.toLowerCase()
          if (cName.includes('sweet')) return 'Sweets'
          if (cName.includes('namkeen')) return 'Namkeens'
          if (cName.includes('snack')) return 'Snacks'
          if (cName.includes('baker')) return 'Bakery & Boulangerie'
          if (cName.includes('choc')) return 'Chocolates'
          if (cName.includes('gift')) return 'Gifting'
        }
      }
    }
    if (search) {
      const s = search.toLowerCase()
      for (const catName of SIDEBAR_CATEGORIES) {
        const target = catName.toLowerCase()
        if (s === target || (s.length > 2 && (target.includes(s) || s.includes(target)))) {
          return catName
        }
      }
    }
    return null
  }

  const activeSidebarCategory = getActiveSidebarCategory()

  function handleCategorySelect(catName) {
    const isCurrentlySelected = activeSidebarCategory === catName

    setSearchParams((previous) => {
      const next = new URLSearchParams(previous)

      // Always clear search term so it doesn't conflict with category products
      next.delete('search')

      if (isCurrentlySelected) {
        // Toggle off
        next.delete('category_id')
      } else {
        const targetIds = getCategoryIdsForSection(catName, categories)
        if (targetIds) {
          next.set('category_id', targetIds)
        } else {
          next.set('search', catName)
        }
      }
      return next
    })
  }

  function clearFilters() {
    setMinInput('')
    setMaxInput('')
    setSearchParams(new URLSearchParams())
  }

  const currentCategoryName = activeSidebarCategory
    ? activeSidebarCategory
    : categoryId && categoryNames[categoryId]
    ? categoryNames[categoryId]
    : search
    ? `Search: "${search}"`
    : 'All Products'

  const hasFilters = Boolean(search || categoryId || stateFilter || minPrice || maxPrice || sort)

  return (
    <div className="bg-[#FFF8EC]/60 min-h-screen pb-16">
      {/* Breadcrumb Header */}
      <div className="border-b border-[#E8D5B5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-xs sm:text-sm text-[#542B24]/70 lg:px-8">
          <Link to="/" className="text-[#542B24] hover:text-[#9B4A32] font-semibold transition-colors">
            Home
          </Link>
          <span>/</span>
          <span className="font-bold text-[#9B4A32]">{currentCategoryName}</span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
        {/* Page Title with Balanced Medium Typography */}
        <div className="mb-6">
          <div className="flex items-center gap-2.5">
            <h1 className="font-sans text-2xl sm:text-3xl font-bold text-[#542B24] tracking-tight">
              {currentCategoryName}
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8EC] px-2.5 py-0.5 text-xs font-semibold text-[#9B4A32] border border-[#C99A42]">
              <Sparkles size={12} className="text-[#C99A42]" /> Artisanal
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-[#542B24]/70 font-medium">
            Fresh handcrafted delicacies prepared with authentic traditional recipes and 100% pure ingredients.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Filter Sidebar */}
          <aside className="lg:col-span-3 space-y-5">
            <div className="rounded-xl border border-[#E8D5B5] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#E8D5B5] pb-3">
                <div className="flex items-center gap-2 font-bold text-[#542B24] text-sm sm:text-base">
                  <SlidersHorizontal size={16} className="text-[#9B4A32]" />
                  <span>Filter By:</span>
                </div>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs font-semibold text-[#9B4A32] hover:text-[#542B24] hover:underline transition-transform active:scale-95"
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>

              {/* Sub Category Section */}
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[#542B24]/70 mb-2.5 flex items-center justify-between">
                  <span>Sub Category</span>
                  <ChevronDown size={14} className="text-[#9B4A32]" />
                </p>

                {/* Soft Cream Card with Medium Pill Buttons */}
                <div className="rounded-xl bg-[#FFF8EC] p-2.5 border border-[#E8D5B5] flex flex-col gap-1.5">
                  {SIDEBAR_CATEGORIES.map((catName) => {
                    const isSelected = activeSidebarCategory === catName
                    return (
                      <button
                        key={catName}
                        type="button"
                        onClick={() => handleCategorySelect(catName)}
                        className={`w-full text-left rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 active:scale-98 ${
                          isSelected
                            ? 'bg-[#542B24] text-[#FFF8EC] shadow-xs ring-1 ring-[#C99A42]'
                            : 'bg-white text-[#542B24] border border-[#E8D5B5] hover:border-[#9B4A32] hover:bg-[#E8D5B5]/40 hover:text-[#9B4A32]'
                        }`}
                      >
                        {catName}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* State Filter */}
              {states.length > 0 && (
                <div className="mt-5 border-t border-[#E8D5B5] pt-4">
                  <label htmlFor="sidebar-state" className="block text-xs font-bold uppercase tracking-wider text-[#542B24]/70 mb-2">
                    Region / State
                  </label>
                  <select
                    id="sidebar-state"
                    value={stateFilter}
                    onChange={(e) => updateFilter('state', e.target.value)}
                    className="w-full rounded-lg border border-[#E8D5B5] bg-white px-3 py-2 text-xs sm:text-sm font-medium text-[#542B24] outline-none focus:border-[#9B4A32] focus:ring-1 focus:ring-[#C99A42] transition-all cursor-pointer"
                  >
                    <option value="">All States Across India</option>
                    {states.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Price Filter */}
              <div className="mt-5 border-t border-[#E8D5B5] pt-4">
                <span className="block text-xs font-bold uppercase tracking-wider text-[#542B24]/70 mb-2">
                  Price Range (₹)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Min ₹"
                    value={minInput}
                    onChange={(e) => setMinInput(e.target.value)}
                    className="w-full rounded-lg border border-[#E8D5B5] px-3 py-1.5 text-xs sm:text-sm font-medium outline-none focus:border-[#9B4A32] focus:ring-1 focus:ring-[#C99A42] transition-all"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Max ₹"
                    value={maxInput}
                    onChange={(e) => setMaxInput(e.target.value)}
                    className="w-full rounded-lg border border-[#E8D5B5] px-3 py-1.5 text-xs sm:text-sm font-medium outline-none focus:border-[#9B4A32] focus:ring-1 focus:ring-[#C99A42] transition-all"
                  />
                </div>
                {priceProblem && <p className="mt-1.5 text-xs font-medium text-red-600">{priceProblem}</p>}
              </div>

              {/* Sort By Filter */}
              <div className="mt-5 border-t border-[#E8D5B5] pt-4">
                <label htmlFor="sidebar-sort" className="block text-xs font-bold uppercase tracking-wider text-[#542B24]/70 mb-2">
                  Sort Delicacies
                </label>
                <select
                  id="sidebar-sort"
                  value={sort}
                  onChange={(e) => updateFilter('sort', e.target.value)}
                  className="w-full rounded-lg border border-[#E8D5B5] bg-white px-3 py-2 text-xs sm:text-sm font-medium text-[#542B24] outline-none focus:border-[#9B4A32] focus:ring-1 focus:ring-[#C99A42] transition-all cursor-pointer"
                >
                  <option value="">Featured / Newest First</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </aside>

          {/* Right Product Grid */}
          <main className="lg:col-span-9">
            {loading && (
              <div className="flex min-h-[35vh] items-center justify-center py-16">
                <div className="flex flex-col items-center gap-2.5">
                  <div className="h-9 w-9 animate-spin rounded-full border-3 border-[#E8D5B5] border-t-[#9B4A32]" />
                  <p className="text-xs sm:text-sm font-semibold text-[#542B24]">Loading fresh sweets...</p>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center text-xs sm:text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            {!loading && !error && products.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#E8D5B5] bg-white p-12 text-center shadow-2xs">
                <p className="font-bold text-[#542B24] text-base sm:text-lg">No delicacies found in this category.</p>
                <p className="mt-1 text-xs sm:text-sm text-[#542B24]/60">Explore other categories or reset your active filters.</p>
                {hasFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-4 rounded-full bg-[#9B4A32] px-6 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#542B24] transition-transform active:scale-95"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            )}

            {!loading && !error && products.length > 0 && (
              <ProductGrid
                key={[search, categoryId, stateFilter, minPrice, maxPrice, sort].join('|')}
                products={products}
                categoryNames={categoryNames}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
