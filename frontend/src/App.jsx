import StorefrontPage from './pages/StorefrontPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import AddressesPage from './pages/AddressesPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import AdminProductsPage from './pages/AdminProductsPage.jsx'
import AdminOrdersPage from './pages/AdminOrdersPage.jsx'

function App() {
  const path = window.location.pathname
  if (path === '/admin') {
    return <AdminPage />
  }

  if (path === '/admin/products') {
    return <AdminProductsPage />
  }

  if (path === '/admin/orders') {
    return <AdminOrdersPage />
  }

  if (path === '/orders') {
    return <OrdersPage />
  }

  if (path === '/wishlist') {
    return <WishlistPage />
  }

  if (path === '/addresses') {
    return <AddressesPage />
  }

  if (/^\/product\/[^/]+$/.test(path)) {
    return <ProductDetailPage />
  }

  if (/^\/orders\/[^/]+$/.test(path)) {
    return <OrderDetailPage />
  }

  return <StorefrontPage />
}

export default App
