import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Boxes,
  ChevronRight,
  Gift,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react'
import ProductCard from '../components/ProductCard'
import ProductGrid from '../components/ProductGrid'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

// Real commercial food photography for categories (replaced cartoon icons)
const CATEGORY_TILES = [
  {
    name: 'Sweets',
    image: '/images/sweets/kaju-katli-aesthetic.jpg',
    tag: 'Traditional Delicacies',
    filter: 'Sweets',
  },
  {
    name: 'Namkeens',
    image: '/images/sweets/bikaneri-bhujia.jpg',
    tag: 'Savouries & Mixtures',
    filter: 'Namkeen',
  },
  {
    name: 'Snacks',
    image: '/images/sweets/bhakarwadi.jpg',
    tag: 'Bakewadi & Puffs',
    filter: 'Snacks',
  },
  {
    name: 'Bakery',
    image: '/images/sweets/butter-croissants.jpg',
    tag: 'Cookies & Cakes',
    filter: 'Bakery & Boulangerie',
  },
  {
    name: 'Chocolates',
    image: '/images/sweets/dark-cocoa-truffles.jpg',
    tag: 'Artisanal Truffles',
    filter: 'Chocolates',
  },
  {
    name: 'Gifting',
    image: '/images/sweets/royal-mithai-box.jpg',
    tag: 'Royal Hampers',
    filter: 'Gifting',
  },
]

