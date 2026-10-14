import { useEffect, useRef, useState } from 'react'
import StyledSelect from '../components/StyledSelect.jsx'
import StoreIcon from '../components/StoreIcon.jsx'
import { responsiveImage } from '../utils/responsiveImage.js'

const GUEST_CART_KEY = 'noshin-guest-cart'
const SHIPPING_FEE = 250

const readSavedUser = () => {
  try {
    const savedUser = sessionStorage.getItem('ecommerce-user')
    return savedUser ? JSON.parse(savedUser) : null
  } catch {
    return null
  }
}

const readOAuthSession = () => {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('token')
  if (!token) return null

  return {
    token,
    user: {
      name: params.get('name') || 'Customer',
      email: params.get('email') || '',
      role: params.get('role') || 'customer',
    },
  }
}

const readGuestCart = () => {
  try {
    const cart = JSON.parse(localStorage.getItem(GUEST_CART_KEY) || '[]')
    return Array.isArray(cart) ? cart : []
  } catch {
    return []
  }
}

const getProductId = (item) =>
  typeof item.product === 'object' ? item.product?._id : item.product

const sameVariant = (first = {}, second = {}) =>
  (first.size || '') === (second.size || '') &&
  (first.color || '') === (second.color || '')

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('ecommerce-token')
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }
  return data
}

