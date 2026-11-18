import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import adminApi, { clearAdminToken, getAdminToken } from '../services/adminApi'
import { getErrorMessage } from '../utils/helpers'

// Wraps every /admin page. Without a token the visitor is sent to the login page.
// With a token we ask the backend (/admin/me/) whether it is still valid and belongs to an admin.
// This check is only for the screen. The real protection is on every admin API in the backend.
export default function AdminLayout() {
  const navigate = useNavigate()
  const token = getAdminToken()
  const [username, setUsername] = useState('')
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    adminApi
      .get('/admin/me/')
      .then((response) => setUsername(response.data.username))
      .catch((err) => {
        // 401/403 are handled by adminApi (it sends the visitor to the login page)
        if (!err.response) setError(getErrorMessage(err))
      })
      .finally(() => setChecking(false))
  }, [token])

  if (!token) return <Navigate to="/admin/login" replace />

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login')
  }

  const linkClass = ({ isActive }) =>
    `rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
      isActive ? 'bg-brand-red text-white' : 'text-brand-charcoal hover:bg-brand-cream'
    }`

  if (checking) {
    return <p className="py-20 text-center text-brand-charcoal/70">Checking admin access...</p>
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream/40 md:flex-row">
      <aside className="border-b border-brand-gold/40 bg-white md:w-60 md:shrink-0 md:border-b-0 md:border-r">
        <div className="px-4 py-4">
          <p className="font-display text-xl font-bold text-brand-red">
            Mithai<span className="text-brand-saffron">Mart</span>
          </p>
          <p className="text-xs text-brand-charcoal/60">Admin{username && ` - ${username}`}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
          <NavLink to="/admin" end className={linkClass}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/products" className={linkClass}>
            Products
          </NavLink>
          <NavLink to="/admin/categories" className={linkClass}>
            Categories
          </NavLink>
          <NavLink to="/admin/orders" className={linkClass}>
            Orders
          </NavLink>
          <NavLink to="/admin/wholesale" className={linkClass}>
            Wholesale Orders
          </NavLink>
        </nav>
        <div className="flex gap-4 px-4 pb-4 text-sm md:flex-col md:gap-2">
          <Link to="/" className="underline hover:text-brand-red">
            &larr; Back to store
          </Link>
          <button type="button" onClick={handleLogout} className="text-left underline hover:text-brand-red">
            Log out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 md:p-8">
        {error ? (
          <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{error}</p>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
