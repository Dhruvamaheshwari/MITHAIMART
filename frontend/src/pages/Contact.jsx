import { useState } from 'react'
import {
  CheckCircle,
  Clock,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
} from 'lucide-react'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'General Inquiry',
    message: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function handleChange(e) {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setErrorMsg('')

    if (!formData.name.trim()) {
      setErrorMsg('Please enter your full name.')
      return
    }
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setErrorMsg('Please enter a valid email address.')
      return
    }
    if (!formData.message.trim()) {
      setErrorMsg('Please enter your message.')
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/contact/', formData)
      if (res.data?.status === 'success') {
        setSubmitted(true)
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: 'General Inquiry',
          message: '',
        })
      } else {
        setErrorMsg('Something went wrong. Please try again.')
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err) || 'Failed to send message. Please try again or call us directly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-[#FFF8EC]/40 py-10 sm:py-14 animate-fade-in">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        {/* Page Hero Header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#9B4A32]/10 px-3.5 py-1 text-xs font-bold tracking-wider text-[#9B4A32] uppercase mb-3 border border-[#9B4A32]/20">
            <Sparkles size={13} className="text-[#C99A42]" />
            We Are Here For You
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-black text-[#542B24] tracking-tight">
            Contact <span className="text-[#9B4A32]">MithaiMart</span>
          </h1>
          <p className="mt-3 text-xs sm:text-sm text-[#542B24]/75 font-normal leading-relaxed">
            Have a question about courier delivery, custom wedding hampers, bulk corporate gifting, or our heritage sweets? Reach out and our team will be delighted to assist you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Contact Information Cards */}
          <div className="lg:col-span-5 space-y-4">
            {/* Phone & WhatsApp Card */}
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-2xs hover:border-[#9B4A32] transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF8EC] text-[#9B4A32] border border-[#E8D5B5]">
                  <Phone size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#542B24]">Phone & WhatsApp Support</h3>
                  <p className="text-xs text-[#542B24]/70 mt-0.5">Direct line to our sweet concierge</p>
                  <a
                    href="tel:+919876543210"
                    className="mt-2 block font-serif text-base font-bold text-[#9B4A32] hover:text-[#542B24] transition-colors"
                  >
                    +91 98765 43210
                  </a>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md mt-1.5">
                    <Clock size={11} /> Mon - Sun: 9:00 AM - 10:00 PM IST
                  </span>
                </div>
              </div>
            </div>

            {/* Email Support Card */}
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-2xs hover:border-[#9B4A32] transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF8EC] text-[#9B4A32] border border-[#E8D5B5]">
                  <Mail size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#542B24]">Email Inquiries (SMTP Enabled)</h3>
                  <p className="text-xs text-[#542B24]/70 mt-0.5">Quick responses within 2 to 4 hours</p>
                  <div className="mt-2 space-y-0.5">
                    <a
                      href="mailto:support@mithaimart.com"
                      className="block text-xs font-semibold text-[#9B4A32] hover:underline"
                    >
                      support@mithaimart.com
                    </a>
                    <a
                      href="mailto:orders@mithaimart.com"
                      className="block text-xs font-semibold text-[#542B24]/80 hover:underline"
                    >
                      orders@mithaimart.com (Corporate & Bulk)
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Flagship Store Address */}
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-5 sm:p-6 shadow-2xs hover:border-[#9B4A32] transition-colors">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF8EC] text-[#9B4A32] border border-[#E8D5B5]">
                  <MapPin size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#542B24]">Flagship Heritage Kitchen & Store</h3>
                  <p className="mt-1 text-xs text-[#542B24]/80 leading-relaxed font-normal">
                    MithaiMart Heritage Bhavan, Shop No. 12-14, Inner Circle, Connaught Place, New Delhi - 110001
                  </p>
                  <span className="inline-block mt-2 text-[11px] font-bold text-[#C99A42]">
                    • Authentic Desi Ghee Live Counters & Tasting Parlor
                  </span>
                </div>
              </div>
            </div>

            {/* Courier Delivery Trust Badge */}
            <div className="rounded-2xl border border-[#C99A42]/50 bg-gradient-to-br from-[#FFF8EC] to-[#E8D5B5]/30 p-5 shadow-2xs">
              <div className="flex items-center gap-3 mb-2">
                <Truck size={20} className="text-[#9B4A32]" />
                <h4 className="text-xs font-bold text-[#542B24] uppercase tracking-wider">
                  Pan-India Courier Network
                </h4>
              </div>
              <p className="text-xs text-[#542B24]/80 leading-relaxed">
                We safely courier our pure desi ghee sweets across 19,000+ pincodes in India with vacuum airtight sealing and nitrogen flushing for maximum shelf life.
              </p>
            </div>
          </div>

          {/* Right Column: Contact Form */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-[#E8D5B5] bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-[#E8D5B5]">
                <div>
                  <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#542B24]">
                    Send us a Message
                  </h2>
                  <p className="text-xs text-[#542B24]/70 mt-0.5">
                    Direct inquiry via our integrated SMTP email gateway
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-[#9B4A32] bg-[#FFF8EC] px-3 py-1.5 rounded-full border border-[#E8D5B5]">
                  <ShieldCheck size={14} className="text-[#C99A42]" />
                  <span>Secure SMTP Delivery</span>
                </div>
              </div>

              {submitted ? (
                <div className="py-12 text-center space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle size={36} />
                  </div>
                  <h3 className="font-serif text-2xl font-bold text-[#542B24]">
                    Thank You! Your Message is on its way.
                  </h3>
                  <p className="max-w-md mx-auto text-xs sm:text-sm text-[#542B24]/75 leading-relaxed">
                    We have dispatched your message to our team via SMTP and recorded your request. One of our sweet specialists will respond to your email shortly.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="mt-4 rounded-xl bg-[#9B4A32] px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-[#542B24] transition-colors"
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errorMsg && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 font-medium">
                      {errorMsg}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Name */}
                    <div>
                      <label className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-1.5">
                        Your Name <span className="text-[#9B4A32]">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="e.g. Rahul Sharma"
                        required
                        className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-4 py-2.5 text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-1.5">
                        Email Address <span className="text-[#9B4A32]">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="name@example.com"
                        required
                        className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-4 py-2.5 text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Phone */}
                    <div>
                      <label className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-1.5">
                        Phone Number (Optional)
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="e.g. +91 98765 43210"
                        className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-4 py-2.5 text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition"
                      />
                    </div>

                    {/* Subject */}
                    <div>
                      <label className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-1.5">
                        Inquiry Subject
                      </label>
                      <select
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 px-3.5 py-2.5 text-xs sm:text-sm text-[#542B24] font-medium outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition cursor-pointer"
                      >
                        <option value="General Inquiry">General Inquiry</option>
                        <option value="Courier Order Status & Tracking">Courier Order Status & Tracking</option>
                        <option value="Bulk Wedding & Celebration Gifting">Bulk Wedding & Celebration Gifting</option>
                        <option value="Corporate Hampers & Custom Branding">Corporate Hampers & Custom Branding</option>
                        <option value="Product Quality & Sweet Feedback">Product Quality & Sweet Feedback</option>
                      </select>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-1.5">
                      Your Message <span className="text-[#9B4A32]">*</span>
                    </label>
                    <textarea
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Please let us know your requirements, delivery date, quantities, or query..."
                      required
                      className="w-full rounded-xl border border-[#E8D5B5] bg-[#FFF8EC]/30 p-4 text-xs sm:text-sm text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition leading-relaxed resize-y"
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#9B4A32] hover:bg-[#542B24] text-white px-8 py-3.5 text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-60 cursor-pointer"
                    >
                      {submitting ? (
                        <>
                          <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Dispatching via SMTP...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          <span>Send Message via Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
