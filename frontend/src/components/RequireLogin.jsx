import { useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { AuthContext } from '../context/AuthContext'

// Wrap a page in this to make it available only to logged-in customers.
// A visitor who is not logged in is sent to the login page and, after logging in, comes back to this page.
// This only decides what the screen shows. The backend also refuses these actions for guests.
export default function RequireLogin({ children }) {
  const { user, loading } = useContext(AuthContext)
  const location = useLocation()

  if (loading) return <p className="py-20 text-center text-brand-charcoal/70">Loading...</p>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  return children
}
