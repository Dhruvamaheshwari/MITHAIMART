import { createContext, useEffect, useState } from 'react'

export const LocationContext = createContext({
  location: null,
  loading: false,
  error: null,
  detectLocation: () => {},
  setLocationManually: () => {},
  lookupPincode: () => {},
  isLocationModalOpen: false,
  setIsLocationModalOpen: () => {},
})

const STORAGE_KEY = 'mithaimart_delivery_location'

const DEFAULT_LOCATION = {
  city: 'Bengaluru',
  area: 'Central',
  pincode: '560001',
  state: 'Karnataka',
  formatted: 'Bengaluru, Karnataka (560001)',
  method: 'default',
  isDetected: false,
}

export function LocationProvider({ children }) {
  const [location, setLocation] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // fallback
    }
    return DEFAULT_LOCATION
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false)

  // Persist location changes
  function updateLocation(newLoc) {
    setLocation(newLoc)
    setError(null)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLoc))
    } catch {
      // ignore storage error
    }
  }

  // Reverse geocode lat/lon via BigDataCloud with fallback to Nominatim
  async function reverseGeocode(lat, lon) {
    // 1. Try BigDataCloud
    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const city = data.city || data.locality || data.principalSubdivision || 'India'
        const area = data.locality || data.localityInfo?.administrative?.[3]?.name || ''
        const pincode = data.postcode || ''
        const state = data.principalSubdivision || ''
        return {
          city,
          area: area !== city ? area : '',
          pincode,
          state,
          formatted: [area, city, pincode].filter(Boolean).join(', '),
          lat,
          lon,
          method: 'gps',
          isDetected: true,
        }
      }
    } catch {
      // continue to fallback
    }

    // 2. Fallback to Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (res.ok) {
        const data = await res.json()
        const addr = data.address || {}
        const city = addr.city || addr.town || addr.village || addr.suburb || 'India'
        const area = addr.suburb || addr.neighbourhood || ''
        const pincode = addr.postcode || ''
        const state = addr.state || ''
        return {
          city,
          area,
          pincode,
          state,
          formatted: [area, city, pincode].filter(Boolean).join(', '),
          lat,
          lon,
          method: 'gps',
          isDetected: true,
        }
      }
    } catch {
      // failed
    }

    return null
  }

  // Fetch location via IP address (no browser prompt required)
  async function fetchIpLocation() {
    try {
      const res = await fetch('https://ipwho.is/')
      if (res.ok) {
        const data = await res.json()
        if (data.success !== false) {
          const city = data.city || 'India'
          const state = data.region || ''
          const pincode = data.postal || ''
          return {
            city,
            area: '',
            pincode,
            state,
            formatted: [city, state, pincode].filter(Boolean).join(', '),
            lat: data.latitude,
            lon: data.longitude,
            method: 'ip',
            isDetected: true,
          }
        }
      }
    } catch {
      // fallback to freeipapi
    }

    try {
      const res = await fetch('https://freeipapi.com/api/json')
      if (res.ok) {
        const data = await res.json()
        const city = data.cityName || 'India'
        const state = data.regionName || ''
        const pincode = data.zipCode || ''
        return {
          city,
          area: '',
          pincode,
          state,
          formatted: [city, state, pincode].filter(Boolean).join(', '),
          lat: data.latitude,
          lon: data.longitude,
          method: 'ip',
          isDetected: true,
        }
      }
    } catch {
      // ignore
    }

    return null
  }

  // Detect current location
  // If useGps is true (e.g. user clicked "Detect Location" button): prompts for GPS with high accuracy
  // If GPS is denied or unavailable, falls back to IP location
  async function detectLocation(useGps = true) {
    setLoading(true)
    setError(null)

    if (useGps && navigator.geolocation) {
      const getPos = () =>
        new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000,
          })
        })

      try {
        const pos = await getPos()
        const { latitude, longitude } = pos.coords
        const result = await reverseGeocode(latitude, longitude)
        if (result) {
          updateLocation(result)
          setLoading(false)
          return result
        }
      } catch (err) {
        console.warn('GPS location failed or denied, falling back to IP:', err.message)
      }
    }

    // IP fallback
    const ipLoc = await fetchIpLocation()
    if (ipLoc) {
      updateLocation(ipLoc)
      setLoading(false)
      return ipLoc
    }

    setLoading(false)
    setError('Unable to detect current location automatically. Please enter your pincode or city.')
    return null
  }

  // Lookup 6-digit Indian Pincode
  async function lookupPincode(pincode) {
    const cleanPin = (pincode || '').trim()
    if (!/^[1-9]\d{5}$/.test(cleanPin)) {
      return { ok: false, error: 'Enter a valid 6-digit Indian pincode' }
    }

    try {
      const res = await fetch(`https://api.postalpincode.in/pincode/${cleanPin}`)
      if (res.ok) {
        const data = await res.json()
        if (data && data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
          const po = data[0].PostOffice[0]
          const city = po.District || po.Division || po.Circle
          const state = po.State
          const area = po.Name !== city ? po.Name : ''
          const loc = {
            city,
            area,
            pincode: cleanPin,
            state,
            formatted: [area, city, cleanPin].filter(Boolean).join(', '),
            method: 'manual',
            isDetected: true,
          }
          updateLocation(loc)
          return { ok: true, location: loc }
        }
      }
    } catch (e) {
      console.warn('Pincode lookup error:', e)
    }

    return { ok: false, error: 'Pincode not found. Please verify your 6-digit code.' }
  }

  // Set location manually
  function setLocationManually(manualLoc) {
    const formatted = [manualLoc.area, manualLoc.city, manualLoc.pincode].filter(Boolean).join(', ')
    updateLocation({
      ...manualLoc,
      formatted,
      method: 'manual',
      isDetected: true,
    })
  }

  // On first mount: if location has not been detected yet, detect silently via IP without bothering with GPS prompt
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) {
        detectLocation(false)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <LocationContext.Provider
      value={{
        location,
        loading,
        error,
        detectLocation,
        setLocationManually,
        lookupPincode,
        isLocationModalOpen,
        setIsLocationModalOpen,
      }}
    >
      {children}
    </LocationContext.Provider>
  )
}
