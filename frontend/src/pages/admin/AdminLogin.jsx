import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import adminApi, { getAdminToken, setAdminToken } from '../../services/adminApi'
import { getErrorMessage } from '../../utils/helpers'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Already logged in: go straight to the dashboard
  if (getAdminToken()) return <Navigate to="/admin" replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setLoading(true)
    try {
      const response = await adminApi.post('/admin/login/', { username: username.trim(), password })
      setAdminToken(response.data.access) // only the token is kept, never the password
      navigate('/admin')
    } catch (err) {
      const status = err.response && err.response.status
      if (status === 429) setError('Too many attempts. Please wait a minute and try again.')
      else setError((err.response && err.response.data && err.response.data.error) || getErrorMessage(err))
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-cream px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-brand-gold/40 bg-white p-6">
        <h1 className="font-display text-2xl font-bold text-brand-red">Admin login</h1>
        <p className="mt-1 text-sm text-brand-charcoal/70">Only shop staff can sign in here.</p>

        <label htmlFor="admin-username" className="mt-5 block text-sm font-medium">
          Username
        </label>
        <input
          id="admin-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoComplete="username"
          className="mt-1 w-full rounded-lg border border-brand-gold/60 px-3 py-2 outline-none focus:border-brand-red"
        />

        <label htmlFor="admin-password" className="mt-4 block text-sm font-medium">
          Password
        </label>
        <input
          id="admin-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          className="mt-1 w-full rounded-lg border border-brand-gold/60 px-3 py-2 outline-none focus:border-brand-red"
        />

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-brand-red/5 p-3 text-sm text-brand-red">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-full bg-brand-red px-6 py-2.5 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <Link to="/" className="mt-4 block text-center text-sm underline hover:text-brand-red">
          &larr; Back to store
        </Link>
      </form>
    </div>
  )
}
