import { createContext, useEffect, useState } from 'react'
import api from '../services/api'
import { getErrorMessage } from '../utils/helpers'

// Context = one shared box of cart data that every component can read,
// without passing props through each level.
export const CartContext = createContext(null)

const emptyCart = { items: [], total_quantity: 0, subtotal: 0 }

export function CartProvider({ children }) {
  const [cart, setCart] = useState(emptyCart)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false) // true while a request is running
  const [loadError, setLoadError] = useState('')

  // Fetch the cart once when the app loads
  useEffect(() => {
    api
      .get('/cart/')
      .then((response) => setCart(response.data))
      .catch((err) => setLoadError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  // Runs one cart request. The backend always answers with the full updated cart,
  // so we simply store it. Returns { ok, message } so the page can show a message.
  async function sendRequest(makeRequest) {
    setUpdating(true)
    try {
      const response = await makeRequest()
      setCart(response.data)
      setLoadError('')
      return { ok: true }
    } catch (err) {
      const backendMessage = err.response && err.response.data && err.response.data.error
      return { ok: false, message: backendMessage || getErrorMessage(err) }
    } finally {
      setUpdating(false)
    }
  }

  function addToCart(productId, variantWeight, quantity) {
    return sendRequest(() =>
      api.post('/cart/add/', { product_id: productId, variant_weight: variantWeight, quantity }),
    )
  }

  function updateQuantity(productId, variantWeight, quantity) {
    return sendRequest(() =>
      api.put('/cart/update/', { product_id: productId, variant_weight: variantWeight, quantity }),
    )
  }

  function removeFromCart(productId, variantWeight) {
    return sendRequest(() => api.delete(`/cart/remove/${productId}/${encodeURIComponent(variantWeight)}/`))
  }

  function clearCart() {
    return sendRequest(() => api.delete('/cart/clear/'))
  }

  const value = {
    cartItems: cart.items,
    cartTotal: cart.subtotal, // total price, calculated by the backend from real prices
    cartCount: cart.total_quantity, // total number of pieces, shown in the Navbar
    loading,
    updating,
    loadError,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}
