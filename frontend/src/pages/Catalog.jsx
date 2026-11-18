import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  ArrowDownToLine,
  BookOpen,
  Candy,
  Check,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Filter,
  Loader2,
  Maximize2,
  Printer,
  QrCode,
  Search,
  Share2,
  Sparkles,
  Truck,
  X,
} from 'lucide-react'
import api from '../services/api'

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingQr, setDownloadingQr] = useState(false)
  const [selectedCat, setSelectedCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')

  // Google Drive Sweet Catalog link requested by user
  const CATALOG_SHARE_URL = 'https://drive.google.com/file/d/1GNaSSHSl6RAJga3TLmpjHFht_LvgBEm8/view?usp=sharing'

  const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'
  const backendQrUrl = `${apiBase}/catalog/qr/?url=${encodeURIComponent(CATALOG_SHARE_URL)}`
  const qrImageUrl = qrDataUrl || backendQrUrl

  useEffect(() => {
    // Generate high-resolution branded client-side QR code for Google Drive catalog
    QRCode.toDataURL(CATALOG_SHARE_URL, {
      width: 480,
      margin: 2,
      color: {
        dark: '#542B24',
        light: '#FFF8EC',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Failed to generate QR code:', err))
  }, [])

  // Lock body scroll and handle Escape key when QR modal is open
  useEffect(() => {
    if (!qrModalOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setQrModalOpen(false)
    }
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [qrModalOpen])

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
      window.open('/api/catalog/pdf/', '_blank')
    } finally {
      setDownloadingPdf(false)
    }
  }

  // Download QR Code PNG image
  async function handleDownloadQr() {
    setDownloadingQr(true)
    try {
      if (qrDataUrl) {
        const link = document.createElement('a')
        link.href = qrDataUrl
        link.setAttribute('download', 'MithaiMart-Sweets-Catalog-QR.png')
        document.body.appendChild(link)
        link.click()
        link.parentNode.removeChild(link)
      } else {
        const response = await api.get('/catalog/qr/?download=1', {
          responseType: 'blob',
        })
        const blob = new Blob([response.data], { type: 'image/png' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', 'MithaiMart-Sweets-Catalog-QR.png')
        document.body.appendChild(link)
        link.click()
        link.parentNode.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Failed to download QR code:', err)
      if (qrDataUrl) {
        const link = document.createElement('a')
        link.href = qrDataUrl
        link.setAttribute('download', 'MithaiMart-Sweets-Catalog-QR.png')
        document.body.appendChild(link)
        link.click()
        link.parentNode.removeChild(link)
      } else {
        window.open('/api/catalog/qr/?download=1', '_blank')
      }
    } finally {
      setDownloadingQr(false)
    }
  }

  // Print Table Tent Standee for store counters / packaging
  function handlePrintStandee() {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    const fullQrUrl = qrDataUrl || backendQrUrl

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>MithaiMart Sweets Menu Standee</title>
          <style>
            @page { size: A5 portrait; margin: 12mm; }
            body { font-family: 'Georgia', serif; text-align: center; color: #542B24; background: #FFF8EC; padding: 20px; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .card { border: 3px double #C99A42; padding: 25px 20px; border-radius: 16px; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.06); max-width: 440px; margin: 0 auto; }
            .badge { display: inline-block; background: #9B4A32; color: #ffffff; padding: 4px 14px; border-radius: 20px; font-size: 10.5px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
            h1 { font-size: 30px; margin: 0 0 4px; color: #542B24; }
            h1 span { color: #9B4A32; }
            .sub { font-size: 11px; color: #C99A42; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 18px; }
            .qr-box { display: inline-block; padding: 12px; border: 2px solid #E8D5B5; border-radius: 14px; background: #FFF8EC; margin: 10px 0; }
            .qr-box img { width: 200px; height: 200px; display: block; border-radius: 6px; }
            .instruction { font-size: 14px; font-weight: bold; color: #542B24; margin: 10px 0 3px; }
            .instruction-sub { font-size: 11px; color: #666; margin-bottom: 16px; }
            .features { font-size: 10.5px; color: #542B24; line-height: 1.7; border-top: 1px solid #E8D5B5; padding-top: 14px; text-align: left; }
            .features strong { color: #9B4A32; }
            .footer { font-size: 9.5px; color: #888; margin-top: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">100% Pure Desi Ghee • Since 1957</div>
            <h1>Mithai<span>Mart</span></h1>
            <div class="sub">Authentic Sweets & Delicacies Catalog</div>
            <div class="qr-box">
              <img src="${fullQrUrl}" alt="MithaiMart Sweets Menu QR" />
            </div>
            <div class="instruction">Scan with any Phone Camera</div>
            <div class="instruction-sub">Browse all 158 delicacies, ingredients, prices & order online</div>
            <div class="features">
              • <strong>Heritage Flavors:</strong> Saffron Rabdi Rasmalai, Pure Ghee Besan Laddu, Kaju Katli.<br/>
              • <strong>Courier Delivery:</strong> Airtight vacuum-sealed delivery across 19,000+ Indian pincodes.<br/>
              • <strong>Live Order & Tracking:</strong> www.mithaimart.com • Helpline: +91 98765 43210
            </div>
            <div class="footer">MithaiMart Sweets & Savouries • Authentic Indian Confectionery</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
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
                Browse our complete collection of handcrafted pure desi ghee sweets, royal dry fruit delights, cookies, savouries, and gifting hampers. Download the official PDF menu or scan the QR code to open on mobile.
              </p>
            </div>

            {/* Actions: Download PDF & View QR */}
            <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-3 w-full sm:w-auto">
              <button
                type="button"
                disabled={downloadingPdf}
                onClick={handleDownloadPdf}
                className="flex items-center justify-center gap-2.5 rounded-2xl bg-[#C99A42] hover:bg-[#E8D5B5] text-[#542B24] px-7 py-3.5 font-black text-sm shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 disabled:opacity-70 cursor-pointer group"
              >
                {downloadingPdf ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-[#542B24]" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine size={18} className="group-hover:translate-y-0.5 transition-transform" />
                    <span>Download PDF Catalog</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setQrModalOpen(true)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-white/15 hover:bg-white/25 text-[#FFF8EC] border border-[#E8D5B5]/40 px-6 py-3 font-bold text-xs sm:text-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <QrCode size={18} className="text-[#C99A42]" />
                <span>Scan / Enlarge QR Code</span>
              </button>
            </div>
          </div>
        </div>

        {/* QR Code Feature Banner */}
        <div className="mt-8 rounded-2xl border border-[#E8D5B5] bg-white p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Scannable QR Image Container */}
            <div
              onClick={() => setQrModalOpen(true)}
              className="relative group p-2.5 rounded-2xl border-2 border-[#E8D5B5] bg-[#FFF8EC] shadow-xs cursor-pointer shrink-0 hover:border-[#9B4A32] transition-colors"
              title="Click to view full size QR code"
            >
              <img
                src={qrImageUrl}
                alt="Scan MithaiMart Sweets Catalog QR"
                className="h-28 w-28 sm:h-32 sm:w-32 rounded-xl object-contain"
                onError={(e) => {
                  if (qrDataUrl && e.currentTarget.src !== qrDataUrl) {
                    e.currentTarget.src = qrDataUrl
                  }
                }}
              />
              <span className="absolute inset-0 bg-[#542B24]/75 rounded-2xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs gap-1.5 backdrop-blur-2xs">
                <Maximize2 size={16} /> Enlarge
              </span>
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#9B4A32]/10 px-3 py-0.5 text-[11px] font-bold text-[#9B4A32] uppercase tracking-wider mb-1.5">
                <QrCode size={13} className="text-[#C99A42]" /> Instant Mobile Menu
              </div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-[#542B24]">
                Scan QR to View All Sweets
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#542B24]/70 max-w-lg leading-relaxed">
                Scan with any smartphone camera or Google Lens to view all 158 authentic sweets, weight options, live prices, and order online.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[#542B24]/80">
                <span className="bg-[#FFF8EC] px-2.5 py-1 rounded-md border border-[#E8D5B5]">
                  📱 Works on iPhone & Android Camera
                </span>
                <span className="bg-[#FFF8EC] px-2.5 py-1 rounded-md border border-[#E8D5B5]">
                  📦 For Sweet Boxes & Packaging
                </span>
                <a
                  href={CATALOG_SHARE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 bg-[#FFF8EC] hover:bg-[#E8D5B5]/60 text-[#9B4A32] px-2.5 py-1 rounded-md border border-[#E8D5B5] transition-colors"
                >
                  <ExternalLink size={12} /> Open Drive Link
                </a>
              </div>
            </div>
          </div>

          {/* QR Action Buttons */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 w-full md:w-auto shrink-0">
            <button
              type="button"
              disabled={downloadingQr}
              onClick={handleDownloadQr}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#542B24] hover:bg-[#9B4A32] text-white px-5 py-2.5 text-xs font-bold transition-colors shadow-xs active:scale-95 cursor-pointer disabled:opacity-60"
            >
              {downloadingQr ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              <span>Download QR (PNG)</span>
            </button>

            <button
              type="button"
              onClick={handlePrintStandee}
              className="flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-[#FFF8EC] text-[#542B24] border border-[#E8D5B5] hover:border-[#9B4A32] px-5 py-2.5 text-xs font-bold transition-colors shadow-2xs active:scale-95 cursor-pointer"
            >
              <Printer size={15} className="text-[#9B4A32]" />
              <span>Print Counter Standee</span>
            </button>
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

      {/* Fullscreen / Enlarge QR Code Modal (Rendered via React Portal directly into body to escape page-enter container) */}
      {qrModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) setQrModalOpen(false)
          }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div className="relative w-full max-w-sm rounded-3xl bg-[#FFF8EC] border-2 border-[#E8D5B5] p-7 shadow-2xl text-center z-10 my-auto">
            <button
              type="button"
              onClick={() => setQrModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-[#542B24]/60 hover:text-[#542B24] hover:bg-[#E8D5B5]/50 transition-colors cursor-pointer"
              aria-label="Close QR Modal"
            >
              <X size={20} />
            </button>

            <div className="inline-block rounded-full bg-[#9B4A32] text-white px-3.5 py-1 text-xs font-bold uppercase tracking-wider mb-2">
              MithaiMart Menu QR
            </div>
            <h3 className="font-serif text-xl font-bold text-[#542B24]">
              Scan to View All Sweets
            </h3>
            <p className="text-xs text-[#542B24]/70 mt-1 mb-5">
              Open your phone camera to explore our full sweet selection
            </p>

            <div className="inline-block p-4 rounded-2xl bg-white border-2 border-[#E8D5B5] shadow-md">
              <img
                src={qrImageUrl}
                alt="Full Size QR Code"
                className="h-56 w-56 mx-auto object-contain"
                onError={(e) => {
                  if (qrDataUrl && e.currentTarget.src !== qrDataUrl) {
                    e.currentTarget.src = qrDataUrl
                  }
                }}
              />
            </div>

            <div className="mt-3">
              <a
                href={CATALOG_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9B4A32] hover:text-[#542B24] hover:underline"
              >
                <span>Direct Link: Open Google Drive Catalog</span>
                <ExternalLink size={13} />
              </a>
            </div>

            <div className="mt-6 flex gap-2 justify-center">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="flex items-center gap-1.5 rounded-xl bg-[#9B4A32] hover:bg-[#542B24] text-white px-4 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                type="button"
                onClick={handlePrintStandee}
                className="flex items-center gap-1.5 rounded-xl bg-white border border-[#E8D5B5] hover:border-[#9B4A32] text-[#542B24] px-4 py-2 text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Printer size={14} className="text-[#9B4A32]" /> Print Standee
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
