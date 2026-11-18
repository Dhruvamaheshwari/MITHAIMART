import { useContext, useEffect, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { LocationContext } from '../context/LocationContext'

const POPULAR_CITIES = [
  { name: 'Bengaluru', state: 'Karnataka', pincode: '560001' },
  { name: 'Delhi NCR', state: 'Delhi', pincode: '110001' },
  { name: 'Mumbai', state: 'Maharashtra', pincode: '400001' },
  { name: 'Kolkata', state: 'West Bengal', pincode: '700001' },
  { name: 'Hyderabad', state: 'Telangana', pincode: '500001' },
  { name: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  { name: 'Ahmedabad', state: 'Gujarat', pincode: '380001' },
  { name: 'Pune', state: 'Maharashtra', pincode: '411001' },
  { name: 'Jaipur', state: 'Rajasthan', pincode: '302001' },
  { name: 'Lucknow', state: 'Uttar Pradesh', pincode: '226001' },
]

export default function LocationModal() {
  const {
    location,
    loading,
    error: contextError,
    detectLocation,
    setLocationManually,
    lookupPincode,
    isLocationModalOpen,
    setIsLocationModalOpen,
  } = useContext(LocationContext)

  const [inputVal, setInputVal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setIsLocationModalOpen(false)
      }
    }
    if (isLocationModalOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLocationModalOpen, setIsLocationModalOpen])

  if (!isLocationModalOpen) return null

  async function handleDetectGps() {
    setLocalError('')
    setSuccessMsg('')
    const res = await detectLocation(true)
    if (res) {
      setSuccessMsg(`Detected: ${res.city}${res.pincode ? ` (${res.pincode})` : ''}`)
      setTimeout(() => {
        setIsLocationModalOpen(false)
        setSuccessMsg('')
      }, 1000)
    } else {
      setLocalError('Could not detect location. Please enter your pincode or choose a city below.')
    }
  }

  async function handlePincodeOrCitySubmit(e) {
    e.preventDefault()
    setLocalError('')
    setSuccessMsg('')
    const clean = inputVal.trim()
    if (!clean) {
      setLocalError('Please enter a 6-digit pincode or city name')
      return
    }

    setSubmitting(true)

    // Check if it's a 6-digit pincode
    if (/^\d{6}$/.test(clean)) {
      const res = await lookupPincode(clean)
      setSubmitting(false)
      if (res.ok) {
        setSuccessMsg(`Location set to ${res.location.city} (${clean})`)
        setTimeout(() => {
          setIsLocationModalOpen(false)
          setSuccessMsg('')
        }, 1000)
      } else {
        setLocalError(res.error || 'Pincode not found. Please try another pincode.')
      }
      return
    }

    // Otherwise, treat as city name
    const matchedPopular = POPULAR_CITIES.find(
      (c) => c.name.toLowerCase().includes(clean.toLowerCase())
    )

    if (matchedPopular) {
      setLocationManually({
        city: matchedPopular.name,
        area: '',
        pincode: matchedPopular.pincode,
        state: matchedPopular.state,
      })
      setSuccessMsg(`Location set to ${matchedPopular.name}`)
      setSubmitting(false)
      setTimeout(() => {
        setIsLocationModalOpen(false)
        setSuccessMsg('')
      }, 900)
      return
    }

    // Generic manual city
    setLocationManually({
      city: clean.charAt(0).toUpperCase() + clean.slice(1),
      area: '',
      pincode: '',
      state: 'India',
    })
    setSuccessMsg(`Location set to ${clean}`)
    setSubmitting(false)
    setTimeout(() => {
      setIsLocationModalOpen(false)
      setSuccessMsg('')
    }, 900)
  }

  function handleSelectCity(cityObj) {
    setLocalError('')
    setLocationManually({
      city: cityObj.name,
      area: '',
      pincode: cityObj.pincode,
      state: cityObj.state,
    })
    setSuccessMsg(`Location set to ${cityObj.name} (${cityObj.pincode})`)
    setTimeout(() => {
      setIsLocationModalOpen(false)
      setSuccessMsg('')
    }, 800)
  }

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsLocationModalOpen(false)
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#FFF8EC] border-2 border-[#E8D5B5] shadow-2xl overflow-hidden flex flex-col max-h-[82vh] my-auto transition-all"
        role="dialog"
        aria-modal="true"
      >
        {/* Sticky Header with Prominent Close Button */}
        <div className="flex items-center justify-between border-b border-[#E8D5B5] px-6 py-4 bg-[#FFF8EC] sticky top-0 z-20 shrink-0">
          <div>
            <h3 className="font-serif text-lg sm:text-xl font-bold text-[#542B24] leading-tight">
              Select Delivery Location
            </h3>
            <p className="text-xs text-[#542B24]/70 font-medium mt-0.5">
              Delivering authentic sweets through courier across India
            </p>
          </div>

          {/* Prominent Close Button */}
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(false)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#E8D5B5]/60 hover:bg-[#9B4A32] text-[#542B24] hover:text-white text-xs font-bold transition-all shadow-xs cursor-pointer border border-[#E8D5B5] hover:border-[#9B4A32]"
            aria-label="Close dialog"
          >
            <span>Close</span>
            <X size={16} />
          </button>
        </div>

        {/* Modal Scrollable Body with Generous Padding & Margin */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Active / Current Location Badge */}
          {location && (
            <div className="rounded-xl border border-[#C99A42]/50 bg-white/80 p-4 flex items-center justify-between gap-3 shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#9B4A32] block">
                  Current Delivery Area
                </span>
                <p className="text-sm font-bold text-[#542B24] mt-1">
                  {location.city} {location.state ? `• ${location.state}` : ''}{' '}
                  {location.pincode ? `(${location.pincode})` : ''}
                </p>
              </div>
              <span className="text-xs font-bold text-[#9B4A32] bg-[#9B4A32]/10 px-3 py-1.5 rounded-full shrink-0">
                Courier Active
              </span>
            </div>
          )}

          {/* Action 1: GPS Auto Detect */}
          <div className="pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={handleDetectGps}
              className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#9B4A32] hover:bg-[#542B24] text-white px-6 py-4 font-bold text-sm shadow-md transition-all duration-200 active:scale-[0.99] disabled:opacity-70 cursor-pointer"
            >
              <div className="text-left">
                <span className="block leading-tight font-bold text-sm sm:text-base">
                  {loading ? 'Detecting your live location...' : 'Fetch My Current Location'}
                </span>
                <span className="block text-xs text-[#FFF8EC]/80 font-normal mt-1">
                  Using Device GPS / Browser Geolocation
                </span>
              </div>
              {loading ? (
                <Loader2 size={20} className="animate-spin text-[#C99A42]" />
              ) : (
                <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-[#FFF8EC]">
                  Instant GPS
                </span>
              )}
            </button>
          </div>

          {/* Feedback Messages */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <Check size={16} className="text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}
          {(localError || contextError) && !successMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              {localError || contextError}
            </div>
          )}

          {/* Divider with spacing */}
          <div className="relative flex items-center justify-center my-3">
            <div className="w-full border-t border-[#E8D5B5]" />
            <span className="absolute bg-[#FFF8EC] px-4 text-xs font-bold uppercase tracking-wider text-[#542B24]/60">
              OR ENTER PINCODE / CITY
            </span>
          </div>

          {/* Action 2: Pincode or City Search Form */}
          <form onSubmit={handlePincodeOrCitySubmit} className="flex gap-2.5 pt-1">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Enter 6-digit Pincode (e.g. 560001, 110001) or City..."
              className="flex-1 rounded-xl border border-[#E8D5B5] bg-white px-4 py-3 text-xs sm:text-sm font-medium text-[#542B24] placeholder-[#542B24]/40 outline-none focus:border-[#9B4A32] focus:ring-2 focus:ring-[#C99A42]/20 transition"
            />
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#542B24] hover:bg-[#9B4A32] text-[#FFF8EC] px-6 py-3 text-xs sm:text-sm font-bold shadow-xs transition-colors active:scale-95 disabled:opacity-60 cursor-pointer"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : 'Set'}
            </button>
          </form>

          {/* Action 3: Quick Popular Cities */}
          <div className="pt-2">
            <span className="block text-xs font-bold text-[#542B24] uppercase tracking-wider mb-3">
              Popular Delivery Hubs
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {POPULAR_CITIES.map((c) => {
                const isSelected = location?.city?.toLowerCase() === c.name.toLowerCase()
                return (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => handleSelectCity(c)}
                    className={`p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'border-[#9B4A32] bg-[#9B4A32]/10 text-[#9B4A32] font-bold shadow-2xs'
                        : 'border-[#E8D5B5] bg-white hover:bg-[#E8D5B5]/30 text-[#542B24] font-medium hover:border-[#9B4A32]'
                    }`}
                  >
                    <span className="block text-xs font-bold leading-tight truncate">{c.name}</span>
                    <span className="block text-[11px] text-[#542B24]/60 font-mono mt-1">{c.pincode}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Courier Trust Information with proper padding */}
          <div className="rounded-xl border border-[#E8D5B5] bg-white/70 p-4 text-xs text-[#542B24]/80 mt-2">
            <span className="font-bold text-[#542B24] block mb-1">Delivering through Courier Pan-India</span>
            <p className="text-[11px] text-[#542B24]/70 leading-relaxed">
              Packed fresh with vacuum airtight packaging to deliver 100% freshness to your doorstep via BlueDart & DTDC.
            </p>
          </div>
        </div>

        {/* Modal Bottom Footer with Close Action */}
        <div className="border-t border-[#E8D5B5] px-6 py-4 bg-[#FFF8EC] flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => setIsLocationModalOpen(false)}
            className="px-6 py-2.5 rounded-xl bg-white border border-[#E8D5B5] hover:border-[#9B4A32] hover:bg-[#9B4A32] hover:text-white text-[#542B24] text-xs sm:text-sm font-bold transition-all shadow-xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
