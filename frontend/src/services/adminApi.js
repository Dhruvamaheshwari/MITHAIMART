import axios from 'axios'

// Axios instance for ADMIN pages only. It adds the admin login token to every request.
// The token is kept in sessionStorage: it disappears when the browser tab is closed.
// The password is never stored anywhere. Hiding admin buttons is only for convenience:
// the backend checks the token and the admin role again on every request.
const TOKEN_KEY = 'mithaimart_admin_token'

export function getAdminToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    // if the browser blocks storage, the login simply will not be remembered
  }
}

export function clearAdminToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // nothing to clear
  }
}

const adminApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

adminApi.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// If the backend says "not logged in" (401) or "not an admin" (403), forget the token and go to login
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status
    const isLoginRequest = error.config && error.config.url === '/admin/login/'
    if ((status === 401 || status === 403) && !isLoginRequest) {
      clearAdminToken()
      window.location.assign('/admin/login')
    }
    return Promise.reject(error)
  },
)

export default adminApi
