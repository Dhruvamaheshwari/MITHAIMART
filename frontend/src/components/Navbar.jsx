import { useContext, useEffect, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, ShoppingBag } from 'lucide-react'
import { CartContext } from '../context/CartContext'

export default function Navbar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchText, setSearchText] = useState('')
  const { cartCount } = useContext(CartContext) // number shown next to the cart icon

  // Keep the box in sync with the ?search= value in the URL
  useEffect(() => {
    setSearchText(searchParams.get('search') || '')
  }, [searchParams])

  function handleSearch(event) {
    event.preventDefault() // stop the browser from reloading the page
    const text = searchText.trim()
    navigate(text ? `/products?search=${encodeURIComponent(text)}` : '/products')
  }

  const linkClass = ({ isActive }) =>
    `text-sm font-medium transition-colors hover:text-brand-red ${
      isActive ? 'text-brand-red' : 'text-brand-charcoal'
    }`

  return (
    <header className="sticky top-0 z-20 bg-white shadow-sm">
      {/* Announcement bar */}
      <div className="bg-brand-red px-4 py-2 text-center text-xs text-white sm:text-sm">
        Welcome to MithaiMart - traditional Indian sweets and snacks, made with care.
      </div>

      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3">
        <Link to="/" className="order-1 mr-auto font-display text-2xl font-bold text-brand-red md:order-none md:mr-0">
          Mithai<span className="text-brand-saffron">Mart</span>
        </Link>

        <div className="order-3 flex w-full items-center gap-6 md:order-none md:w-auto">
          <NavLink to="/" end className={linkClass}>
            Home
          </NavLink>
          <NavLink to="/products" className={linkClass}>
            All Sweets
          </NavLink>
          <NavLink to="/addresses" className={linkClass}>
            Addresses
          </NavLink>
        </div>

        {/* On phones: logo + cart on row 1, links on row 2, search on row 3 */}
        <form onSubmit={handleSearch} className="order-4 flex w-full md:order-none md:ml-auto md:w-72">
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search sweets..."
            aria-label="Search sweets"
            className="w-full rounded-l-full border border-r-0 border-brand-gold/60 bg-brand-cream px-4 py-2 text-sm outline-none focus:border-brand-red"
          />
          <button
            type="submit"
            aria-label="Search"
            className="rounded-r-full bg-brand-red px-4 text-white transition-colors hover:bg-brand-saffron"
          >
            <Search size={16} />
          </button>
        </form>

        <Link
          to="/cart"
          aria-label={`Cart, ${cartCount} items`}
          className="order-2 flex items-center gap-2 text-sm font-medium text-brand-charcoal transition-colors hover:text-brand-red md:order-none"
        >
          <ShoppingBag size={22} />
          Cart ({cartCount})
        </Link>
      </nav>
    </header>
  )
}
