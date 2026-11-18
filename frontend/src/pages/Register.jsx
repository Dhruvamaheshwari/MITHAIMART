import { useContext, useState } from 'react'
import { Check } from 'lucide-react'
import { Navigate, useLocation } from 'react-router-dom'
import PasswordInput from '../components/PasswordInput'
import { AuthContext } from '../context/AuthContext'

const inputClass =
  'mt-1 w-full rounded-xl border border-[#E8D5B5] bg-white px-3.5 py-2.5 text-xs sm:text-sm text-[#542B24] outline-none transition-shadow focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20'

const PASSWORD_RULES = [
  ['At least 8 characters', (value) => value.length >= 8],
  ['Not only numbers', (value) => value.length > 0 && !/^\d+$/.test(value)],
  ['A mix of letters and numbers', (value) => /[A-Za-z]/.test(value) && /\d/.test(value)],
]

const STRENGTH = [
  ['', 'bg-[#542B24]/10'],
  ['Weak', 'bg-[#9B4A32]'],
  ['Okay', 'bg-[#C99A42]'],
  ['Good', 'bg-[#C99A42]'],
  ['Strong', 'bg-emerald-700'],
]

export default function Register() {
  const { user, loading, register } = useContext(AuthContext)
  const location = useLocation()
  const redirectTo = (location.state && location.state.from) || '/'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (loading) return <p className="py-20 text-center text-xs text-[#542B24]/70">Loading...</p>
  if (user) return <Navigate to={redirectTo} replace />

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const found = {}
    if (!name.trim()) found.name = 'Enter your name.'
    if (!email.trim()) found.email = 'Enter your email.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) found.email = 'Enter a valid email address.'
    if (!password) found.password = 'Choose a password.'
    else if (password.length < 8) found.password = 'The password must have at least 8 characters.'
    if (password && confirmPassword !== password) found.confirmPassword = 'The two passwords do not match.'
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    const result = await register(name.trim(), email.trim(), password)
    if (!result.ok) {
      setErrors(result.details)
      setFormError(Object.keys(result.details).length > 0 ? '' : result.message)
      setSubmitting(false)
    }
  }

  const fieldClass = (field) => `${inputClass} ${errors[field] ? 'border-red-500' : ''}`
  const fieldError = (field) => errors[field] && <p className="mt-1 text-xs text-red-600">{errors[field]}</p>

  const passedRules = PASSWORD_RULES.filter(([, test]) => test(password)).length
  const strength = password ? Math.min(passedRules + (password.length >= 12 ? 1 : 0), 4) : 0

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor="register-name" className="mt-4 block text-xs font-bold text-[#542B24]">Name</label>
      <input id="register-name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Your name" aria-invalid={errors.name ? 'true' : 'false'} className={fieldClass('name')} />
      {fieldError('name')}

      <label htmlFor="register-email" className="mt-3.5 block text-xs font-bold text-[#542B24]">Email</label>
      <input id="register-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="you@example.com" aria-invalid={errors.email ? 'true' : 'false'} className={fieldClass('email')} />
      {fieldError('email')}

      <label htmlFor="register-password" className="mt-3.5 block text-xs font-bold text-[#542B24]">Password</label>
      <PasswordInput id="register-password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" invalid={Boolean(errors.password)} className={fieldClass('password')} />
      
      <div className="mt-2 flex items-center gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((step) => (
          <span key={step} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${strength >= step ? STRENGTH[strength][1] : 'bg-[#542B24]/10'}`} />
        ))}
        <span className="w-14 text-right text-[11px] text-[#542B24]/70 font-semibold">{STRENGTH[strength][0]}</span>
      </div>
      <ul className="mt-2 space-y-1 text-[11px]">
        {PASSWORD_RULES.map(([label, test]) => {
          const ok = test(password)
          return (
            <li key={label} className={`flex items-center gap-1.5 transition-colors ${ok ? 'text-emerald-700 font-semibold' : 'text-[#542B24]/60'}`}>
              <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${ok ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#E8D5B5]'}`}>
                {ok && <Check size={10} strokeWidth={3} />}
              </span>
              {label}
            </li>
          )
        })}
      </ul>
      {fieldError('password')}

      <label htmlFor="register-confirm" className="mt-3.5 block text-xs font-bold text-[#542B24]">Confirm password</label>
      <PasswordInput id="register-confirm" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" invalid={Boolean(errors.confirmPassword)} className={fieldClass('confirmPassword')} />
      {fieldError('confirmPassword')}

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
        {submitting ? 'Creating your account...' : 'Create account'}
      </button>
    </form>
  )
}