function App() {
  const [oauthSession] = useState(() => readOAuthSession())
  const [user, setUser] = useState(() => oauthSession?.user || readSavedUser())
  const [products, setProducts] = useState([])
  const [productTotal, setProductTotal] = useState(0)
  const [productPages, setProductPages] = useState(1)
  const [cart, setCart] = useState(readGuestCart)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minRating, setMinRating] = useState('')
  const [inStock, setInStock] = useState(false)
  const [page, setPage] = useState(1)
  const [allCategories, setAllCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [recentProducts, setRecentProducts] = useState([])
  const [sort, setSort] = useState('newest')
  const [mode, setMode] = useState('login')
  const [authOpen, setAuthOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [shippingAddress, setShippingAddress] = useState({
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Pakistan',
  })
  const [guestDetails, setGuestDetails] = useState({ name: '', email: '' })
  const [selectedVariants, setSelectedVariants] = useState({})
  const [loadingProducts, setLoadingProducts] = useState(true)
  const hasLoadedProducts = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [orderConfirmation, setOrderConfirmation] = useState(null)

  useEffect(() => {
    if (oauthSession) {
      sessionStorage.setItem('ecommerce-token', oauthSession.token)
      sessionStorage.setItem('ecommerce-user', JSON.stringify(oauthSession.user))
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      )
    }
  }, [oauthSession])

  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      setLoadingProducts(true)
      const params = new URLSearchParams({ limit: '12', page: String(page), sort })
      if (search.trim()) params.set('search', search.trim())
      if (category) params.set('category', category)
      if (brand) params.set('brand', brand)
      if (minPrice) params.set('minPrice', minPrice)
      if (maxPrice) params.set('maxPrice', maxPrice)
      if (minRating) params.set('minRating', minRating)
      if (inStock) params.set('inStock', 'true')

      apiRequest(`/api/products?${params}`)
        .then((data) => {
          if (active) {
            setProducts(Array.isArray(data.products) ? data.products : [])
            setProductTotal(data.total || 0)
            setProductPages(Math.max(1, data.pages || 1))
          }
        })
        .catch((requestError) => {
          if (active) setError(requestError.message)
        })
        .finally(() => {
          if (active) {
            setLoadingProducts(false)
            hasLoadedProducts.current = true
          }
        })
    }, hasLoadedProducts.current ? 180 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [search, category, brand, minPrice, maxPrice, minRating, inStock, sort, page])

  useEffect(() => {
    let active = true
    Promise.all([apiRequest('/api/categories'), apiRequest('/api/products/filters')])
      .then(([categoriesData, filterData]) => {
        if (active) {
          setAllCategories(Array.isArray(categoriesData) ? categoriesData : [])
          setBrands(Array.isArray(filterData.brands) ? filterData.brands : [])
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let ids = []
    try {
      const stored = JSON.parse(localStorage.getItem('noshin-recently-viewed') || '[]')
      ids = Array.isArray(stored) ? stored.slice(0, 4) : []
    } catch {
      ids = []
    }
    Promise.all(ids.map((id) => apiRequest(`/api/products/${id}`).catch(() => null)))
      .then((items) => {
        if (active) setRecentProducts(items.filter(Boolean))
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) return

    let active = true
    apiRequest('/api/cart')
      .then((data) => {
        if (active) setCart(Array.isArray(data.items) ? data.items : [])
      })
      .catch((requestError) => {
        if (active) setError(`Could not load your cart: ${requestError.message}`)
      })
    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    if (!user) return
    let active = true
    apiRequest('/api/users/me/addresses')
      .then((addresses) => {
        const preferred = Array.isArray(addresses) ? addresses.find((address) => address.isDefault) : null
        if (active && preferred) {
          setShippingAddress({
            street: preferred.street,
            city: preferred.city,
            state: preferred.state,
            postalCode: preferred.postalCode,
            country: preferred.country,
          })
        }
      })
      .catch((requestError) => {
        if (active) setError(`Could not load saved address: ${requestError.message}`)
      })
    return () => { active = false }
  }, [user])

  useEffect(() => {
    if (!user) localStorage.setItem(GUEST_CART_KEY, JSON.stringify(cart))
  }, [cart, user])

  const categories = allCategories.map((item) => item.name)

  const cartCount = cart.reduce((count, item) => count + item.quantity, 0)
  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0)

  const updateCart = async (nextCart) => {
    setCart(nextCart)
    setError('')
  }

  const refreshSignedInCart = async () => {
    const data = await apiRequest('/api/cart')
    setCart(Array.isArray(data.items) ? data.items : [])
  }

  const addToCart = async (product) => {
    const selectedVariant = selectedVariants[product._id] || {}
    if (product.variants?.length && !Object.keys(selectedVariant).length) {
      setError(`Choose an option for ${product.title} before adding it.`)
      return
    }
    setError('')
    setNotice('')

    try {
      if (user) {
        await apiRequest('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId: product._id, quantity: 1, selectedVariant }),
        })
        await refreshSignedInCart()
      } else {
        const existing = cart.find(
          (item) =>
            getProductId(item) === product._id &&
            sameVariant(item.selectedVariant, selectedVariant),
        )
        if ((existing?.quantity || 0) >= product.stock) {
          throw new Error('Requested quantity exceeds available stock')
        }
        const nextCart = existing
          ? cart.map((item) =>
              item === existing ? { ...item, quantity: item.quantity + 1 } : item,
            )
          : [
              ...cart,
              {
                product: product._id,
                productInfo: product,
                quantity: 1,
                selectedVariant,
                price:
                  product.price +
                  (product.variants?.find((variant) => sameVariant(variant, selectedVariant))
                    ?.additionalPrice || 0),
              },
            ]
        await updateCart(nextCart)
      }
      setNotice(`${product.title} added to your bag.`)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const changeQuantity = async (item, quantity) => {
    if (quantity < 1) {
      removeFromCart(item)
      return
    }
    const product = productForItem(item)
    if (product && quantity > product.stock) {
      setError('Requested quantity exceeds available stock')
      return
    }
    setError('')
    try {
      if (user) {
        await apiRequest(`/api/cart/items/${item._id}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity }),
        })
        await refreshSignedInCart()
      } else {
        await updateCart(
          cart.map((cartItem) =>
            cartItem === item ? { ...cartItem, quantity } : cartItem,
          ),
        )
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const removeFromCart = async (item) => {
    setError('')
    try {
      if (user) {
        await apiRequest(`/api/cart/items/${item._id}`, { method: 'DELETE' })
        await refreshSignedInCart()
      } else {
        await updateCart(cart.filter((cartItem) => cartItem !== item))
      }
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(
          mode === 'register'
            ? authForm
            : { email: authForm.email, password: authForm.password },
        ),
      })
      const authenticatedUser = {
        name: data.name,
        email: data.email,
        role: data.role,
      }
      sessionStorage.setItem('ecommerce-token', data.token)
      sessionStorage.setItem('ecommerce-user', JSON.stringify(authenticatedUser))
      if (cart.length) {
        await apiRequest('/api/cart/merge', {
          method: 'POST',
          body: JSON.stringify({
            items: cart.map((item) => ({
              productId: getProductId(item),
              quantity: item.quantity,
              selectedVariant: item.selectedVariant,
            })),
          }),
        })
        localStorage.removeItem(GUEST_CART_KEY)
      }
      setUser(authenticatedUser)
      setAuthOpen(false)
      setNotice(`Welcome${authenticatedUser.name ? `, ${authenticatedUser.name}` : ''}!`)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const signOut = () => {
    sessionStorage.removeItem('ecommerce-token')
    sessionStorage.removeItem('ecommerce-user')
    setUser(null)
    setCart(readGuestCart())
    setNotice('You have been signed out.')
  }

  const handleCheckout = async (event) => {
    event.preventDefault()
    if (!cart.length) {
      setError('Your bag is empty.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let order
      if (user) {
        order = await apiRequest('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ shippingAddress }),
        })
        await refreshSignedInCart()
      } else {
        order = await apiRequest('/api/orders/guest', {
          method: 'POST',
          body: JSON.stringify({
            ...guestDetails,
            items: cart.map((item) => ({
              productId: getProductId(item),
              quantity: item.quantity,
              selectedVariant: item.selectedVariant,
            })),
            shippingAddress,
          }),
        })
        await updateCart([])
      }
      setOrderConfirmation(order)
      setCheckoutOpen(false)
      setCartOpen(false)
      setNotice('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const productForItem = (item) =>
    item.productInfo ||
    (typeof item.product === 'object'
      ? item.product
      : products.find((product) => product._id === getProductId(item)))

  return (
    <main className="storefront">
      <div className="announcement">A little treat: complimentary delivery on orders over PKR 5,000</div>
      <header className="store-header">
        <a className="store-logo" href="/" aria-label="Noshin home">noshin<span>.</span></a>
        <nav className="store-nav" aria-label="Store categories">
          <a href="#shop">Shop all</a>
          <a href="#shop" onClick={() => setCategory('')}>The edit</a>
          <a href="#footer">Our story</a>
        </nav>
        <div className="header-actions">
  {user ? (
    <>
      <span className="greeting-avatar" title={`Hi, ${user.name.split(' ')[0]}`}>{user.name.trim().charAt(0).toUpperCase()}</span>
      <a className="icon-btn" href="/wishlist" aria-label="Wishlist" data-tip="Wishlist"><StoreIcon name="heart" /></a>
      <a className="icon-btn" href="/orders" aria-label="My orders" data-tip="My orders"><StoreIcon name="box" /></a>
      <a className="icon-btn" href="/addresses" aria-label="Saved addresses" data-tip="Addresses"><StoreIcon name="pin" /></a>
      <button className="icon-btn" onClick={signOut} type="button" aria-label="Sign out" data-tip="Sign out"><StoreIcon name="logout" /></button>
    </>
  ) : (
    <button className="header-link sign-in-link" onClick={() => { setError(''); setAuthOpen(true) }} type="button">
      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6.5" r="3" /><path d="M4.5 17c.4-3.1 2.3-4.8 5.5-4.8s5.1 1.7 5.5 4.8" /></svg>
      <span>Sign in</span>
    </button>
  )}
  <a className="icon-btn" href="/admin" aria-label="Admin portal" data-tip="Admin"><StoreIcon name="shield" /></a>
  <button className="icon-btn bag-btn" onClick={() => { setError(''); setCartOpen(true) }} type="button" aria-label={`Open bag, ${cartCount} items`} data-tip="Bag">
    <StoreIcon name="bag" />
    {cartCount > 0 && <b className="icon-badge" key={cartCount}>{cartCount}</b>}

  </button>
        </div>
      </header>

      <section className="store-hero">
        <div className="hero-copy">
          <p className="store-eyebrow">THE EVERYDAY EDIT · NO. 01</p>
          <h1>Good things,<br />chosen well.</h1>
          <p>Thoughtful essentials to make the everyday feel a little more yours.</p>
          <a href="#shop" className="hero-cta">Explore the collection <span>↓</span></a>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-shape shape-back" />
          <div className="hero-art-shape shape-front" />
          <span className="hero-art-caption">A considered collection</span>
          <span className="hero-art-number">01 / 03</span>
        </div>
      </section>

      <section className="shop-section" id="shop">
        <div className="shop-heading">
          <div>
            <p className="store-eyebrow">MADE FOR YOUR EVERYDAY</p>
            <h2>The collection</h2>
          </div>
          <p className="shop-count">{products.length} thoughtfully picked pieces</p>
        </div>
        <div className="shop-tools">
          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="Search products"
              onChange={(event) => { setPage(1); setSearch(event.target.value) }}
              placeholder="Search the collection"
              value={search}
            />
          </label>
          <div className="filter-controls">
            <StyledSelect
              aria-label="Filter by category"
              onChange={(value) => { setPage(1); setCategory(value) }}
              options={categories.map((item) => ({ value: item, label: item }))}
              placeholder="All categories"
              value={category}
            />
            <StyledSelect
              aria-label="Filter by brand"
              onChange={(value) => { setPage(1); setBrand(value) }}
              options={brands.map((item) => ({ value: item, label: item }))}
              placeholder="All brands"
              value={brand}
            />
            <input aria-label="Minimum price" min="0" onChange={(event) => { setPage(1); setMinPrice(event.target.value) }} placeholder="Min price" type="number" value={minPrice} />
            <input aria-label="Maximum price" min="0" onChange={(event) => { setPage(1); setMaxPrice(event.target.value) }} placeholder="Max price" type="number" value={maxPrice} />
            <StyledSelect
              aria-label="Filter by rating"
              onChange={(value) => { setPage(1); setMinRating(value) }}
              options={[
                { value: '4', label: '4★ & up' },
                { value: '3', label: '3★ & up' },
                { value: '2', label: '2★ & up' },
                { value: '1', label: '1★ & up' },
              ]}
              placeholder="Any rating"
              value={minRating}
            />
            <StyledSelect
              aria-label="Sort products"
              onChange={(value) => { setPage(1); setSort(value) }}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'popularity', label: 'Popular' },
                { value: 'rating', label: 'Top rated' },
                { value: 'price', label: 'Price: low to high' },
                { value: '-price', label: 'Price: high to low' },
              ]}
              value={sort}
            />
            <label className="stock-filter"><input checked={inStock} onChange={(event) => { setPage(1); setInStock(event.target.checked) }} type="checkbox" /> In stock</label>
          </div>
        </div>

        {error && !authOpen && !cartOpen && !checkoutOpen && (
          <div className="store-alert" role="alert">{error}<button onClick={() => setError('')} type="button" aria-label="Dismiss error">×</button></div>
        )}
        {notice && <div className="store-notice" role="status">{notice}<button onClick={() => setNotice('')} type="button" aria-label="Dismiss message">×</button></div>}

        {loadingProducts && products.length === 0 ? (
          <div className="store-loader" aria-live="polite" aria-busy="true">
            <div className="store-loader-spinner" aria-hidden="true" />
            <div className="store-loader-copy">
              <strong>Finding the good things…</strong>
              <span>Curating fresh arrivals and matches</span>
            </div>
          </div>
        ) : products.length ? (
          <div className="product-results" aria-busy={loadingProducts}>
          {loadingProducts && <div className="product-refresh-indicator" role="status"><span aria-hidden="true" /> Updating the collection…</div>}
          <div className="product-grid">
            {products.map((product, index) => {
              const variantKey = selectedVariants[product._id] || {}
              const selectedOption = product.variants?.find((variant) => sameVariant(variant, variantKey))
              const price = product.price + (selectedOption?.additionalPrice || 0)
              const image = product.images?.[0]
              return (
                <article className="product-card" key={product._id}>
                  <a className={`product-image image-tone-${index % 4}`} href={`/product/${product._id}`} aria-label={`View ${product.title}`}>
                    <span className="image-initial">{product.title?.slice(0, 1) || 'N'}</span>
                    {image && <img {...responsiveImage(image, [320, 480, 720])} alt={product.title} decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} loading={index < 4 ? 'eager' : 'lazy'} sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" onError={(event) => { event.currentTarget.hidden = true }} />}
                    {product.stock < 1 && <span className="stock-label">SOLD OUT</span>}
                    {product.averageRating > 0 && <span className="rating-label">★ {product.averageRating.toFixed(1)}</span>}
                  </a>
                  <div className="product-meta"><span>{product.category}</span><span>{product.brand}</span></div>
                  <h3><a className="product-title-link" href={`/product/${product._id}`}>{product.title}</a></h3>
                  <p className="product-description">{product.description}</p>
                  <div className="product-card-bottom">
                    <strong>{money(price)}</strong>
                    {product.variants?.length > 0 && (
                      <StyledSelect
                        aria-label={`Choose an option for ${product.title}`}
                        className="product-variant-select"
                        onChange={(value) => {
                          const [size = '', color = ''] = value.split('|')
                          setSelectedVariants((current) => ({
                            ...current,
                            [product._id]: { ...(size ? { size } : {}), ...(color ? { color } : {}) },
                          }))
                        }}
                        options={product.variants.map((variant) => ({
                          value: `${variant.size || ''}|${variant.color || ''}`,
                          label: `${[variant.size, variant.color].filter(Boolean).join(' / ')}${variant.additionalPrice ? ` (+${money(variant.additionalPrice)})` : ''}`,
                        }))}
                        placeholder="Choose option"
                        value={variantKey.size || variantKey.color ? `${variantKey.size || ''}|${variantKey.color || ''}` : ''}
                      />
                    )}
                  </div>
                  <button
                    className="add-button"
                    disabled={product.stock < 1}
                    onClick={() => addToCart(product)}
                    type="button"
                  >
                    {product.stock < 1 ? 'Unavailable' : 'Add to bag'} <span aria-hidden="true">+</span>
                  </button>
                  <a className="product-detail-link" href={`/product/${product._id}`}>View details <span aria-hidden="true">↗</span></a>
                </article>
              )
            })}
          </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Nothing found just yet.</h3>
            <p>Try another search or browse all categories.</p>
            <button className="subtle-button" onClick={() => { setSearch(''); setCategory(''); setBrand(''); setMinPrice(''); setMaxPrice(''); setMinRating(''); setInStock(false); setPage(1) }} type="button">Clear filters</button>
          </div>
        )}
        {!loadingProducts && productTotal > 0 && <div className="pagination-bar">
          <span>Showing {Math.min(productTotal, (page - 1) * 12 + 1)}–{Math.min(productTotal, page * 12)} of {productTotal}</span>
          <div><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} type="button">← Previous</button><span>Page {page} of {productPages}</span><button disabled={page >= productPages} onClick={() => setPage((current) => current + 1)} type="button">Next →</button></div>
        </div>}
      </section>

    {recentProducts.length > 0 && <section className="recent-section">
  <div><p className="store-eyebrow">BACK FOR ANOTHER LOOK</p><h2>Recently viewed</h2></div>
  <div className="recent-marquee">
    <div className="recent-track">
      {Array.from({ length: Math.ceil(8 / recentProducts.length) * 2 }, () => recentProducts).flat().map((product, index) => (
        <a className="recent-card" href={`/product/${product._id}`} key={`${product._id}-${index}`}
           aria-hidden={index >= recentProducts.length} tabIndex={index >= recentProducts.length ? -1 : undefined}>
          <div>{product.images?.[0] && <img {...responsiveImage(product.images[0], [240, 320, 480])} alt={product.title} decoding="async" loading="lazy" sizes="165px" />}</div>
          <span>{product.title}</span><strong>{money(product.price)}</strong>
        </a>
      ))}
    </div>
  </div>
</section>}

      <section className="store-note" id="footer">
        <p className="store-eyebrow">THE NOSHIN PROMISE</p>
        <h2>Less, but lovely.</h2>
        <p>Considered pieces, honest quality, and a little joy in the details.</p>
      </section>
      <footer className="store-footer"><a className="store-logo" href="/">noshin<span>.</span></a><span>Made for the moments in between.</span><span>© 2026 NOSHIN</span></footer>

      {(authOpen || cartOpen || checkoutOpen || orderConfirmation) && (
        <div className="overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            setAuthOpen(false)
            setCartOpen(false)
            setCheckoutOpen(false)
            setOrderConfirmation(null)
          }
        }}>
          {authOpen && (
            <section className="dialog auth-dialog" aria-labelledby="auth-title" role="dialog" aria-modal="true">
              <button className="dialog-close" onClick={() => setAuthOpen(false)} type="button" aria-label="Close sign in">×</button>
              <p className="store-eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'JOIN NOSHIN'}</p>
              <h2 id="auth-title">{mode === 'login' ? 'Sign in' : 'Create your account'}</h2>
              {error && <p className="dialog-error" role="alert">{error}</p>}
              <a className="google-signin" href="/api/auth/google"><GoogleMark />Continue with Google <span>↗</span></a>
              <div className="form-divider"><span>OR WITH EMAIL</span></div>
              <form className="dialog-form" onSubmit={handleAuthSubmit}>
                {mode === 'register' && <label>Full name<input autoComplete="name" onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required value={authForm.name} /></label>}
                <label>Email address<input autoComplete="email" onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required type="email" value={authForm.email} /></label>
                <label>Password<input autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required type="password" value={authForm.password} /></label>
                <button className="primary-button" disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} <span>→</span></button>
              </form>
              <p className="auth-switch">{mode === 'login' ? 'New to Noshin?' : 'Already have an account?'} <button onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }} type="button">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
            </section>
          )}

          {cartOpen && (
            <section className="dialog cart-dialog" aria-labelledby="cart-title" role="dialog" aria-modal="true">
              <button className="dialog-close" onClick={() => setCartOpen(false)} type="button" aria-label="Close bag">×</button>
              <p className="store-eyebrow">YOUR EVERYDAY EDIT</p>
              <h2 id="cart-title">Your bag <span>({cartCount})</span></h2>
              {error && <p className="dialog-error" role="alert">{error}</p>}
              {!cart.length ? <div className="empty-bag"><p>Your bag is waiting for something lovely.</p><button className="primary-button" onClick={() => setCartOpen(false)} type="button">Explore the collection <span>→</span></button></div> : (
                <>
                  <div className="cart-items">
                    {cart.map((item, index) => {
                      const product = productForItem(item)
                      return (
                        <article className="cart-item" key={item._id || `${getProductId(item)}-${index}`}>
                          <div className="cart-thumb">
                            <span>{product?.title?.slice(0, 1) || 'N'}</span>
                            {product?.images?.[0] && <img src={product.images[0]} alt="" onError={(event) => { event.currentTarget.hidden = true }} />}
                          </div>
                          <div className="cart-item-info">
                            <strong>{product?.title || 'Selected product'}</strong>
                            <span>{[item.selectedVariant?.size, item.selectedVariant?.color].filter(Boolean).join(' / ')}</span>
                            <span>{money(item.price)}</span>
                            <div className="quantity-control">
                              <button aria-label="Decrease quantity" onClick={() => changeQuantity(item, item.quantity - 1)} type="button">−</button>
                              <span>{item.quantity}</span>
                              <button aria-label="Increase quantity" onClick={() => changeQuantity(item, item.quantity + 1)} type="button">+</button>
                            </div>
                          </div>
                          <button className="remove-item" onClick={() => removeFromCart(item)} type="button">Remove</button>
                        </article>
                      )
                    })}
                  </div>
                  <div className="cart-summary"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
                  <p className="shipping-note">Shipping is PKR 250 and calculated at checkout.</p>
                  {user ? (
                    <button className="primary-button full-button" onClick={() => { setCartOpen(false); setCheckoutOpen(true); setError('') }} type="button">Continue to checkout <span>→</span></button>
                  ) : (
                    <div className="guest-checkout-actions">
                      <button className="primary-button full-button" onClick={() => { setCartOpen(false); setCheckoutOpen(true); setError('') }} type="button">Checkout as guest <span>→</span></button>
                      <button className="text-action" onClick={() => { setCartOpen(false); setAuthOpen(true); setError('') }} type="button">Sign in to your account</button>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {checkoutOpen && (
            <section className="dialog checkout-dialog" aria-labelledby="checkout-title" role="dialog" aria-modal="true">
              <button className="dialog-close" onClick={() => setCheckoutOpen(false)} type="button" aria-label="Close checkout">×</button>
              <p className="store-eyebrow">ALMOST YOURS</p>
              <h2 id="checkout-title">Delivery details</h2>
              <p className="checkout-total">Your order total <strong>{money(subtotal + SHIPPING_FEE)}</strong></p>
              {error && <p className="dialog-error" role="alert">{error}</p>}
              <form className="dialog-form checkout-form" onSubmit={handleCheckout}>
                {!user && <>
                  <label>Full name<input autoComplete="name" onChange={(event) => setGuestDetails({ ...guestDetails, name: event.target.value })} required value={guestDetails.name} /></label>
                  <label>Email address<input autoComplete="email" onChange={(event) => setGuestDetails({ ...guestDetails, email: event.target.value })} required type="email" value={guestDetails.email} /></label>
                </>}
                <label>Street address<input autoComplete="street-address" onChange={(event) => setShippingAddress({ ...shippingAddress, street: event.target.value })} required value={shippingAddress.street} /></label>
                <div className="form-row">
                  <label>City<input autoComplete="address-level2" onChange={(event) => setShippingAddress({ ...shippingAddress, city: event.target.value })} required value={shippingAddress.city} /></label>
                  <label>Province / state<input autoComplete="address-level1" onChange={(event) => setShippingAddress({ ...shippingAddress, state: event.target.value })} required value={shippingAddress.state} /></label>
                </div>
                <div className="form-row">
                  <label>Postal code<input autoComplete="postal-code" onChange={(event) => setShippingAddress({ ...shippingAddress, postalCode: event.target.value })} required value={shippingAddress.postalCode} /></label>
                  <label>Country<input autoComplete="country-name" onChange={(event) => setShippingAddress({ ...shippingAddress, country: event.target.value })} required value={shippingAddress.country} /></label>
                </div>
                <p className="shipping-note">Payment is currently collected offline; your order will be created as payment pending.</p>
                <button className="primary-button full-button" disabled={busy} type="submit">{busy ? 'Placing order…' : 'Place order'} <span>→</span></button>
              </form>
            </section>
          )}

          {orderConfirmation && (
            <section className="dialog confirmation-dialog" aria-labelledby="confirmation-title" role="dialog" aria-modal="true">
              <button className="dialog-close" onClick={() => setOrderConfirmation(null)} type="button" aria-label="Close order confirmation">×</button>
              <div className="confirmation-check">✓</div>
              <p className="store-eyebrow">THANK YOU FOR CHOOSING NOSHIN</p>
              <h2 id="confirmation-title">Your order is in.</h2>
              <p>Order <strong>#{String(orderConfirmation._id || '').slice(-8).toUpperCase()}</strong> has been placed. We’ll prepare your pieces with care.</p>
              <div className="confirmation-total"><span>Total</span><strong>{money(orderConfirmation.totalAmount)}</strong></div>
              <button className="primary-button full-button" onClick={() => setOrderConfirmation(null)} type="button">Continue shopping <span>→</span></button>
            </section>
          )}
        </div>
      )}
    </main>
  )
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" transform="translate(0 4)" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.74 7.18l7.73 6C44.43 38.03 47 31.91 47 24.55h-.02Z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" transform="translate(1 0)" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" transform="translate(0 -1)" />
    </svg>
  )
}

export default App
