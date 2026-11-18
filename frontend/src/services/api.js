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

// --- Customer login token ---
// After logging in or signing up the backend gives us a token. We keep ONLY the token (never the password)
// in localStorage so the customer stays logged in for a few days. Trade-off: a script injected into the
// page could read it, so never put untrusted HTML in the site. "Log out" removes it.
const CUSTOMER_TOKEN_KEY = 'mithaimart_customer_token'

export function getCustomerToken() {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setCustomerToken(token) {
  try {
    localStorage.setItem(CUSTOMER_TOKEN_KEY, token)
  } catch {
    // if the browser blocks storage, the customer simply stays logged in until the page is closed
  }
}

export function clearCustomerToken() {
  try {
    localStorage.removeItem(CUSTOMER_TOKEN_KEY)
  } catch {
    // nothing to remove
  }
}

// Runs before every request: adds the guest id, and the login token when the customer is logged in.
// Logged in = the backend uses the account. Not logged in = the backend uses the guest id.
api.interceptors.request.use((config) => {
  config.headers['X-Guest-ID'] = getGuestId()
  const token = getCustomerToken()
  const isLoginOrSignUp = config.url === '/auth/login/' || config.url === '/auth/register/'
  if (token && !isLoginOrSignUp) config.headers.Authorization = `Bearer ${token}`
  return config
})

// If the backend says our token is no good (expired, or the account is gone), forget it and reload:
// the customer is then simply a guest again instead of seeing errors everywhere.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = error.config && error.config.headers && error.config.headers.get('Authorization')
    if (error.response && error.response.status === 401 && sentToken) {
      clearCustomerToken()
      window.location.reload()
    }
    return Promise.reject(error)
  },
)

export default api
