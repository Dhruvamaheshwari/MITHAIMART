import axios from 'axios'

// One Axios instance for the whole app. The backend URL comes from the .env file
// (VITE_API_BASE_URL), so it is written in only one place.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
})

export default api
