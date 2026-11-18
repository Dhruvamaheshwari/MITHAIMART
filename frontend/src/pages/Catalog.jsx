import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownToLine,
  BookOpen,
  Candy,
  Check,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Loader2,
  Printer,
  Search,
  Sparkles,
} from 'lucide-react'
import api from '../services/api'
import { formatPrice } from '../utils/helpers'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [selectedCat, setSelectedCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    Promise.all([api.get('/products/'), api.get('/categories/')])
      .then(([prodsRes, catsRes]) => {
        setProducts(prodsRes.data)
        setCategories(catsRes.data)
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // Download PDF from backend ReportLab generator
  async function handleDownloadPdf() {
    setDownloadingPdf(true)
    try {
      const response = await api.get('/catalog/pdf/', {
        responseType: 'blob',
      })
      // Create blob link to download
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'MithaiMart-Sweets-Catalog.pdf')
      document.body.appendChild(link)
      link.click()
      link.parentNode.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to download PDF catalog:', err)
      // Fallback: direct window open
      window.open('/api/catalog/pdf/', '_blank')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Filter products by category and search
  const categoryMap = Object.fromEntries(categories.map((c) => [c.id, c.name]))

  const filteredProducts = products.filter((p) => {
    if (selectedCat !== 'all' && p.category_id !== selectedCat) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = p.name?.toLowerCase().includes(q)
      const matchState = p.state?.toLowerCase().includes(q)
      const matchDesc = p.description?.toLowerCase().includes(q)
      return matchName || matchState || matchDesc
    }
    return true
  })

  // Group filtered products by category for structured catalog view
  const groupedProducts = {}
  for (const p of filteredProducts) {
    const cName = categoryMap[p.category_id] || 'Sweets & Savouries'
    if (!groupedProducts[cName]) groupedProducts[cName] = []
    groupedProducts[cName].push(p)
  }

  return (
    <div className="bg-[#FFF8EC]/40 py-10 sm:py-14 animate-fade-in">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Header Hero */}
        <div className="rounded-3xl border border-[#E8D5B5] bg-gradient-to-r from-[#542B24] via-[#753424] to-[#9B4A32] p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(#C99A42_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1 text-xs font-bold tracking-wider text-[#C99A42] backdrop-blur-md border border-[#C99A42]/30 mb-3">
                <Sparkles size={13} className="text-[#C99A42]" />
                OFFICIAL PRODUCT MENU & PRICE LIST
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-[#FFF8EC] tracking-tight">
                MithaiMart Sweets <span className="text-[#C99A42]">Catalog</span>
              </h1>
              <p className="mt-3 text-xs sm:text-sm text-[#E8D5B5] leading-relaxed max-w-xl">
                Browse our complete collection of handcrafted pure desi ghee sweets, royal dry fruit delights, cookies, savouries, and gifting hampers. Download the official PDF menu for offline viewing and bulk celebration planning.
              </p>
            </div>

            {/* Big PDF Download Action */}
            <div className="shrink-0 w-full sm:w-auto">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
                className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-2xl bg-[#C99A42] hover:bg-[#E8D5B5] text-[#542B24] px-8 py-4 font-black text-sm sm:text-base shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-70 cursor-pointer group"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 size={22} className="animate-spin text-[#542B24]" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={22} className="group-hover:translate-y-0.5 transition-transform" />
                    <span>Download PDF Catalog</span>
                  </>
                )}
              </button>
              <span className="block text-center text-[11px] text-[#E8D5B5]/80 mt-2 font-medium">
                📄 High-resolution PDF with complete price list
              </span>
            </div>
          </div>
        </div>

        {/* Catalog Control Bar: Search & Category Pills */}
        <div className="mt-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
          {/* Search inside catalog */}
          <div className="relative w-full md:max-w-md">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#542B24]/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog by sweet name, state, or ingredients..."
              className="w-full rounded-xl border border-[#E8D5B5] bg-white pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 shadow-2xs transition"
            />
          </div>

          {/* Quick Counter */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#542B24]/75 shrink-0 self-center">
            <span>Showing <strong className="text-[#9B4A32]">{filteredProducts.length}</strong> delicacies</span>
          </div>
        </div>

        {/* Category Pills Slider */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCat('all')}
            className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
              selectedCat === 'all'
                ? 'bg-[#9B4A32] text-white shadow-xs'
                : 'bg-white border border-[#E8D5B5] text-[#542B24] hover:border-[#9B4A32]'
            }`}
          >
            All Categories ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(c.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer ${
                selectedCat === c.id
                  ? 'bg-[#9B4A32] text-white shadow-xs'
                  : 'bg-white border border-[#E8D5B5] text-[#542B24] hover:border-[#9B4A32]'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Catalog Content */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 size={36} className="mx-auto animate-spin text-[#9B4A32]" />
            <p className="mt-3 text-sm text-[#542B24]/70 font-medium">Loading catalog delicacies...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center rounded-2xl border border-dashed border-[#E8D5B5] bg-white mt-6">
            <Candy size={40} className="mx-auto text-[#9B4A32]/40" />
            <h3 className="mt-3 text-base font-bold text-[#542B24]">No delicacies found matching your search</h3>
            <p className="text-xs text-[#542B24]/60 mt-1">Try clearing filters or searching for another sweet</p>
            <button
              type="button"
              onClick={() => {
                setSelectedCat('all')
                setSearchQuery('')
              }}
              className="mt-4 rounded-xl bg-[#9B4A32] px-5 py-2 text-xs font-bold text-white shadow-xs"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {Object.entries(groupedProducts).map(([categoryName, items]) => (
              <div key={categoryName} className="rounded-2xl border border-[#E8D5B5] bg-white overflow-hidden shadow-2xs">
                {/* Section Header */}
                <div className="flex items-center justify-between bg-gradient-to-r from-[#542B24] to-[#753424] px-6 py-3.5 text-white">
                  <div className="flex items-center gap-3">
                    <h2 className="font-serif text-lg font-bold text-[#FFF8EC]">{categoryName}</h2>
                    <span className="text-[11px] font-semibold bg-[#C99A42] text-[#542B24] px-2.5 py-0.5 rounded-full">
                      {items.length} Items
                    </span>
                  </div>
                </div>

                {/* Table of Delicacies */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#FFF8EC] border-b border-[#E8D5B5] text-[#542B24] font-bold uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Sweet / Delicacy</th>
                        <th className="py-3 px-4">Origin State</th>
                        <th className="py-3 px-4">Description</th>
                        <th className="py-3 px-4">Available Weights & Prices</th>
                        <th className="py-3 px-4 text-right">Order</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8D5B5]/60 text-[#542B24]">
                      {items.map((prod) => (
                        <tr key={prod.id} className="hover:bg-[#FFF8EC]/60 transition-colors group">
                          {/* Name + Thumbnail */}
                          <td className="py-3 px-4 font-bold text-[#542B24] flex items-center gap-3">
                            {prod.image_url ? (
                              <img
                                src={prod.image_url}
                                alt={prod.name}
                                className="h-10 w-10 rounded-lg object-cover border border-[#E8D5B5] shrink-0"
                                loading="lazy"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-[#FFF8EC] flex items-center justify-center text-[#9B4A32] border border-[#E8D5B5] shrink-0">
                                <Candy size={18} />
                              </div>
                            )}
                            <div>
                              <Link
                                to={`/products/${prod.id}`}
                                className="hover:text-[#9B4A32] transition-colors block font-semibold text-xs sm:text-sm"
                              >
                                {prod.name}
                              </Link>
                            </div>
                          </td>

                          {/* State */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-block rounded-full bg-[#E8D5B5]/40 px-2.5 py-0.5 text-[11px] font-semibold text-[#542B24]">
                              {prod.state || 'Heritage'}
                            </span>
                          </td>

                          {/* Description */}
                          <td className="py-3 px-4 text-[#542B24]/75 max-w-xs truncate" title={prod.description}>
                            {prod.description}
                          </td>

                          {/* Weights and Prices */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex flex-wrap gap-1.5">
                              {prod.variants && prod.variants.length > 0 ? (
                                prod.variants.map((v, i) => (
                                  <span
                                    key={i}
                                    className="inline-flex items-center gap-1 rounded-md bg-[#FFF8EC] border border-[#E8D5B5] px-2 py-0.5 text-[11px] font-medium"
                                  >
                                    <span className="text-[#542B24]/70">{v.weight}:</span>
                                    <strong className="text-[#9B4A32]">₹{v.price}</strong>
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-400">Available on request</span>
                              )}
                            </div>
                          </td>

                          {/* Action */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <Link
                              to={`/products/${prod.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#9B4A32] hover:bg-[#542B24] text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition-colors"
                            >
                              <span>View</span>
                              <ExternalLink size={12} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
