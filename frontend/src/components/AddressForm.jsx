import { useState } from 'react'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

const emptyValues = {
  full_name: '',
  phone_number: '',
  house_number: '',
  street: '',
  area: '',
  city: '',
  state: '',
  pincode: '',
  landmark: '',
  is_default: false,
}

const requiredFields = {
  full_name: 'Full name',
  phone_number: 'Phone number',
  house_number: 'House number',
  street: 'Street',
  area: 'Area',
  city: 'City',
  state: 'State',
  pincode: 'Pincode',
}

// Quick checks in the browser so the customer gets instant messages.
// The backend checks the same rules again, so these are only for convenience.
function checkValues(values) {
  const errors = {}
  for (const [field, label] of Object.entries(requiredFields)) {
    if (!values[field].trim()) errors[field] = `${label} is required.`
  }
  if (!errors.phone_number && !/^[6-9]\d{9}$/.test(values.phone_number.trim())) {
    errors.phone_number = 'Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9).'
  }
  if (!errors.pincode && !/^[1-9]\d{5}$/.test(values.pincode.trim())) {
    errors.pincode = 'Enter a valid 6-digit pincode.'
  }
  return errors
}

// One form for "add" and "edit". If "address" is given we edit it, otherwise we add a new one.
// onSaved(savedAddress) is called after the backend has saved it.
export default function AddressForm({ address, onSaved, onCancel }) {
  const [values, setValues] = useState(() => {
    if (!address) return emptyValues
    const copy = { ...emptyValues }
    for (const field of Object.keys(emptyValues)) copy[field] = address[field]
    return copy
  })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  function handleChange(event) {
    const { name, value, type, checked } = event.target
    setValues({ ...values, [name]: type === 'checkbox' ? checked : value })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const problems = checkValues(values)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return

    setSaving(true)
    try {
      const response = address
        ? await api.put(`/addresses/${address.id}/`, values)
        : await api.post('/addresses/', values)
      onSaved(response.data)
    } catch (err) {
      const data = err.response && err.response.data
      // Messages for single fields sent by the backend, e.g. { pincode: "Enter a valid 6-digit pincode." }
      if (data && data.details) setErrors(data.details)
      setFormError((data && data.error) || getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  // Small helper to draw one labelled input with its error message below it
  function field(name, label, props = {}) {
    return (
      <div className={props.wide ? 'sm:col-span-2' : ''}>
        <label htmlFor={`address-${name}`} className="block text-sm font-medium">
          {label}
          {name !== 'landmark' && <span className="text-brand-red"> *</span>}
        </label>
        <input
          id={`address-${name}`}
          name={name}
          value={values[name]}
          onChange={handleChange}
          inputMode={props.inputMode}
          maxLength={props.maxLength}
          autoComplete="off"
          aria-invalid={errors[name] ? 'true' : 'false'}
          className={`mt-1 w-full rounded-lg border px-3 py-2 outline-none focus:border-brand-red ${
            errors[name] ? 'border-brand-red' : 'border-brand-gold/60'
          }`}
        />
        {errors[name] && <p className="mt-1 text-sm text-brand-red">{errors[name]}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-xl border border-brand-gold/40 bg-brand-cream p-5">
      <h2 className="text-xl font-semibold">{address ? 'Edit address' : 'Add a new address'}</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field('full_name', 'Full name')}
        {field('phone_number', 'Phone number', { inputMode: 'numeric', maxLength: 10 })}
        {field('house_number', 'House / flat number')}
        {field('street', 'Street')}
        {field('area', 'Area')}
        {field('city', 'City')}
        {field('state', 'State')}
        {field('pincode', 'Pincode', { inputMode: 'numeric', maxLength: 6 })}
        {field('landmark', 'Landmark (optional)', { wide: true })}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" name="is_default" checked={values.is_default} onChange={handleChange} />
        Make this my default address
      </label>

      {formError && (
        <p role="alert" className="mt-4 rounded-lg border border-brand-red/40 bg-white p-3 text-sm text-brand-red">
          {formError}
        </p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save address'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-brand-charcoal/30 px-6 py-2 hover:border-brand-red hover:text-brand-red"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
