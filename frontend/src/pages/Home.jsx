import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import ProductCard from '../components/ProductCard'
import ProductGrid from '../components/ProductGrid'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

const CATEGORY_TILES = [
  { name: 'Sweets', icon: '🍬', tag: 'Traditional Delicacies', filter: 'Sweets' },
  { name: 'Namkeens', icon: '🥨', tag: 'Savouries & Mixtures', filter: 'Namkeen' },
  { name: 'Snacks', icon: '🥟', tag: 'Bakewadi & Puffs', filter: 'Snacks' },
  { name: 'Bakery', icon: '🥐', tag: 'Cookies & Cakes', filter: 'Bakery & Boulangerie' },
  { name: 'Chocolates', icon: '🍫', tag: 'Artisanal Truffles', filter: 'Chocolates' },
  { name: 'Gifting', icon: '🎁', tag: 'Royal Hampers', filter: 'Gifting' },
]

function getCategoryIdsForSection(sectionName, categories) {
  if (!sectionName || !categories || !categories.length) return ''
  const target = sectionName.toLowerCase()
  const matched = categories.filter((c) => {
    const cName = c.name.toLowerCase()
    if (target === 'sweets') return cName.includes('sweet')
    if (target === 'namkeens' || target === 'namkeen') return cName.includes('namkeen')
    if (target === 'snacks') return cName.includes('snack')
    if (target.includes('baker')) return cName.includes('baker')
    if (target.includes('choc')) return cName.includes('choc')
    if (target.includes('gift')) return cName.includes('gift')
    return cName.includes(target) || target.includes(cName)
  })
  return matched.map((c) => c.id).join(',')
}

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const carouselRef = useRef(null)

  useEffect(() => {
    Promise.all([api.get('/products/'), api.get('/categories/')])
      .then(([productsResponse, categoriesResponse]) => {
        setProducts(productsResponse.data)
        setCategories(categoriesResponse.data)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  const categoryNames = Object.fromEntries(categories.map((c) => [c.id, c.name]))
  const featuredSweets = products.slice(0, 10)

  const stateCounts = {}
  for (const product of products) {
    if (product.state) stateCounts[product.state] = (stateCounts[product.state] || 0) + 1
  }
  const statesWithItems = Object.keys(stateCounts).sort()

  function scrollCarousel(dir) {
    if (!carouselRef.current) return
    const offset = dir === 'left' ? -340 : 340
    carouselRef.current.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <div className="bg-[#FFF8EC]/40">
      {/* Hero Banner: The Heritage Collection (#542B24 through #9B4A32 with #C99A42 Gold) */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#542B24] via-[#753424] to-[#9B4A32] text-[#FFF8EC]">
        <div className="absolute inset-0 bg-[radial-gradient(#C99A42_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-18 sm:py-24 lg:px-8">
          <div className="max-w-2xl text-center md:text-left">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold tracking-wider text-[#C99A42] backdrop-blur-md border border-[#C99A42]/30 shadow-xs animate-fade-in">
              <Sparkles size={13} className="text-[#C99A42]" />
              ARTISANAL • EVERLASTING • OPULENT
            </span>

            <h1 className="mt-4 font-serif text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#FFF8EC] leading-tight">
              THE HERITAGE <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[#C99A42] via-[#E8D5B5] to-[#FFF8EC] bg-clip-text text-transparent">
                MITHAI COLLECTION
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-[#E8D5B5] font-normal leading-relaxed">
              Indulge in the legacy of flavor with MithaiMart. Handcrafted with 100% pure desi ghee, premium dry fruits, and secret recipes preserved since 1957.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center md:justify-start gap-3.5">
              <Link
                to="/products"
                className="rounded-full bg-[#C99A42] px-8 py-3.5 text-xs sm:text-sm font-extrabold text-[#542B24] shadow-lg shadow-black/20 transition-all duration-300 hover:bg-[#E8D5B5] hover:scale-105 active:scale-95"
              >
                Explore Sweets
              </Link>
              <Link
                to={getCategoryIdsForSection('Gifting', categories) ? `/products?category_id=${getCategoryIdsForSection('Gifting', categories)}` : '/products?search=Gifting'}
                className="rounded-full border border-[#E8D5B5]/60 bg-white/10 backdrop-blur-md px-7 py-3.5 text-xs sm:text-sm font-extrabold text-[#FFF8EC] transition-all duration-300 hover:bg-white/20 hover:scale-105 active:scale-95"
              >
                Gifting Boxes
              </Link>
            </div>

            {/* Micro value props */}
            <div className="mt-10 flex flex-wrap items-center justify-center md:justify-start gap-6 text-xs text-[#E8D5B5] font-semibold">
              <span className="flex items-center gap-1.5">
                <ShieldCheck size={16} className="text-[#C99A42]" /> 100% Pure Desi Ghee
              </span>
              <span className="flex items-center gap-1.5">
                <Truck size={16} className="text-[#C99A42]" /> Pan-India Courier
              </span>
              <span className="flex items-center gap-1.5">
                <Award size={16} className="text-[#C99A42]" /> Since 1957 Heritage
              </span>
            </div>
          </div>
        </div>

        {/* Bottom banner strip */}
        <div className="border-t border-[#E8D5B5]/20 bg-black/25 backdrop-blur-md py-3 text-center text-xs font-semibold tracking-wide text-[#E8D5B5]">
          Indulge in the legacy of flavor with MithaiMart • Delivering sweetness across 500+ Indian cities
        </div>
      </section>

      {/* Discover Categories Section */}
      <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="text-center">
          <h2 className="font-sans text-2xl sm:text-3xl font-bold text-[#542B24] tracking-tight">
            Discover Categories
          </h2>
          <p className="mt-1.5 text-xs sm:text-sm font-medium text-[#542B24]/70">
            Explore authentic sweets, snacks, chocolates, and bakery delicacies
          </p>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORY_TILES.map((tile) => {
            const catIds = getCategoryIdsForSection(tile.name, categories)
            const targetUrl = catIds ? `/products?category_id=${catIds}` : `/products?search=${encodeURIComponent(tile.filter)}`
            return (
              <Link
                key={tile.name}
                to={targetUrl}
                className="group flex flex-col items-center rounded-xl border border-[#E8D5B5] bg-white p-5 text-center shadow-2xs transition-all duration-200 hover:-translate-y-1 hover:border-[#9B4A32] hover:shadow-md"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFF8EC] text-2xl transition-transform duration-200 group-hover:scale-110 group-hover:bg-[#E8D5B5]/50">
                  {tile.icon}
                </div>
                <h3 className="mt-3 text-xs sm:text-sm font-bold text-[#542B24] group-hover:text-[#9B4A32] transition-colors">
                  {tile.name}
                </h3>
                <p className="mt-0.5 text-[11px] text-[#542B24]/60 font-medium">{tile.tag}</p>
              </Link>
            )
          })}
        </div>
      </section>

      {/* "You might also like these" Carousel */}
      {featuredSweets.length > 0 && (
        <section className="border-y border-[#E8D5B5]/60 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-sans text-xl sm:text-2xl font-bold text-[#542B24] tracking-tight">
                  You might also like these
                </h2>
                <p className="text-xs sm:text-sm font-medium text-[#542B24]/70 mt-0.5">Customer favorites & signature delicacies</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCarousel('left')}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E8D5B5] bg-[#FFF8EC] text-[#542B24] hover:bg-[#E8D5B5]/50 transition-transform active:scale-95 shadow-2xs"
                  aria-label="Previous sweets"
                >
                  <ArrowLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarousel('right')}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#9B4A32] text-white hover:bg-[#542B24] transition-transform active:scale-95 shadow-2xs"
                  aria-label="Next sweets"
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
              {featuredSweets.map((product) => (
                <div key={product.id} className="w-60 shrink-0" style={{ scrollSnapAlign: 'start' }}>
                  <ProductCard product={product} categoryName={categoryNames[product.category_id]} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Shop by State */}
      {statesWithItems.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h2 className="font-sans text-xl sm:text-2xl font-bold text-[#542B24] tracking-tight">
                Shop by State & Region
              </h2>
              <p className="text-xs sm:text-sm font-medium text-[#542B24]/70 mt-0.5">Explore iconic sweet traditions from across India</p>
            </div>
            <Link to="/products" className="text-xs sm:text-sm font-bold text-[#9B4A32] hover:text-[#542B24] hover:underline flex items-center gap-1">
              View All <ChevronRight size={14} />
            </Link>
          </div>

          <div className="flex flex-wrap gap-2">
            {statesWithItems.map((state) => (
              <Link
                key={state}
                to={`/products?state=${encodeURIComponent(state)}`}
                className="inline-flex items-center gap-2 rounded-full border border-[#E8D5B5] bg-white px-4 py-2 text-xs font-semibold text-[#542B24] shadow-2xs transition-all duration-200 hover:border-[#9B4A32] hover:bg-[#FFF8EC] hover:text-[#9B4A32]"
              >
                <span>{state}</span>
                <span className="rounded-full bg-[#E8D5B5]/60 px-1.5 py-0.5 text-[10px] font-black text-[#542B24]">
                  {stateCounts[state]}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All Delicacies Grid Showcase */}
      <section className="mx-auto max-w-7xl px-4 py-10 pb-20 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              All Sweets & Delicacies
            </h2>
            <p className="text-sm font-medium text-gray-500 mt-1">Explore our full range of fresh confectionery</p>
          </div>
          <Link
            to="/products"
            className="rounded-full border-2 border-[#8A00C2] px-6 py-2 text-sm font-bold text-[#8A00C2] hover:bg-[#8A00C2] hover:text-white transition-all active:scale-95 shadow-xs"
          >
            Filters & Search
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm font-bold text-gray-500">Loading sweets...</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : (
          <ProductGrid products={products} categoryNames={categoryNames} />
        )}
      </section>
    </div>
  )
}
