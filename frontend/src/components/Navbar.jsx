import { useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  ChevronDown,
  LogOut,
  MapPin,
  Menu,
  Phone,
  Search,
  ShoppingBag,
  Store,
  User,
  X,
} from 'lucide-react'
import { AuthContext } from '../context/AuthContext'
import { CartContext } from '../context/CartContext'
import { LocationContext } from '../context/LocationContext'
import api from '../services/api'

// Subcategory definitions matching MithaiMart menu structure
const MENU_SECTIONS = [
  {
    name: 'Sweets',
    hasDropdown: true,
    items: ['Bengali Sweets', 'Fresh Sweets', 'Dry Fruits Sweets', 'Mysore Pak', 'Laddus', 'View All'],
  },
  {
    name: 'Namkeens',
    hasDropdown: true,
    items: ['Bikaneri Bhujia', 'Ratlami Sev', 'Banana Chips', 'Chivda', 'Bihari Nimki', 'View All'],
  },
  {
    name: 'Snacks',
    hasDropdown: true,
    items: ['Bhakarwadi', 'Khakhra', 'Fafda', 'Chakli', 'Murukku', 'Mathri', 'Makhana', 'View All'],
  },
  {
    name: 'Bakery & Boulangerie',
    hasDropdown: true,
    items: ['Butter Cookies', 'Butter Puff Khari', 'Croissants', 'Dry Fruit Plum Cake', 'View All'],
  },
  {
    name: 'Chocolates',
    hasDropdown: false,
  },
  {
    name: 'Gifting',
    hasDropdown: true,
    items: ['Royal Shahi Mithai Box', 'Festival Hamper', 'Dry Fruit Wooden Chest', 'Silver Leaf Platter', 'View All'],
  },
]

function getCategoryIdsForSection(sectionName, categories) {
  if (!sectionName || !categories || !categories.length) return ''
  const target = sectionName.toLowerCase()
  const matched = categories.filter((c) => {
    const cName = c.name.toLowerCase()
    if (target === 'sweets') return cName.includes('sweet')
    if (target === 'namkeens') return cName.includes('namkeen')
    if (target === 'snacks') return cName.includes('snack')
    if (target === 'bakery & boulangerie') return cName.includes('baker')
    if (target === 'chocolates') return cName.includes('choc')
    if (target === 'gifting') return cName.includes('gift')
    return cName.includes(target) || target.includes(cName)
  })
  return matched.map((c) => c.id).join(',')
}

