import { useEffect, useState } from 'react'
import { getHealth } from '../services/healthService'

export default function HomePage() {
  const [health, setHealth] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message))
  }, [])

  return (
    <section className="bg-brand-cream">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-4xl font-semibold text-brand-red">MithaiMart</h1>
        <p className="mt-2 text-lg">Premium Indian sweets and snacks. Storefront coming soon.</p>

        <div className="mt-8 inline-block rounded-lg border border-brand-gold/50 bg-white px-5 py-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-saffron">API status</p>
          {!health && !error && <p className="mt-1">Checking...</p>}
          {error && <p className="mt-1 text-brand-red">Unreachable: {error}</p>}
          {health && (
            <p className="mt-1">
              {health.message} (<strong>{health.status}</strong>)
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
