import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Candy } from 'lucide-react'
import ProductCard from '../components/ProductCard'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

export default function Home() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // useEffect with [] runs once, when the page first opens. It asks the backend for real data.
  useEffect(() => {
    Promise.all([api.get('/products/'), api.get('/categories/')])
      .then(([productsResponse, categoriesResponse]) => {
        setProducts(productsResponse.data)
        setCategories(categoriesResponse.data)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // The backend has no "featured" flag yet, so we show the newest products
  const featuredProducts = products.slice(0, 4)

  return (
    <div>
      {/* Hero banner */}
      <section className="bg-brand-cream">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-saffron">
              Traditional mithai
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-brand-charcoal sm:text-5xl">
              Sweets for every <span className="text-brand-red">celebration</span>
            </h1>
            <p className="mt-4 max-w-md text-brand-charcoal/80">
              Browse classic Indian sweets and snacks, pick the weight you need, and bring the festive
              table home.
            </p>
            <Link
              to="/products"
              className="mt-8 inline-block rounded-full bg-brand-red px-8 py-3 font-medium text-white transition-colors hover:bg-brand-saffron"
            >
              Shop Now
            </Link>
          </div>
          <div className="hidden justify-center md:flex">
            <div className="flex h-64 w-64 items-center justify-center rounded-full border-4 border-brand-gold/60 bg-white text-brand-gold">
              <Candy size={96} strokeWidth={1.25} />
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {loading && <p className="py-12 text-center text-brand-charcoal/70">Loading...</p>}
        {error && (
          <p className="my-12 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            {/* Featured sweets */}
            <section className="pt-12">
              <h2 className="text-3xl font-semibold">Featured Sweets</h2>
              <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
              {featuredProducts.length === 0 ? (
                <p className="mt-6 rounded-lg border border-dashed border-brand-gold/60 p-8 text-center text-brand-charcoal/70">
                  No sweets have been added yet. Please check back soon.
                </p>
              ) : (
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {featuredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              )}
            </section>

            {/* Categories */}
            <section className="pt-12">
              <h2 className="text-3xl font-semibold">Shop by Category</h2>
              <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
              {categories.length === 0 ? (
                <p className="mt-6 rounded-lg border border-dashed border-brand-gold/60 p-8 text-center text-brand-charcoal/70">
                  No categories have been added yet.
                </p>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {categories.map((category) => (
                    <Link
                      key={category.id}
                      to={`/products?category_id=${category.id}`}
                      className="rounded-xl border border-brand-gold/40 bg-brand-cream p-5 transition-colors hover:border-brand-red"
                    >
                      <h3 className="font-display text-xl font-semibold text-brand-red">{category.name}</h3>
                      {category.description && (
                        <p className="mt-1 text-sm text-brand-charcoal/70">{category.description}</p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
