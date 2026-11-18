import { useContext, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput'
import { AuthContext } from '../context/AuthContext'

const inputClass =
  'mt-1 w-full rounded-xl border border-[#E8D5B5] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#542B24] outline-none transition-shadow focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20'

export default function Login() {
  const { user, loading, login } = useContext(AuthContext)
  const location = useLocation()
  const redirectTo = (location.state && location.state.from) || '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="py-20 text-center text-xs text-[#542B24]/70">Loading...</p>
  if (user) return <Navigate to={redirectTo} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const found = {}
    if (!email.trim()) found.email = 'Enter your email.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) found.email = 'Enter a valid email address.'
    if (!password) found.password = 'Enter your password.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    const result = await login(email.trim(), password)
    if (!result.ok) {
      setFormError(result.message)
      setPassword('')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="login-email" className="mt-4 block text-xs font-bold text-[#542B24]">
        Email
      </label>
      <input
        id="login-email"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        autoComplete="email"
        placeholder="you@example.com"
        aria-invalid={errors.email ? 'true' : 'false'}
        className={`${inputClass} ${errors.email ? 'border-red-500' : ''}`}
      />
      {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}

      <label htmlFor="login-password" className="mt-3.5 block text-xs font-bold text-[#542B24]">
        Password
      </label>
      <PasswordInput
        id="login-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        autoComplete="current-password"
        invalid={Boolean(errors.password)}
        className={`${inputClass} ${errors.password ? 'border-red-500' : ''}`}
      />
      {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}

      {formError && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-6 w-full rounded-full bg-[#9B4A32] py-3 text-xs sm:text-sm font-bold text-white shadow-xs transition-all duration-200 hover:bg-[#542B24] active:scale-98 disabled:opacity-60"
      >
        {submitting ? 'Logging in...' : 'Log in'}
      </button>
    </form>
  )
}
