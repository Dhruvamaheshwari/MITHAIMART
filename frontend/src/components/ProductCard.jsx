import { useContext, useState } from 'react'
import { Link } from 'react-router-dom'
import { Candy, Check, ShoppingBag, Sparkles } from 'lucide-react'
import { CartContext } from '../context/CartContext'
import { formatPrice, isVariantAvailable } from '../utils/helpers'

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

export default function ProductCard({ product, categoryName }) {
  const { addToCart } = useContext(CartContext)
  const [imageFailed, setImageFailed] = useState(false)
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)
  const [note, setNote] = useState(null)

  const variants = product.variants || []
  const availableVariants = variants.filter(isVariantAvailable)
  const defaultVariant = availableVariants[0] || variants[0] || null

  const [selectedWeight, setSelectedWeight] = useState(defaultVariant ? defaultVariant.weight : '')

  const currentVariant = variants.find((v) => v.weight === selectedWeight) || defaultVariant
  const isCurrentAvailable = currentVariant && isVariantAvailable(currentVariant)
  const currentPrice = currentVariant ? currentVariant.price : null

  const productPath = `/products/${product.id}`
  const subtitle = [product.state, categoryName].filter(Boolean).join(' • ')

  async function handleQuickAdd(e) {
    e.preventDefault()
    e.stopPropagation()
    if (adding || !currentVariant || !isCurrentAvailable) return
    setAdding(true)
    setNote(null)
    const result = await addToCart(product.id, currentVariant.weight, 1)
    if (result.ok) {
      setJustAdded(true)
      setNote({ ok: true, text: 'Added to cart!' })
      setTimeout(() => setJustAdded(false), 2000)
      setTimeout(() => setNote(null), 3500)
    } else {
      setNote({ ok: false, text: result.message || 'Could not add item' })
    }
    setAdding(false)
  }

  function handleSelectWeight(e, weight) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedWeight(weight)
    setNote(null)
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-[#E8D5B5] bg-white text-left transition-all duration-200 ease-out hover:-translate-y-1 hover:border-[#C99A42] hover:shadow-md">
      {/* Product Image */}
      <Link to={productPath} className="relative block aspect-[4/3] sm:aspect-square overflow-hidden bg-gradient-to-b from-[#FFF8EC] to-[#E8D5B5]/25">
        {product.image_url && !imageFailed ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[#9B4A32]/40">
            <Candy size={40} className="animate-float" />
          </div>
        )}

        {/* Origin / Special Badge */}
        {product.state && (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-[#FFF8EC]/95 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-semibold text-[#542B24] shadow-2xs border border-[#E8D5B5] flex items-center gap-1">
            <Sparkles size={10} className="text-[#C99A42]" />
            {product.state}
          </span>
        )}

        {/* In-Stock Indicator */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-[#FFF8EC]/90 backdrop-blur-xs px-2 py-0.5 shadow-2xs border border-[#E8D5B5]/50">
          <span className={`h-1.5 w-1.5 rounded-full ${isCurrentAvailable ? 'bg-emerald-600' : 'bg-gray-300'}`} />
          <span className="text-[10px] font-medium text-[#542B24]/70">
            {isCurrentAvailable ? 'Fresh' : 'Sold out'}
          </span>
        </div>
      </Link>

      {/* Card Body */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        {/* Title */}
        <h3 className="font-sans text-sm sm:text-base font-bold text-[#542B24] leading-snug line-clamp-1 group-hover:text-[#9B4A32] transition-colors">
          <Link to={productPath}>{product.name}</Link>
        </h3>

        {/* Subtitle */}
        {subtitle && (
          <p className="mt-0.5 text-xs text-[#542B24]/60 truncate font-medium">
            {subtitle}
          </p>
        )}

        {/* Price Display */}
        <div className="mt-2 flex items-baseline gap-2">
          {currentPrice !== null ? (
            <span className="text-base sm:text-lg font-bold text-[#9B4A32]">
              {formatPrice(currentPrice)}
            </span>
          ) : (
            <span className="text-xs font-medium text-[#542B24]/40">Currently unavailable</span>
          )}
        </div>

        {/* Weight Selection Pills */}
        {variants.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {variants.map((v) => {
              const isSelected = v.weight === selectedWeight
              const available = isVariantAvailable(v)
              return (
                <button
                  key={v.weight}
                  type="button"
                  onClick={(e) => handleSelectWeight(e, v.weight)}
                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 ${
                    isSelected
                      ? 'bg-[#542B24] text-[#FFF8EC] shadow-xs ring-1 ring-[#C99A42]'
                      : available
                      ? 'bg-[#FFF8EC] text-[#542B24] border border-[#E8D5B5] hover:border-[#9B4A32]/50 hover:bg-[#E8D5B5]/60 hover:text-[#9B4A32]'
                      : 'bg-gray-100 text-gray-400 border border-gray-200 line-through cursor-not-allowed'
                  }`}
                  title={available ? `${v.weight} - ${formatPrice(v.price)}` : 'Out of stock'}
                >
                  {formatWeightLabel(v.weight)}
                </button>
              )
            })}
          </div>
        )}

        {/* Action Button: Add to Cart */}
        <div className="mt-auto pt-3">
          {isCurrentAvailable ? (
            <button
              type="button"
              onClick={handleQuickAdd}
              disabled={adding}
              className={`flex w-full items-center justify-center gap-1.5 rounded-full py-2 px-3.5 text-xs sm:text-sm font-semibold transition-all duration-200 active:scale-95 shadow-xs ${
                justAdded
                  ? 'bg-emerald-700 text-white'
                  : 'bg-[#FFF8EC] text-[#542B24] border border-[#E8D5B5] hover:bg-[#9B4A32] hover:text-white hover:border-[#9B4A32]'
              }`}
            >
              {justAdded ? (
                <>
                  <Check size={14} className="stroke-[2.5]" />
                  <span>Added!</span>
                </>
              ) : (
                <>
                  <ShoppingBag size={14} />
                  <span>{adding ? 'Adding...' : 'Add to Cart'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full rounded-full bg-gray-100 py-2 px-3.5 text-xs font-semibold text-gray-400 cursor-not-allowed border border-gray-200"
            >
              Out of Stock
            </button>
          )}

          {note && (
            <p
              className={`mt-1.5 text-center text-[11px] font-medium transition-opacity ${
                note.ok ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {note.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