// Signature sweets animated hero showcase
const HERO_SHOWCASE = [
  {
    name: 'Royal Kaju Katli',
    tag: 'Pure Silver Vark • Premium Goan Cashews',
    image: '/images/sweets/kaju-katli-aesthetic.jpg',
    state: 'Delhi NCR',
    badge: 'Best Seller',
    tabName: 'Kaju Katli',
  },
  {
    name: 'Motichoor Laddu',
    tag: 'Pure Desi Ghee Boondi Pearls • Pistachio Garnish',
    image: '/images/sweets/motichoor-laddu.jpg',
    state: 'Rajasthan',
    badge: 'Festive Classic',
    tabName: 'Motichoor',
  },
  {
    name: 'Shahi Gulab Jamun',
    tag: 'Warm Rose-Cardamom Syrup • Juicy & Plump',
    image: '/images/sweets/gulab-jamun-aesthetic.jpg',
    state: 'Uttar Pradesh',
    badge: 'Chef Signature',
    tabName: 'Gulab Jamun',
  },
  {
    name: 'Royal Rasmalai',
    tag: 'Golden Saffron Rabri • Kashmiri Kesar & Pista',
    image: '/images/sweets/rasmalai-aesthetic.jpg',
    state: 'West Bengal',
    badge: 'Rich & Creamy',
    tabName: 'Rasmalai',
  },
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
  const [heroIndex, setHeroIndex] = useState(0)
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

  // Auto-rotate hero showcase every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_SHOWCASE.length)
    }, 4500)
    return () => clearInterval(timer)
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
      {/* Hero Banner: The Heritage Collection with Animated Visual Showcase */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#542B24] via-[#753424] to-[#9B4A32] text-[#FFF8EC]">
        {/* Subtle patterned gold grid */}
        <div className="absolute inset-0 bg-[radial-gradient(#C99A42_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:py-16 lg:py-20 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Column: Headlines, Value Props & Actions */}
            <div className="lg:col-span-7 text-center lg:text-left">
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

              <p className="mt-4 text-sm sm:text-base text-[#E8D5B5] font-normal leading-relaxed max-w-xl mx-auto lg:mx-0">
                Indulge in the legacy of flavor with MithaiMart. Handcrafted with 100% pure desi ghee, premium dry fruits, and secret recipes preserved since 1957.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
                <Link
                  to="/products"
                  className="rounded-full bg-[#C99A42] px-8 py-3.5 text-xs sm:text-sm font-extrabold text-[#542B24] shadow-lg shadow-black/25 transition-all duration-300 hover:bg-[#E8D5B5] hover:scale-105 active:scale-95"
                >
                  Explore Sweets
                </Link>
                <Link
                  to="/build-hamper"
                  className="rounded-full border border-[#E8D5B5]/60 bg-white/10 backdrop-blur-md px-7 py-3.5 text-xs sm:text-sm font-extrabold text-[#FFF8EC] transition-all duration-300 hover:bg-white/20 hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <Gift size={15} className="text-[#C99A42]" />
                  <span>Customize Hamper</span>
                </Link>
                <Link
                  to="/bulk-orders"
                  className="rounded-full border border-[#C99A42]/50 bg-[#542B24]/80 backdrop-blur-md px-6 py-3.5 text-xs sm:text-sm font-extrabold text-[#FFF8EC] transition-all duration-300 hover:bg-[#C99A42] hover:text-[#542B24] hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <Boxes size={15} className="text-[#C99A42]" />
                  <span>Wholesale</span>
                </Link>
              </div>

              {/* Micro value props */}
              <div className="mt-10 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-[#E8D5B5] font-semibold">
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

            {/* Right Column: Luxury Animated Interactive Hero Visual */}
            <div className="lg:col-span-5 relative mt-6 lg:mt-0 flex flex-col items-center justify-center">
              {/* Pulsating Golden Ambient Aura */}
              <div className="absolute -inset-4 sm:-inset-6 rounded-full bg-gradient-to-tr from-[#C99A42]/35 via-[#9B4A32]/25 to-transparent blur-3xl animate-pulse pointer-events-none" />

              {/* Centerpiece Image Showcase Card */}
              <div className="relative group w-72 h-72 sm:w-84 sm:h-84 md:w-92 md:h-92 rounded-3xl overflow-hidden border-2 border-[#C99A42]/60 bg-gradient-to-br from-[#542B24] to-[#292929] shadow-2xl shadow-black/50 transition-all duration-500">
                <img
                  key={HERO_SHOWCASE[heroIndex].image}
                  src={HERO_SHOWCASE[heroIndex].image}
                  alt={HERO_SHOWCASE[heroIndex].name}
                  className="h-full w-full object-cover object-center transition-all duration-700 ease-out group-hover:scale-105 animate-fade-in"
                />

                {/* Gradient bottom overlay with sweet details */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-4 sm:p-5 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-[#C99A42] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#542B24]">
                      {HERO_SHOWCASE[heroIndex].badge}
                    </span>
                    <span className="text-[11px] text-[#E8D5B5] font-semibold">
                      Authentic • {HERO_SHOWCASE[heroIndex].state}
                    </span>
                  </div>
                  <h3 className="font-serif text-lg sm:text-xl font-bold text-[#FFF8EC]">
                    {HERO_SHOWCASE[heroIndex].name}
                  </h3>
                  <p className="text-xs text-[#E8D5B5]/90">
                    {HERO_SHOWCASE[heroIndex].tag}
                  </p>
                </div>
              </div>

              {/* Floating Badge 1 (Top-Right): 100% Pure Ghee with animation */}
              <div className="hidden sm:flex absolute -top-4 -right-3 sm:-right-6 rounded-2xl bg-[#FFF8EC]/95 backdrop-blur-md px-3.5 py-2 shadow-xl border border-[#C99A42]/50 items-center gap-2.5 animate-float z-20">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden border border-[#C99A42] shrink-0">
                  <img src="/images/sweets/motichoor-laddu.jpg" alt="Pure Ghee" className="h-full w-full object-cover" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-[#9B4A32] leading-none">100% Pure Ghee</p>
                  <p className="text-xs font-black text-[#542B24] mt-0.5">Desi Delicacies</p>
                </div>
              </div>

              {/* Floating Badge 2 (Middle-Left): 4.9 Rating (Completely clear of bottom tabs) */}
              <div className="hidden sm:flex absolute top-12 -left-4 sm:-left-8 rounded-2xl bg-[#FFF8EC]/95 backdrop-blur-md px-3.5 py-2 shadow-xl border border-[#C99A42]/50 items-center gap-2.5 animate-float [animation-delay:2.5s] z-20">
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full overflow-hidden border border-[#C99A42] shrink-0">
                  <img src="/images/sweets/kaju-katli-aesthetic.jpg" alt="Rating" className="h-full w-full object-cover" />
                </div>
                <div className="text-left">
                  <div className="flex items-center text-amber-500 text-[10px] leading-none">
                    ★★★★★ <span className="ml-1 text-[10px] font-black text-[#542B24]">4.9 / 5</span>
                  </div>
                  <p className="text-xs font-black text-[#542B24] mt-0.5">25k+ Happy Orders</p>
                </div>
              </div>

              {/* Quick Switcher Tabs (Spaced cleanly below the card) */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-2 relative z-10">
                {HERO_SHOWCASE.map((item, idx) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => setHeroIndex(idx)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      heroIndex === idx
                        ? 'bg-[#C99A42] text-[#542B24] shadow-md scale-105'
                        : 'bg-[#542B24]/90 text-[#E8D5B5] hover:bg-[#542B24] hover:text-white border border-[#C99A42]/30'
                    }`}
                  >
                    {item.tabName}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom banner strip */}
        <div className="border-t border-[#E8D5B5]/20 bg-black/25 backdrop-blur-md py-3 text-center text-xs font-semibold tracking-wide text-[#E8D5B5]">
          Indulge in the legacy of flavor with MithaiMart • Delivering sweetness across 500+ Indian cities
        </div>
      </section>

      {/* Discover Categories Section (With Real Food Photography instead of icons) */}
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
                className="group relative flex flex-col items-center rounded-2xl border border-[#E8D5B5] bg-white p-4 sm:p-5 text-center shadow-xs transition-all duration-300 hover:-translate-y-2 hover:border-[#9B4A32] hover:shadow-xl hover:shadow-[#9B4A32]/10 overflow-hidden"
              >
                {/* Subtle warm hover wash */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#FFF8EC] via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Real Commercial Food Photography */}
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-full overflow-hidden border-2 border-[#E8D5B5] shadow-inner bg-[#FFF8EC] group-hover:border-[#9B4A32] group-hover:scale-105 group-hover:shadow-md transition-all duration-300">
                  <img
                    src={tile.image}
                    alt={tile.name}
                    loading="lazy"
                    className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-115"
                  />
                </div>

                <h3 className="relative mt-3.5 text-xs sm:text-sm font-bold text-[#542B24] group-hover:text-[#9B4A32] transition-colors">
                  {tile.name}
                </h3>
                <p className="relative mt-0.5 text-[11px] font-medium text-[#542B24]/60 group-hover:text-[#542B24]/80 transition-colors">
                  {tile.tag}
                </p>

                {/* Subtle explore arrow on hover */}
                <span className="relative mt-2 inline-flex items-center text-[10px] font-bold text-[#9B4A32] opacity-0 group-hover:opacity-100 transition-all duration-200 translate-y-1 group-hover:translate-y-0">
                  Explore &rarr;
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* Dual Animated Feature Banners: Custom Hamper & Bulk Wholesale */}
      <section className="mx-auto max-w-7xl px-4 pb-10 lg:px-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Banner 1: Build Your Own Mithai Hamper */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#542B24] to-[#753424] p-6 sm:p-8 text-[#FFF8EC] shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full bg-[#C99A42]/20 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#C99A42] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#542B24] mb-3">
                    <Sparkles size={11} /> Signature Gifting
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#FFF8EC]">
                    Customize Your Own Mithai Hamper
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-[#E8D5B5]/90">
                    Select your box size, handpick your favourite sweets, and add a personalized greeting card.
                  </p>
                </div>
                <div className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-2xl overflow-hidden border-2 border-[#C99A42]/60 shadow-lg group-hover:scale-105 group-hover:rotate-2 transition-transform duration-500">
                  <img
                    src="/images/sweets/royal-mithai-box.jpg"
                    alt="Custom Hamper"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/build-hamper"
                  className="inline-flex items-center gap-2 rounded-full bg-[#C99A42] px-6 py-2.5 text-xs font-bold text-[#542B24] shadow-md hover:bg-[#E8D5B5] transition-all hover:gap-3"
                >
                  <span>Build Your Hamper Now</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          {/* Banner 2: Bulk Wholesale Pricing */}
          <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#753424] to-[#9B4A32] p-6 sm:p-8 text-[#FFF8EC] shadow-md transition-all duration-300 hover:shadow-xl">
            <div className="absolute -right-8 -bottom-8 h-48 w-48 rounded-full bg-[#FFF8EC]/10 blur-2xl pointer-events-none" />
            <div className="relative z-10 flex flex-col justify-between h-full">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-xs">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF8EC] px-2.5 py-0.5 text-[10px] font-black uppercase text-[#9B4A32] mb-3">
                    <Boxes size={11} /> Save Up To 15%
                  </span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#FFF8EC]">
                    Bulk Orders & Wholesale Pricing
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm text-[#E8D5B5]/90">
                    Special wholesale pricing for weddings, corporate celebrations, festivals, and large events.
                  </p>
                </div>
                <div className="h-24 w-24 sm:h-28 sm:w-28 shrink-0 rounded-2xl overflow-hidden border-2 border-[#E8D5B5]/50 shadow-lg group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-500">
                  <img
                    src="/images/sweets/assorted-sweets-box-2.jpg"
                    alt="Bulk Wholesale"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              <div className="mt-6">
                <Link
                  to="/bulk-orders"
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-bold text-[#9B4A32] shadow-md hover:bg-[#FFF8EC] transition-all hover:gap-3"
                >
                  <span>View Bulk Discounts</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>
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
            <h2 className="font-sans text-2xl sm:text-3xl font-extrabold text-[#542B24] tracking-tight">
              All Sweets & Delicacies
            </h2>
            <p className="text-sm font-medium text-[#542B24]/70 mt-1">Explore our full range of fresh confectionery</p>
          </div>
          <Link
            to="/products"
            className="rounded-full border-2 border-[#9B4A32] px-6 py-2 text-sm font-bold text-[#9B4A32] hover:bg-[#9B4A32] hover:text-white transition-all active:scale-95 shadow-xs"
          >
            Filters & Search
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center text-sm font-bold text-[#542B24]/60">Loading sweets...</div>
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
