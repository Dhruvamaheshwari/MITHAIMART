import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import adminApi from '../../services/adminApi'
import { getErrorMessage } from '../../utils/helpers'

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  // All numbers come from the backend (counted in MongoDB). Nothing is hardcoded here.
  useEffect(() => {
    adminApi
      .get('/admin/stats/')
      .then((response) => setStats(response.data))
      .catch((err) => setError(getErrorMessage(err)))
  }, [])

  const cards = stats && [
    { label: 'Total products', value: stats.total_products, to: '/admin/products' },
    { label: 'Total categories', value: stats.total_categories, to: '/admin/categories' },
    { label: 'Total orders', value: stats.total_orders, to: '/admin/orders' },
    { label: 'Pending orders', value: stats.pending_orders, to: '/admin/orders' },
    {
      label: 'Low-stock products',
      value: stats.low_stock_products,
      to: '/admin/products',
      note: `A weight with ${stats.low_stock_threshold} or less in stock`,
    },
  ]

  return (
    <section>
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <div className="mt-2 h-1 w-16 rounded bg-brand-gold" />

      {error && (
        <p className="mt-6 rounded-lg border border-brand-red/40 bg-brand-red/5 p-4 text-brand-red">{error}</p>
      )}
      {!stats && !error && <p className="mt-6 text-brand-charcoal/70">Loading...</p>}

      {cards && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.label}
              to={card.to}
              className="rounded-xl border border-brand-gold/40 bg-white p-5 transition-colors hover:border-brand-red"
            >
              <p className="text-sm text-brand-charcoal/70">{card.label}</p>
              <p className="mt-1 font-display text-4xl font-bold text-brand-red">{card.value}</p>
              {card.note && <p className="mt-1 text-xs text-brand-charcoal/60">{card.note}</p>}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
