import { Link, useLocation } from 'react-router-dom'
import { Gift, ShieldCheck, Truck } from 'lucide-react'

const FLOATING_SWEETS = [
  { src: '/images/sweets/kaju-katli.jpg', alt: 'Kaju katli', className: 'left-[6%] top-[8%] w-24', delay: '0s' },
  { src: '/images/sweets/jalebi.jpg', alt: 'Jalebi', className: 'left-[44%] top-[0%] w-20', delay: '1.2s' },
  { src: '/images/sweets/gulab-jamun.jpg', alt: 'Gulab jamun', className: 'right-[4%] top-[34%] w-28', delay: '0.6s' },
  { src: '/images/sweets/rasgulla.jpg', alt: 'Rasgulla', className: 'left-[20%] top-[56%] w-20', delay: '1.8s' },
]

const PERKS = [
  { icon: Gift, text: 'Your cart, addresses and orders saved in one place' },
  { icon: Truck, text: 'Track every order from Pending to Delivered' },
  { icon: ShieldCheck, text: 'Your password is stored safely, never as plain text' },
]

const TEXTS = {
  login: {
    panelTitle: 'Welcome back, mithai lover!',
    title: 'Log in',
    subtitle: 'Welcome back. Log in to keep your cart, addresses and orders with your account.',
  },
  register: {
    panelTitle: 'Join the mithai family',
    title: 'Create account',
    subtitle: 'Sign up to keep your orders and addresses with your account. Items in your cart now will be kept.',
  },
}

export default function AuthShell({ mode, children }) {
  const { panelTitle, title, subtitle } = TEXTS[mode]
  const location = useLocation()

  const tabClass = (active) =>
    `relative z-10 flex-1 rounded-full py-2 text-center text-xs sm:text-sm font-semibold transition-colors duration-300 ${
      active ? 'text-white' : 'text-[#542B24]/70 hover:text-[#9B4A32]'
    }`

  return (
    <section className="mx-auto my-6 grid max-w-5xl overflow-hidden rounded-2xl border border-[#E8D5B5] bg-white shadow-lg md:my-10 md:grid-cols-[1fr_1.05fr]">
      {/* Festive panel in Heritage Mahogany & Terracotta theme */}
      <aside className="relative hidden min-h-[560px] overflow-hidden bg-gradient-to-br from-[#542B24] via-[#753424] to-[#9B4A32] p-8 text-[#FFF8EC] md:flex md:flex-col">
        <div aria-hidden="true" className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:22px_22px]" />
        <div aria-hidden="true" className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#C99A42]/20 blur-3xl" />
        
        <div className="relative h-60 shrink-0">
          {FLOATING_SWEETS.map((sweet) => (
            <div key={sweet.src} className={`absolute ${sweet.className} animate-pop-in`} style={{ animationDelay: sweet.delay }}>
              <div className="animate-float" style={{ animationDelay: sweet.delay }}>
                <img src={sweet.src} alt={sweet.alt} className="aspect-square w-full rounded-full border-3 border-white/90 object-cover shadow-xl" />
              </div>
            </div>
          ))}
        </div>
        <div className="relative mt-auto animate-fade-up" style={{ animationDelay: '250ms' }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#C99A42]">MithaiMart</p>
          <h2 key={mode} className="mt-2.5 animate-fade-in text-3xl font-bold leading-tight text-[#FFF8EC]">
            {panelTitle}
          </h2>
          <p className="mt-2 italic text-xs text-[#E8D5B5]">&ldquo;Spreading sweetness among people... Since 1957&rdquo;</p>
          <ul className="mt-5 space-y-2.5 text-xs text-[#E8D5B5]/90">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[#C99A42]">
                  <Icon size={13} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      {/* Form side */}
      <div className="px-5 py-7 sm:px-9 sm:py-9">
        <div className="relative flex rounded-full bg-[#FFF8EC] p-1 border border-[#E8D5B5]" role="tablist">
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-[#542B24] shadow-xs transition-transform duration-500 ease-[cubic-bezier(0.34,1.3,0.64,1)] ${
              mode === 'login' ? 'translate-x-0' : 'translate-x-full'
            }`}
          />
          <Link to="/login" state={location.state} role="tab" aria-selected={mode === 'login'} className={tabClass(mode === 'login')}>
            Log in
          </Link>
          <Link to="/register" state={location.state} role="tab" aria-selected={mode === 'register'} className={tabClass(mode === 'register')}>
            Create account
          </Link>
        </div>

        <div key={mode} className="auth-swap">
          <h1 className="mt-6 text-xl sm:text-2xl font-bold text-[#542B24]">{title}</h1>
          <div className="mt-1.5 h-1 w-14 rounded bg-[#C99A42]" />
          <p className="mt-2.5 text-xs text-[#542B24]/70">{subtitle}</p>
          {location.state && location.state.from && (
            <p role="status" className="mt-3.5 rounded-xl border border-[#E8D5B5] bg-[#FFF8EC] p-2.5 text-xs text-[#9B4A32] font-medium">
              Please log in to continue. The items in your cart are kept.
            </p>
          )}

          <div className="mt-6">{children}</div>
        </div>
      </div>
    </section>
  )
}
