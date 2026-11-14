import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ProductCard from '../components/ProductCard'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

export default function Products() {
  // The search text and chosen category live in the URL (?search=...&category_id=...)
  // so the page can be refreshed or shared and still show the same result.
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') || ''
  const categoryId = searchParams.get('category_id') || ''

  const [searchInput, setSearchInput] = useState(search)
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  // Load categories once, for the filter dropdown
  useEffect(() => {
    api
      .get('/categories/')
      .then((response) => setCategories(response.data))
      .catch(() => setCategories([])) // the products error message below covers a down server
  }, [])

  // Load products again every time the search or category changes
  useEffect(() => {
    let ignore = false // ignore old answers if the user changed the filter meanwhile
    const params = {}
    if (search) params.search = search
    if (categoryId) params.category_id = categoryId

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
          setError(getErrorMessage(err))
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [search, categoryId])

  // Change one URL value and keep the other one
  function updateFilter(name, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(name, value)
    else next.delete(name)
    setSearchParams(next)
  }

  function handleSearch(event) {
    event.preventDefault()
    updateFilter('search', searchInput.trim())
  }

  const hasFilters = search !== '' || categoryId !== ''

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold">All Sweets</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <form onSubmit={handleSearch} className="flex flex-1">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by product name"
            aria-label="Search by product name"
            className="w-full rounded-l-lg border border-r-0 border-brand-gold/60 px-4 py-2 outline-none focus:border-brand-red"
          />
          <button
            type="submit"
            className="rounded-r-lg bg-brand-red px-5 text-white transition-colors hover:bg-brand-saffron"
          >
            Search
          </button>
        </form>

        <select
          value={categoryId}
          onChange={(event) => updateFilter('category_id', event.target.value)}
          aria-label="Filter by category"
          className="rounded-lg border border-brand-gold/60 bg-white px-4 py-2 outline-none focus:border-brand-red"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="rounded-lg border border-brand-charcoal/30 px-4 py-2 text-sm hover:border-brand-red hover:text-brand-red"
          >
            Clear
          </button>
        )}
      </div>

      <div className="mt-8">
        {loading && <p className="py-12 text-center text-brand-charcoal/70">Loading sweets...</p>}

        {!loading && error && (
          <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">
            {error}
          </p>
        )}

        {!loading && !error && products.length === 0 && (
          <p className="rounded-lg border border-dashed border-brand-gold/60 p-10 text-center text-brand-charcoal/70">
            {hasFilters ? 'No sweets match your search.' : 'No sweets have been added yet.'}
          </p>
        )}

        {!loading && !error && products.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