export default function Navbar() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [searchText, setSearchText] = useState('')
  const [selectedSearchCat, setSelectedSearchCat] = useState('')
  const { cartCount } = useContext(CartContext)
  const { user, loading: authLoading, logout } = useContext(AuthContext)
  const { location, setIsLocationModalOpen } = useContext(LocationContext)

  const [categories, setCategories] = useState([])
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    setSearchText(searchParams.get('search') || '')
  }, [searchParams])

  useEffect(() => {
    api
      .get('/categories/')
      .then((res) => setCategories(res.data))
      .catch(() => setCategories([]))
  }, [])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setActiveDropdown(null)
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleLogout() {
    logout()
    setProfileDropdownOpen(false)
    navigate('/')
  }

  function handleSearch(event) {
    event.preventDefault()
    const text = searchText.trim()
    const params = new URLSearchParams()
    if (text) params.set('search', text)
    if (selectedSearchCat) params.set('category_id', selectedSearchCat)
    const queryString = params.toString()
    navigate(queryString ? `/products?${queryString}` : '/products')
  }

  function handleCategoryClick(catName, subItem) {
    setActiveDropdown(null)
    setMobileMenuOpen(false)

    if (subItem && subItem !== 'View All') {
      const exactCategory = categories.find(
        (c) => c.name.toLowerCase() === subItem.toLowerCase()
      )
      if (exactCategory) {
        navigate(`/products?category_id=${exactCategory.id}`)
      } else {
        navigate(`/products?search=${encodeURIComponent(subItem)}`)
      }
      return
    }

    const matchedIds = getCategoryIdsForSection(catName, categories)
    if (matchedIds) {
      navigate(`/products?category_id=${matchedIds}`)
    } else {
      navigate(`/products?search=${encodeURIComponent(catName)}`)
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-[#FFF8EC] shadow-xs" ref={dropdownRef}>
      {/* Top Announcement Bar (#FFF8EC bg, #E8D5B5 border, #542B24 text, #C99A42 gold ping) */}
      <div className="bg-[#FFF8EC] border-b border-[#E8D5B5] px-4 py-1.5 text-center text-xs font-semibold text-[#542B24] flex items-center justify-center gap-2">
        <span className="inline-block h-2 w-2 rounded-full bg-[#C99A42] animate-ping" />
        <span>
          Spreading sweetness among people... Since 1957 •{' '}
          <span className="text-[#9B4A32] font-bold">Authentic Desi Ghee Mithai & Savouries</span>
        </span>
      </div>

      {/* Row 1: Logo, Delivery Location, Search, Actions */}
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        {/* Left: Mobile hamburger + Brand Logo */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 text-[#542B24] hover:text-[#9B4A32] rounded-lg hover:bg-[#E8D5B5]/30 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-tr from-[#9B4A32] via-[#B3583C] to-[#C99A42] text-white shadow-md transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
              <span className="font-serif text-2xl font-bold italic">M</span>
            </div>
            <div>
              <span className="block font-serif text-2xl sm:text-3xl font-extrabold tracking-tight text-[#542B24] leading-none">
                Mithai<span className="text-[#9B4A32]">Mart</span>
              </span>
              <span className="block text-[11px] tracking-wider text-[#542B24]/70 font-sans mt-0.5 font-medium">
                Spreading sweetness among people... Since 1957
              </span>
            </div>
          </Link>
        </div>

        {/* Location Pill: Delivering through Courier with live user location */}
        <button
          type="button"
          onClick={() => setIsLocationModalOpen(true)}
          className="hidden lg:flex items-center gap-2.5 rounded-full bg-[#FFF8EC] px-3.5 py-1.5 text-xs font-bold text-[#542B24] border border-[#E8D5B5] shadow-2xs hover:border-[#9B4A32] hover:bg-[#E8D5B5]/30 transition-all text-left cursor-pointer group shrink-0"
          title="Click to fetch or change delivery location"
        >
          <div className="relative flex items-center justify-center">
            <MapPin size={16} className="text-[#9B4A32] group-hover:scale-110 transition-transform" />
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse" />
          </div>
          <div className="leading-tight">
            <span className="block text-[10px] text-[#542B24]/70 font-medium leading-none">
              Delivering through Courier
            </span>
            <span className="block text-xs font-bold text-[#9B4A32] truncate max-w-[140px] mt-0.5">
              {location?.city ? `${location.city}${location.pincode ? ` (${location.pincode})` : ''}` : 'Detect Location'}
            </span>
          </div>
          <ChevronDown size={13} className="text-[#542B24]/50 group-hover:text-[#9B4A32] transition-colors ml-0.5" />
        </button>

        {/* Center: Search Bar with category picker */}
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-md lg:max-w-lg items-center rounded-full border border-[#E8D5B5] bg-white px-3.5 py-1.5 shadow-2xs focus-within:border-[#9B4A32] focus-within:ring-2 focus-within:ring-[#C99A42]/20 transition-all"
        >
          <Search size={17} className="text-[#542B24]/50 mr-2 shrink-0" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search for sweets, chocolates, snacks, hampers..."
            className="w-full bg-transparent text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none font-medium"
          />
          {categories.length > 0 && (
            <select
              value={selectedSearchCat}
              onChange={(e) => setSelectedSearchCat(e.target.value)}
              className="hidden lg:block text-xs font-semibold text-[#542B24]/70 bg-transparent border-l border-[#E8D5B5] pl-2.5 pr-1 py-0.5 outline-none cursor-pointer"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            aria-label="Search"
            className="ml-2 rounded-full bg-[#9B4A32] p-1.5 text-white hover:bg-[#542B24] transition-transform active:scale-95 shadow-2xs"
          >
            <ChevronDown size={14} className="-rotate-90" />
          </button>
        </form>

        {/* Right: Utility Nav Items */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            to="/products"
            className="hidden sm:flex flex-col items-center text-[#542B24] hover:text-[#9B4A32] transition-colors group"
          >
            <Store size={19} className="transition-transform group-hover:scale-110" />
            <span className="text-[11px] font-bold mt-0.5">Stores</span>
          </Link>

          <Link
            to="/products"
            className="hidden sm:flex flex-col items-center text-[#542B24] hover:text-[#9B4A32] transition-colors group"
          >
            <Phone size={19} className="transition-transform group-hover:scale-110" />
            <span className="text-[11px] font-bold mt-0.5">Contact</span>
          </Link>

          <Link
            to="/products"
            className="hidden sm:flex flex-col items-center text-[#542B24] hover:text-[#9B4A32] transition-colors group"
          >
            <BookOpen size={19} className="transition-transform group-hover:scale-110" />
            <span className="text-[11px] font-bold mt-0.5">Catalog</span>
          </Link>

          {/* Profile Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex flex-col items-center text-[#542B24] hover:text-[#9B4A32] transition-colors group"
            >
              <User size={19} className="transition-transform group-hover:scale-110" />
              <span className="text-[11px] font-bold mt-0.5">
                {user ? user.name.split(' ')[0] : 'Profile'}
              </span>
            </button>

            {profileDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-[#E8D5B5] bg-[#FFF8EC] py-2 shadow-xl z-50 animate-pop-in">
                {!authLoading && user ? (
                  <>
                    <div className="px-4 py-2 border-b border-[#E8D5B5]">
                      <p className="text-[10px] text-[#542B24]/60 font-semibold">Signed in as</p>
                      <p className="text-xs font-bold text-[#542B24] truncate">{user.name}</p>
                      <p className="text-[11px] text-[#542B24]/70 truncate">{user.email}</p>
                    </div>
                    <Link
                      to="/my-orders"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#542B24] hover:bg-[#E8D5B5]/60 hover:text-[#9B4A32]"
                    >
                      My Orders
                    </Link>
                    <Link
                      to="/addresses"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#542B24] hover:bg-[#E8D5B5]/60 hover:text-[#9B4A32]"
                    >
                      Saved Addresses
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-[#9B4A32] hover:bg-red-50"
                    >
                      <LogOut size={14} /> Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/login"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-xs font-semibold text-[#542B24] hover:bg-[#E8D5B5]/60 hover:text-[#9B4A32]"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/register"
                      onClick={() => setProfileDropdownOpen(false)}
                      className="block px-4 py-2 text-xs text-[#9B4A32] font-bold hover:bg-[#E8D5B5]/60"
                    >
                      Create Account
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cart Icon */}
          <Link
            to="/cart"
            aria-label={`Shopping cart with ${cartCount} items`}
            className="relative flex flex-col items-center text-[#542B24] hover:text-[#9B4A32] transition-colors group"
          >
            <div className="relative">
              <ShoppingBag size={21} className="transition-transform group-hover:scale-110" />
              {cartCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#9B4A32] text-[10px] font-black text-white shadow-2xs">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold mt-0.5">Cart</span>
          </Link>
        </div>
      </div>

      {/* Mobile Search Bar */}
      <div className="px-4 pb-2.5 md:hidden">
        <form
          onSubmit={handleSearch}
          className="flex items-center rounded-full border border-[#E8D5B5] bg-white px-3.5 py-1.5 shadow-2xs"
        >
          <Search size={16} className="text-[#542B24]/40 mr-2 shrink-0" />
          <input
            type="search"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search for sweets, snacks, hampers..."
            className="w-full bg-transparent text-xs text-[#542B24] placeholder-[#542B24]/40 outline-none font-medium"
          />
          <button
            type="submit"
            className="rounded-full bg-[#9B4A32] px-3.5 py-1 text-xs font-bold text-white hover:bg-[#542B24]"
          >
            Go
          </button>
        </form>
      </div>

      {/* Row 2: Signature Deep Mahogany (#542B24) Menu Bar with Warm Cream & Gold (#C99A42) */}
      <nav className="relative bg-[#542B24] text-[#FFF8EC] hidden lg:block shadow-xs border-t border-[#C99A42]/30">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 xl:gap-10 px-4 py-2 text-xs sm:text-sm font-semibold tracking-normal">
          {MENU_SECTIONS.map((section) => (
            <div
              key={section.name}
              className="relative group"
              onMouseEnter={() => section.hasDropdown && setActiveDropdown(section.name)}
              onMouseLeave={() => setActiveDropdown(null)}
            >
              <button
                type="button"
                onClick={() => handleCategoryClick(section.name)}
                className="flex items-center gap-1.5 py-1 px-3 rounded-md transition-all duration-150 hover:text-[#C99A42] hover:bg-white/10 active:scale-95 focus:outline-none"
              >
                <span>{section.name}</span>
                {section.hasDropdown && (
                  <ChevronDown
                    size={13}
                    className="opacity-75 transition-transform duration-200 group-hover:rotate-180 group-hover:text-[#C99A42]"
                  />
                )}
              </button>

              {/* Popover Dropdown (#FFF8EC bg, #E8D5B5 border, #542B24 text) */}
              {section.hasDropdown && activeDropdown === section.name && (
                <div className="absolute left-0 top-full pt-1.5 z-50 min-w-[200px]">
                  <div className="rounded-xl border border-[#E8D5B5] bg-[#FFF8EC] py-2 shadow-xl text-[#542B24] animate-fade-in">
                    {section.items.map((subItem) => (
                      <button
                        key={subItem}
                        type="button"
                        onClick={() => handleCategoryClick(section.name, subItem)}
                        className="block w-full text-left px-4 py-2 text-xs font-medium hover:bg-[#E8D5B5]/60 hover:text-[#9B4A32] transition-colors"
                      >
                        {subItem}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#E8D5B5] bg-[#FFF8EC] px-5 py-4 shadow-xl animate-fade-in">
          {/* Mobile Location Pill */}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false)
              setIsLocationModalOpen(true)
            }}
            className="w-full flex items-center justify-between gap-2.5 mb-3.5 px-3.5 py-2.5 rounded-xl bg-[#FFF8EC] border border-[#E8D5B5] text-[#542B24] text-xs font-bold shadow-2xs hover:border-[#9B4A32] transition text-left cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <MapPin size={16} className="text-[#9B4A32]" />
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div>
                <span className="block text-[10px] text-[#542B24]/70 font-medium leading-none">
                  Delivering through Courier
                </span>
                <span className="block text-xs font-bold text-[#9B4A32] mt-0.5">
                  {location?.city ? `${location.city} ${location.pincode ? `(${location.pincode})` : ''}` : 'Detect Location'}
                </span>
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#9B4A32] bg-[#9B4A32]/10 px-2.5 py-1 rounded-full">
              Change
            </span>
          </button>

          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#542B24]/60 px-2 mb-2">
            Explore Categories
          </p>
          <div className="space-y-1">
            {MENU_SECTIONS.map((section) => (
              <div key={section.name}>
                <button
                  type="button"
                  onClick={() => handleCategoryClick(section.name)}
                  className="w-full text-left rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold text-[#542B24] hover:bg-[#E8D5B5]/50 hover:text-[#9B4A32] transition"
                >
                  {section.name}
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-[#E8D5B5] space-y-2">
            <Link
              to="/my-orders"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3.5 py-2 text-xs font-semibold text-[#542B24] hover:bg-[#E8D5B5]/40"
            >
              My Orders
            </Link>
            <Link
              to="/addresses"
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-lg px-3.5 py-2 text-xs font-semibold text-[#542B24] hover:bg-[#E8D5B5]/40"
            >
              Saved Addresses
            </Link>
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold text-[#9B4A32] hover:bg-red-50"
              >
                <LogOut size={14} /> Log out
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block rounded-lg px-3.5 py-2 text-xs font-bold text-[#9B4A32] hover:bg-[#E8D5B5]/40"
              >
                Log In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
