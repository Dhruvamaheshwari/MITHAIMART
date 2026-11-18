import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

// A password box with a small eye button to show or hide what is typed.
export default function PasswordInput({ id, value, onChange, autoComplete, invalid, className }) {
  const [shown, setShown] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        aria-invalid={invalid ? 'true' : 'false'}
        className={`${className} pr-11`}
      />
      <button
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-label={shown ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-brand-charcoal/50 transition-colors hover:text-brand-red"
      >
        {shown ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
