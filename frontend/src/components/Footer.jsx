import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="mt-16 bg-brand-charcoal text-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div>
          <p className="font-display text-2xl font-bold">
            Mithai<span className="text-brand-gold">Mart</span>
          </p>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            Traditional Indian sweets and snacks for every celebration.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold">Explore</p>
          <ul className="mt-2 space-y-1 text-sm text-white/80">
            <li>
              <Link to="/" className="hover:text-brand-gold">
                Home
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-brand-gold">
                All Sweets
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        &copy; {new Date().getFullYear()} MithaiMart. All rights reserved.
      </p>
    </footer>
  )
}
