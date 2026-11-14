import { useEffect, useState } from 'react'
import AddressForm from '../components/AddressForm'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

export default function Addresses() {
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [formMode, setFormMode] = useState(null) // null = hidden, 'add', or an address being edited
  const [message, setMessage] = useState('')

  // Ask the backend for this browser's addresses
  function loadAddresses() {
    return api
      .get('/addresses/')
      .then((response) => {
        setAddresses(response.data)
        setError('')
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAddresses()
  }, [])

  // The form saved something, so close it and load the fresh list
  function handleSaved() {
    setFormMode(null)
    setMessage('Address saved.')
    loadAddresses()
  }

  async function handleDelete(address) {
    if (!window.confirm(`Delete the address for ${address.full_name}?`)) return
    setMessage('')
    try {
      await api.delete(`/addresses/${address.id}/`)
      setMessage('Address deleted.')
      await loadAddresses()
    } catch (err) {
      setMessage((err.response && err.response.data && err.response.data.error) || getErrorMessage(err))
    }
  }

  // "Set as default" sends the same address again with is_default = true
  async function handleSetDefault(address) {
    setMessage('')
    try {
      await api.put(`/addresses/${address.id}/`, { ...address, is_default: true })
      setMessage('Default address updated.')
      await loadAddresses()
    } catch (err) {
      setMessage((err.response && err.response.data && err.response.data.error) || getErrorMessage(err))
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">My Addresses</h1>
          <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />
        </div>
        {formMode === null && (
          <button
            type="button"
            onClick={() => {
              setMessage('')
              setFormMode('add')
            }}
            className="rounded-full bg-brand-red px-6 py-2 font-medium text-white transition-colors hover:bg-brand-saffron"
          >
            Add new address
          </button>
        )}
      </div>

      {message && (
        <p role="status" className="mt-6 rounded-lg border border-brand-gold/60 bg-brand-cream p-3 text-sm">
          {message}
        </p>
      )}

      {formMode !== null && (
        <div className="mt-6">
          <AddressForm
            key={formMode === 'add' ? 'new' : formMode.id}
            address={formMode === 'add' ? null : formMode}
            onSaved={handleSaved}
            onCancel={() => setFormMode(null)}
          />
        </div>
      )}

      <div className="mt-8">
        {loading && <p className="py-10 text-center text-brand-charcoal/70">Loading addresses...</p>}
        {!loading && error && (
          <p className="rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-center text-brand-red">{error}</p>
        )}
        {!loading && !error && addresses.length === 0 && formMode === null && (
          <p className="rounded-lg border border-dashed border-brand-gold/60 p-10 text-center text-brand-charcoal/70">
            You have no saved addresses yet.
          </p>
        )}

        <ul className="grid gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="flex flex-col rounded-xl border border-brand-gold/40 bg-white p-5">
              <div className="flex items-start justify-between gap-2">
                <p className="font-display text-lg font-semibold">{address.full_name}</p>
                {address.is_default && (
                  <span className="rounded-full bg-brand-gold/20 px-3 py-1 text-xs font-semibold text-brand-charcoal">
                    Default
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-brand-charcoal/80">
                {address.house_number}, {address.street}, {address.area}
                <br />
                {address.city}, {address.state} - {address.pincode}
                {address.landmark && (
                  <>
                    <br />
                    Landmark: {address.landmark}
                  </>
                )}
              </p>
              <p className="mt-2 text-sm">Phone: {address.phone_number}</p>

              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <button type="button" onClick={() => { setMessage(''); setFormMode(address) }} className="underline hover:text-brand-red">
                  Edit
                </button>
                <button type="button" onClick={() => handleDelete(address)} className="underline hover:text-brand-red">
                  Delete
                </button>
                {!address.is_default && (
                  <button type="button" onClick={() => handleSetDefault(address)} className="underline hover:text-brand-red">
                    Set as default
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
