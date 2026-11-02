import StorefrontPage from './pages/StorefrontPage.jsx'
import OrdersPage from './pages/OrdersPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import ProductDetailPage from './pages/ProductDetailPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import AddressesPage from './pages/AddressesPage.jsx'
import OrderDetailPage from './pages/OrderDetailPage.jsx'
import AdminProductsPage from './pages/AdminProductsPage.jsx'
import AdminOrdersPage from './pages/AdminOrdersPage.jsx'
import Chatbot from './components/Chatbot.jsx'

function App() {
  const path = window.location.pathname
  let page = <StorefrontPage />

  if (path === '/admin') {
    page = <AdminPage />
  } else if (path === '/admin/products') {
    page = <AdminProductsPage />
  } else if (path === '/admin/orders') {
    page = <AdminOrdersPage />
  } else if (path === '/orders') {
    page = <OrdersPage />
  } else if (path === '/wishlist') {
    page = <WishlistPage />
  } else if (path === '/addresses') {
    page = <AddressesPage />
  } else if (/^\/product\/[^/]+$/.test(path)) {
    page = <ProductDetailPage />
  } else if (/^\/orders\/[^/]+$/.test(path)) {
    page = <OrderDetailPage />
  }

  return (
    <>
      {page}
      <Chatbot />
    </>
  )
}

export default App
