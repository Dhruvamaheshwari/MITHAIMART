import { useEffect, useRef, useState } from 'react'
import ProductCard from './ProductCard'

const PAGE_SIZE = 24

export default function ProductGrid({ products, categoryNames }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const endOfListRef = useRef(null)

  useEffect(() => {
    const marker = endOfListRef.current
    if (!marker || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((count) => count + PAGE_SIZE)
      },
      { rootMargin: '600px' }
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [visibleCount, products.length])

  const shownProducts = products.slice(0, visibleCount)
  const hasMore = visibleCount < products.length

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-semibold text-[#542B24]/70">
          Showing <span className="text-[#9B4A32] font-bold">{shownProducts.length}</span> of {products.length} products
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-4">
        {shownProducts.map((product) => (
          <ProductCard key={product.id} product={product} categoryName={categoryNames[product.category_id]} />
        ))}
      </div>

      {hasMore ? (
        <div ref={endOfListRef} className="py-10 text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="rounded-full border border-[#9B4A32] bg-white px-7 py-2 text-xs font-bold text-[#9B4A32] shadow-2xs transition hover:bg-[#9B4A32] hover:text-white"
          >
            Load More Delicacies
          </button>
        </div>
      ) : (
        <p className="py-10 text-center text-xs font-medium text-[#542B24]/50">
          You have reached the end of our fresh confectionery collection.
        </p>
      )}
    </>
  )
}
