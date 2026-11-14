import axios from 'axios'

// Base URL comes from the environment (see frontend/.env.example).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

export default api
