import { BrowserRouter, Link, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import AdminLayout from './components/AdminLayout'
import Footer from './components/Footer'
import Navbar from './components/Navbar'
import RequireLogin from './components/RequireLogin'
import LocationModal from './components/LocationModal'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { LocationProvider } from './context/LocationContext'
import Addresses from './pages/Addresses'
import AdminCategories from './pages/admin/AdminCategories'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLogin from './pages/admin/AdminLogin'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminWholesale from './pages/admin/AdminWholesale'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Credits from './pages/Credits'
import Home from './pages/Home'
import AuthPage from './pages/AuthPage'
import MyOrders from './pages/MyOrders'
import OrderConfirmation from './pages/OrderConfirmation'
import ProductDetails from './pages/ProductDetails'
import Products from './pages/Products'
import Contact from './pages/Contact'
import Catalog from './pages/Catalog'
import BuildHamper from './pages/BuildHamper'
import BulkOrders from './pages/BulkOrders'

function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-20 text-center">
      <h1 className="text-3xl font-semibold text-brand-red">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-brand-saffron underline">
        Go back home
      </Link>
    </div>
  )
}

// The customer store pages share the Navbar and Footer. Admin pages do not use them.
// Log in and Create account are one shared page, so switching between them animates instead of reloading
const AUTH_PATHS = ['/login', '/register']

function StoreLayout() {
  const location = useLocation()
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* a new key on every page change replays the fade-in */}
        <div key={AUTH_PATHS.includes(location.pathname) ? 'auth' : location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LocationProvider>
        <CartProvider>
          <AuthProvider>
            <LocationModal />
            <Routes>
            {/* Admin area: AdminLayout sends visitors without a valid admin token to the login page */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="wholesale" element={<AdminWholesale />} />
            </Route>

            {/* Customer store */}
            <Route element={<StoreLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:id" element={<ProductDetails />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/build-hamper" element={<BuildHamper />} />
              <Route path="/bulk-orders" element={<BulkOrders />} />
              <Route path="/checkout" element={<RequireLogin><Checkout /></RequireLogin>} />
              <Route path="/addresses" element={<RequireLogin><Addresses /></RequireLogin>} />
              <Route path="/order-confirmation/:id" element={<RequireLogin><OrderConfirmation /></RequireLogin>} />
              <Route path="/my-orders" element={<RequireLogin><MyOrders /></RequireLogin>} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/credits" element={<Credits />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </CartProvider>
    </LocationProvider>
  </BrowserRouter>
  )
}
