import { createContext, useContext, useEffect, useState } from 'react'
import api, { clearCustomerToken, getCustomerToken, setCustomerToken } from '../services/api'
import { getErrorMessage } from '../utils/helpers'
import { CartContext } from './CartContext'

// Shares "who is logged in" with every component (the Navbar, the login page...).
export const AuthContext = createContext(null)

// Turns an error from the backend into { ok: false, message, details }
function describeError(err) {
  const status = err.response && err.response.status
  if (status === 429) return { ok: false, message: 'Too many attempts. Please wait a while and try again.', details: {} }
  const data = err.response && err.response.data
  return { ok: false, message: (data && data.error) || getErrorMessage(err), details: (data && data.details) || {} }
}

export function AuthProvider({ children }) {
  const { refreshCart } = useContext(CartContext)
  const [user, setUser] = useState(null)
  // Only "loading" when there is a saved token that we still have to check with the backend
  const [loading, setLoading] = useState(() => Boolean(getCustomerToken()))

  // On start: if a token is saved, ask the backend who it belongs to
  useEffect(() => {
    if (!getCustomerToken()) return
    api
      .get('/auth/me/')
      .then((response) => setUser(response.data))
      .catch(() => {}) // a bad token is removed by the api interceptor
      .finally(() => setLoading(false))
  }, [])

  // The backend moved this browser's guest cart into the account cart, so load the cart again
  function finishLogin(data) {
    setCustomerToken(data.token)
    setUser(data.user)
    refreshCart()
  }

  async function login(email, password) {
    try {
      const response = await api.post('/auth/login/', { email, password })
      finishLogin(response.data)
      return { ok: true }
    } catch (err) {
      return describeError(err)
    }
  }

  async function register(name, email, password) {
    try {
      const response = await api.post('/auth/register/', { name, email, password })
      finishLogin(response.data)
      return { ok: true }
    } catch (err) {
      return describeError(err)
    }
  }

  function logout() {
    clearCustomerToken()
    setUser(null)
    refreshCart() // back to the guest cart
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout }}>{children}</AuthContext.Provider>
}
