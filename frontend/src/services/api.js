import axios from 'axios'

// One Axios instance for the whole app. The backend URL comes from the .env file
// (VITE_API_BASE_URL), so it is written in only one place.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

// --- Guest id: tells the backend which cart is ours (there is no login yet) ---
// It is just a random id. It is not a password, so keeping it in localStorage is fine.
const GUEST_ID_KEY = 'mithaimart_guest_id'
let memoryGuestId = null // used only if the browser blocks localStorage

function makeRandomId() {
  if (crypto.randomUUID) return crypto.randomUUID()
  // Fallback for browsers without randomUUID
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function getGuestId() {
  try {
    let guestId = localStorage.getItem(GUEST_ID_KEY)
    if (!guestId) {
      guestId = makeRandomId()
      localStorage.setItem(GUEST_ID_KEY, guestId)
    }
    return guestId
  } catch {
    if (!memoryGuestId) memoryGuestId = makeRandomId()
    return memoryGuestId
  }
}

// Runs before every request and adds the guest id header
api.interceptors.request.use((config) => {
  config.headers['X-Guest-ID'] = getGuestId()
  return config
})

export default api
