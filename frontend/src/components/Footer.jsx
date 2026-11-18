import { Link } from 'react-router-dom'
import { Mail, MapPin, Phone } from 'lucide-react'

function InstagramIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  )
}

function FacebookIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

function YoutubeIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </svg>
  )
}

export default function Footer() {
  return (
    <footer className="border-t border-[#E8D5B5] text-[#E8D5B5]">
      {/* We Are Also Available On Section */}
      <div className="border-b border-[#E8D5B5] bg-[#FFF8EC] py-7">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[#542B24]">
            We Are Also Available On
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-7 sm:gap-14">
            {/* Swiggy */}
            <div className="flex items-center gap-2 font-black tracking-tight text-[#FC8019] text-lg sm:text-xl">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FC8019] text-white text-[11px] font-bold">
                S
              </span>
              <span>SWIGGY</span>
            </div>

            {/* Zomato */}
            <div className="flex items-center gap-1.5 font-black italic tracking-tighter text-[#E23744] text-xl sm:text-2xl">
              <span>zomato</span>
            </div>

            {/* ONDC / Bownly */}
            <div className="flex items-center gap-2 font-bold tracking-tight text-[#542B24] text-lg sm:text-xl">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#C99A42] text-white text-[11px]">
                🛍️
              </span>
              <span>bownly <span className="text-[11px] text-[#542B24]/60 font-normal">ONDC</span></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 4-Column Footer (#542B24 Deep Mahogany with #C99A42 Gold Headers) */}
      <div className="bg-[#542B24] py-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:gap-12">
            {/* Column 1: Shop Now */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A42] mb-4">
                Shop Now
              </h3>
              <ul className="space-y-2 text-xs font-medium text-[#E8D5B5]/90">
                <li>
                  <Link to="/products?search=Sweets" className="hover:text-[#C99A42] transition-colors">
                    Sweets
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Namkeen" className="hover:text-[#C99A42] transition-colors">
                    Namkeens
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Snacks" className="hover:text-[#C99A42] transition-colors">
                    Snacks
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Bakery" className="hover:text-[#C99A42] transition-colors">
                    Bakery & Boulangerie
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Chocolates" className="hover:text-[#C99A42] transition-colors">
                    Chocolates
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Gifting" className="hover:text-[#C99A42] transition-colors">
                    Gifting Hampers
                  </Link>
                </li>
                <li>
                  <Link to="/products?search=Dry%20Fruits" className="hover:text-[#C99A42] transition-colors">
                    Dry Fruit Sweets
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 2: Quick Links */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A42] mb-4">
                Quick Links
              </h3>
              <ul className="space-y-2 text-xs font-medium text-[#E8D5B5]/90">
                <li>
                  <Link to="/products" className="hover:text-[#C99A42] transition-colors">
                    Our Stores
                  </Link>
                </li>
                <li>
                  <Link to="/my-orders" className="hover:text-[#C99A42] transition-colors">
                    Track Your Order
                  </Link>
                </li>
                <li>
                  <Link to="/credits" className="hover:text-[#C99A42] transition-colors">
                    Photo Credits
                  </Link>
                </li>
                <li>
                  <a href="#about" className="hover:text-[#C99A42] transition-colors">
                    Our Heritage (Since 1957)
                  </a>
                </li>
                <li>
                  <a href="#feedback" className="hover:text-[#C99A42] transition-colors">
                    Customer Feedback
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A42] mb-4">
                Legal
              </h3>
              <ul className="space-y-2 text-xs font-medium text-[#E8D5B5]/90">
                <li>
                  <a href="#terms" className="hover:text-[#C99A42] transition-colors">
                    Terms & Conditions
                  </a>
                </li>
                <li>
                  <a href="#returns" className="hover:text-[#C99A42] transition-colors">
                    Returns & Exchange Policy
                  </a>
                </li>
                <li>
                  <a href="#privacy" className="hover:text-[#C99A42] transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#shipping" className="hover:text-[#C99A42] transition-colors">
                    Shipping & Delivery FAQs
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Customer Care & Social */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#C99A42] mb-4">
                Customer Care
              </h3>
              <div className="space-y-2 text-xs text-[#E8D5B5]/90">
                <p className="flex items-center gap-2">
                  <Mail size={13} className="text-[#C99A42]" />
                  <a href="mailto:contact@mithaimart.com" className="hover:text-[#C99A42]">
                    contact@mithaimart.com
                  </a>
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={13} className="text-[#C99A42]" />
                  <span>080 22960638 / 639</span>
                </p>
                <p className="text-[11px] text-[#E8D5B5]/60 mt-1">
                  (Timings: 09:30 AM - 06:30 PM, Mon-Sat)
                </p>

                <div className="mt-5 pt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#C99A42] mb-2.5">
                    Follow Us On
                  </p>
                  <div className="flex items-center gap-2.5">
                    <a
                      href="https://instagram.com"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Instagram"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF8EC] text-[#542B24] hover:bg-[#C99A42] hover:text-[#542B24] transition-colors"
                    >
                      <InstagramIcon size={14} />
                    </a>
                    <a
                      href="https://facebook.com"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Facebook"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF8EC] text-[#542B24] hover:bg-[#C99A42] hover:text-[#542B24] transition-colors"
                    >
                      <FacebookIcon size={14} />
                    </a>
                    <a
                      href="https://youtube.com"
                      target="_blank"
                      rel="noreferrer"
                      aria-label="YouTube"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFF8EC] text-[#542B24] hover:bg-[#C99A42] hover:text-[#542B24] transition-colors"
                    >
                      <YoutubeIcon size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Strip */}
      <div className="border-t border-[#E8D5B5]/20 bg-[#3D1F1A] px-4 py-3 text-center text-xs text-[#E8D5B5]/80">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-[#E8D5B5]">
            <MapPin size={13} className="text-[#C99A42]" />
            <span>
              <strong>We Serve In:</strong> Bengaluru, Mysore, Delhi NCR, Mumbai, Hyderabad, Chennai, Kolkata, Pune & 500+ Cities
            </span>
          </div>
          <p className="text-[11px] text-[#E8D5B5]/60">
            &copy; {new Date().getFullYear()} MithaiMart. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
