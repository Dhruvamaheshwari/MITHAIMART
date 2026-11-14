import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Candy } from 'lucide-react'
import { formatPrice, getStartingPrice } from '../utils/helpers'

// Shows one product. The "product" comes from the backend API as a prop.
export default function ProductCard({ product }) {
  // If the image link is empty or broken, show a simple placeholder instead
  const [imageFailed, setImageFailed] = useState(false)
  const startingPrice = getStartingPrice(product)

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-brand-gold/40 bg-white transition-shadow hover:shadow-md">
      <div className="aspect-square bg-brand-cream">
        {product.image_url && !imageFailed ? (
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-brand-gold">
            <Candy size={48} />
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-lg font-semibold">{product.name}</h3>
        <p className="mt-1 text-sm text-brand-charcoal/70">
          {startingPrice !== null ? (
            <>
              Starting from <span className="font-semibold text-brand-red">{formatPrice(startingPrice)}</span>
            </>
          ) : (
            'Currently unavailable'
          )}
        </p>
        <Link
          to={`/products/${product.id}`}
          className="mt-4 rounded-full bg-brand-red px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-brand-saffron"
        >
          View Details
        </Link>
      </div>
    </div>
  )
}
