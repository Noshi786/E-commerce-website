import { useCallback, useEffect, useState } from 'react'

const readUser = () => {
  try {
    const user = JSON.parse(sessionStorage.getItem('ecommerce-user') || 'null')
    return user && typeof user === 'object' ? user : null
  } catch {
    return null
  }
}

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

async function request(path, options = {}) {
  const token = sessionStorage.getItem('ecommerce-token')
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  return data
}

function AdminPage() {
  const [user] = useState(readUser)
  const [activeSection, setActiveSection] = useState('overview')
  const [today] = useState(() =>
    new Intl.DateTimeFormat('en-PK', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date()),
  )
  const [products, setProducts] = useState([])
  const [users, setUsers] = useState([])
  const [categories, setCategories] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loading, setLoading] = useState(() =>
    Boolean(sessionStorage.getItem('ecommerce-token') && readUser()?.role === 'admin'),
  )
  const [busy, setBusy] = useState('')
  const [search, setSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' })
  const [editingCategoryId, setEditingCategoryId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadDashboard = useCallback(async (customerSearch = '') => {
    try {
      const userQuery = new URLSearchParams({ limit: '100' })
      if (customerSearch.trim()) userQuery.set('search', customerSearch.trim())
      const [productData, userData, categoryData, stockData] = await Promise.all([
        request('/api/products?limit=100'),
        request(`/api/admin/users?${userQuery}`),
        request('/api/categories'),
        request('/api/admin/dashboard/low-stock?threshold=5'),
      ])
      setError('')
      setProducts(productData.products || [])
      setTotalProducts(productData.total || 0)
      setUsers(userData.users || [])
      setTotalUsers(userData.total || 0)
      setCategories(Array.isArray(categoryData) ? categoryData : [])
      setLowStock(stockData.products || [])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin' || !sessionStorage.getItem('ecommerce-token')) return

    let active = true
    Promise.resolve().then(() => {
      if (active) loadDashboard()
    })
    return () => {
      active = false
    }
  }, [loadDashboard, user])

  const handleUserSearch = (event) => {
    event.preventDefault()
    loadDashboard(userSearch)
  }

  const handleCategorySubmit = async (event) => {
    event.preventDefault()
    setBusy('category')
    setError('')
    setNotice('')
    try {
      await request(editingCategoryId ? `/api/categories/${editingCategoryId}` : '/api/categories', {
        method: editingCategoryId ? 'PATCH' : 'POST',
        body: JSON.stringify(categoryForm),
      })
      const wasEditing = Boolean(editingCategoryId)
      setCategoryForm({ name: '', description: '' })
      setEditingCategoryId('')
      setNotice(wasEditing ? 'Category updated.' : 'Category created.')
      await loadDashboard(userSearch)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const handleCategoryDelete = async (category) => {
    if (!window.confirm(`Delete category "${category.name}"?`)) return
    setBusy(category._id)
    setError('')
    setNotice('')
    try {
      await request(`/api/categories/${category._id}`, { method: 'DELETE' })
      setNotice('Category deleted.')
      await loadDashboard(userSearch)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  const toggleUserStatus = async (customer) => {
    setBusy(customer._id)
    setError('')
    setNotice('')
    try {
      await request(`/api/admin/users/${customer._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: customer.isActive === false }),
      })
      setNotice(`Account ${customer.isActive === false ? 'reactivated' : 'deactivated'}.`)
      await loadDashboard(userSearch)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy('')
    }
  }

  if (!sessionStorage.getItem('ecommerce-token') || !user) {
    return <AccessMessage title="Sign in to continue." message="The admin dashboard requires an administrator account." />
  }

  if (user.role !== 'admin') {
    return <AccessMessage title="Admin access only." message="This account does not have administrator permissions." />
  }

  const visibleProducts = products.filter((product) =>
    `${product.title} ${product.category} ${product.brand}`.toLowerCase().includes(search.toLowerCase()),
  )
  const categoryCounts = categories.map((category) => ({
    ...category,
    productCount: products.filter((product) => product.category === category.name).length,
  }))
  const activeCustomers = users.filter((customer) => customer.isActive !== false).length
  const statCards = [
    { label: 'Total products', value: totalProducts, note: 'Across your catalog', icon: 'box', color: 'bg-violet-100 text-violet-700', trend: 'Inventory' },
    { label: 'Customers', value: totalUsers, note: `${activeCustomers} active accounts`, icon: 'users', color: 'bg-sky-100 text-sky-700', trend: 'Community' },
    { label: 'Categories', value: categories.length, note: 'Product collections', icon: 'grid', color: 'bg-amber-100 text-amber-700', trend: 'Organization' },
    { label: 'Stock alerts', value: lowStock.length, note: '5 units or fewer', icon: 'alert', color: 'bg-rose-100 text-rose-700', trend: lowStock.length ? 'Needs attention' : 'All looking good' },
  ]
  const sectionDetails = {
    overview: ['Store overview', 'A calm snapshot of what needs your attention.'],
    inventory: ['Inventory', 'Review product availability and stock levels.'],
    customers: ['Customers', 'Manage the people and accounts in your store.'],
    categories: ['Categories', 'Organize the collections in your catalog.'],
  }
  return (
    <main className="min-h-screen bg-[#fffaf8] text-[#2d3934]">
      <div className="grid min-h-screen lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="flex flex-col bg-[#223d36] px-4 py-4 text-white sm:px-5 lg:sticky lg:top-0 lg:h-screen lg:px-5 lg:py-6">
          <a className="mb-4 inline-flex w-fit items-center gap-3 text-white no-underline lg:mb-10" href="/">
            <span className="grid size-10 place-items-center rounded-xl bg-[#f5dfe3] font-serif text-2xl font-bold text-[#223d36]">n.</span>
            <span className="text-lg font-semibold tracking-[0.18em]">NOSHIN<span className="text-[#f7d9de]">.</span></span>
          </a>
          <p className="mb-3 hidden px-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 lg:block">WORKSPACE</p>
          <nav className="mb-5 grid gap-1" aria-label="Catalog and orders">
            <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-300 no-underline transition hover:bg-white/10 hover:text-white lg:text-sm" href="/admin/products"><Icon name="box" /> Manage products <span className="ml-auto text-emerald-200">↗</span></a>
            <a className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium text-slate-300 no-underline transition hover:bg-white/10 hover:text-white lg:text-sm" href="/admin/orders"><Icon name="tag" /> Manage orders <span className="ml-auto text-emerald-200">↗</span></a>
          </nav>
          <nav className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible lg:pb-0" aria-label="Admin navigation">
            <button className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition lg:py-3 lg:text-sm ${activeSection === 'overview' ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} onClick={() => setActiveSection('overview')} type="button">
              <Icon name="grid" /> Overview
            </button>
            <button className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition lg:py-3 lg:text-sm ${activeSection === 'inventory' ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} onClick={() => setActiveSection('inventory')} type="button">
              <Icon name="box" /> Inventory
            </button>
            <button className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition lg:py-3 lg:text-sm ${activeSection === 'customers' ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} onClick={() => setActiveSection('customers')} type="button">
              <Icon name="users" /> Customers
            </button>
            <button className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition lg:py-3 lg:text-sm ${activeSection === 'categories' ? 'bg-white/10 text-white ring-1 ring-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`} onClick={() => setActiveSection('categories')} type="button">
              <Icon name="tag" /> Categories
            </button>
          </nav>

          <div className="mt-auto hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 lg:block">
            <div className="mb-3 grid size-9 place-items-center rounded-full bg-emerald-200 text-xs font-bold text-emerald-950">
              {user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold capitalize text-emerald-200">
              <span className="size-1.5 rounded-full bg-emerald-300" /> {user.role} account
            </span>
          </div>
          <a className="mt-4 hidden items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 no-underline transition hover:bg-white/10 hover:text-white lg:flex" href="/">
            <Icon name="external" /> Return to store
          </a>
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Noshin / Admin</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{sectionDetails[activeSection][0]}</p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <a className="hidden rounded-lg px-3 py-2 text-xs font-medium text-slate-500 no-underline transition hover:bg-slate-100 sm:inline-flex" href="/orders">My orders</a>
              <a className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 no-underline transition hover:border-emerald-700 hover:text-emerald-800" href="/">
                <Icon name="external" /> <span className="hidden sm:inline">View store</span>
              </a>
              <button className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:opacity-50" disabled={loading} onClick={() => loadDashboard(userSearch)} type="button" aria-label="Refresh dashboard">
                <Icon name="refresh" className={loading ? 'animate-spin' : ''} />
              </button>
              <div className="grid size-9 place-items-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-900">
                {user.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            </div>
          </header>

          <section className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="mb-8 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">{activeSection === 'overview' ? today : 'Store management'}</p>
                <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight text-slate-900 sm:text-5xl">{activeSection === 'overview' ? `Good afternoon, ${user.name.split(' ')[0]}` : sectionDetails[activeSection][0]} <span className="text-emerald-700" aria-hidden="true">{activeSection === 'overview' ? '✳' : ''}</span></h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">{activeSection === 'overview' ? 'Here’s a clear snapshot of your store. Take a look at the things that may need attention.' : sectionDetails[activeSection][1]}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl bg-[#2d4d45] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1d3933] disabled:opacity-60" disabled={loading} onClick={() => loadDashboard(userSearch)} type="button">
                  <Icon name="refresh" className={loading ? 'animate-spin' : ''} /> {loading ? 'Updating…' : 'Refresh data'}
                </button>
              </div>
            </div>

            {error && <div className="mb-5 flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert"><Icon name="alert" />{error}</div>}
            {notice && <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status"><Icon name="check" />{notice}</div>}

            {activeSection === 'overview' && <div className="mb-8 grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              {statCards.map((stat) => (
                <article className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60" key={stat.label}>
                  <div className="flex items-start justify-between">
                    <div className={`grid size-11 place-items-center rounded-xl ${stat.color}`}><Icon name={stat.icon} /></div>
                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-500">{stat.trend}</span>
                  </div>
                  <p className="mt-5 text-xs font-medium text-slate-500">{stat.label}</p>
                  <div className="mt-1 flex items-end justify-between">
                    <strong className="font-serif text-4xl font-medium tracking-tight text-slate-900">{loading ? '—' : stat.value}</strong>
                    <span className="pb-1 text-[11px] text-slate-400">{stat.note}</span>
                  </div>
                </article>
              ))}
            </div>}

            {activeSection === 'overview' && <div className="mb-5 grid gap-5 2xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]">
              <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-600">Needs attention</p>
                    <h2 className="mt-1 text-base font-semibold text-slate-900">Low-stock inventory</h2>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1.5 text-[10px] font-semibold text-rose-700">{lowStock.length} alerts</span>
                </div>
                {lowStock.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-slate-50/80 text-[9px] uppercase tracking-[0.12em] text-slate-400">
                        <tr><th className="px-6 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Stock level</th><th className="px-6 py-3 text-right font-semibold">Price</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lowStock.slice(0, 6).map((product) => (
                          <tr className="transition hover:bg-slate-50/70" key={product._id}>
                            <td className="px-6 py-4"><p className="text-xs font-semibold text-slate-800">{product.title}</p><p className="mt-1 text-[10px] text-slate-400">{product.brand}</p></td>
                            <td className="px-4 py-4 text-xs text-slate-500">{product.category}</td>
                            <td className="px-4 py-4"><div className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg text-[10px] font-bold ${product.stock < 3 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{product.stock}</span><div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className={`block h-full rounded-full ${product.stock < 3 ? 'bg-rose-500' : 'bg-amber-500'}`} style={{ width: `${Math.min(100, Math.max(8, product.stock / 5 * 100))}%` }} /></div></div></td>
                            <td className="px-6 py-4 text-right text-xs font-semibold text-slate-700">{money(product.price)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {lowStock.length > 6 && <p className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-500">And {lowStock.length - 6} more low-stock products</p>}
                  </div>
                ) : <div className="grid min-h-44 place-items-center px-5 text-center"><div><span className="mx-auto grid size-11 place-items-center rounded-full bg-emerald-50 text-emerald-700"><Icon name="check" /></span><p className="mt-3 text-sm font-semibold text-slate-700">Inventory looks healthy</p><p className="mt-1 text-xs text-slate-400">No products are below the stock threshold.</p></div></div>}
              </section>

              <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-600">Catalog mix</p><h2 className="mt-1 text-base font-semibold text-slate-900">Products by category</h2></div>
                  <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><Icon name="grid" /></span>
                </div>
                {categoryCounts.length ? (
                  <div className="mt-6 space-y-5">
                    {categoryCounts.slice(0, 5).map((category, index) => (
                      <div key={category._id}>
                        <div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-slate-600">{category.name}</span><span className="text-slate-400">{category.productCount} products</span></div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${['bg-violet-500', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-500', 'bg-rose-500'][index]}`} style={{ width: `${totalProducts ? Math.max(5, category.productCount / totalProducts * 100) : 0}%` }} /></div>
                      </div>
                    ))}
                  </div>
                ) : <p className="mt-8 text-center text-xs text-slate-400">Add a category to see your catalog mix.</p>}
                <button className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 hover:text-emerald-600" onClick={() => setActiveSection('categories')} type="button">Manage categories <span aria-hidden="true">→</span></button>
              </section>
            </div>}

            {activeSection === 'customers' && <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-700">Your community</p><h2 className="mt-1 text-base font-semibold text-slate-900">Customer accounts <span className="ml-1 text-xs font-normal text-slate-400">({totalUsers})</span></h2></div>
                <form className="flex gap-2" onSubmit={handleUserSearch}>
                  <input className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white sm:w-56" aria-label="Search customers" onChange={(event) => setUserSearch(event.target.value)} placeholder="Search name or email" value={userSearch} />
                  <button className="rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white transition hover:bg-slate-700" type="submit">Search</button>
                </form>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[650px] text-left">
                  <thead className="bg-slate-50/80 text-[9px] uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-6 py-3 font-semibold">Customer</th><th className="px-4 py-3 font-semibold">Role</th><th className="px-4 py-3 font-semibold">Account status</th><th className="px-6 py-3 text-right font-semibold">Manage</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map((customer) => (
                      <tr className="transition hover:bg-slate-50/70" key={customer._id}>
                        <td className="px-6 py-3.5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-sky-50 text-[10px] font-bold uppercase text-sky-700">{customer.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><div><p className="text-xs font-semibold text-slate-800">{customer.name}</p><p className="mt-1 text-[10px] text-slate-400">{customer.email}</p></div></div></td>
                        <td className="px-4 py-3.5 text-xs capitalize text-slate-500">{customer.role}</td>
                        <td className="px-4 py-3.5"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${customer.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}><span className={`size-1.5 rounded-full ${customer.isActive === false ? 'bg-slate-400' : 'bg-emerald-500'}`} />{customer.isActive === false ? 'Inactive' : 'Active'}</span></td>
                        <td className="px-6 py-3.5 text-right">{customer.email !== user.email && <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" disabled={busy === customer._id} onClick={() => toggleUserStatus(customer)} type="button">{busy === customer._id ? 'Saving…' : customer.isActive === false ? 'Reactivate' : 'Deactivate'}</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!users.length && <p className="px-6 py-12 text-center text-xs text-slate-400">No matching customers.</p>}
              </div>
            </section>}

            {activeSection === 'categories' && <section className="mb-5 max-w-3xl rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_10px_rgba(15,23,42,0.025)] sm:p-6">
                <div className="mb-5 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">Organization</p><h2 className="mt-1 text-base font-semibold text-slate-900">Categories</h2></div><span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon name="tag" /></span></div>
                <form className="grid gap-3" onSubmit={handleCategorySubmit}>
                  <input className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white" aria-label="Category name" onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="Category name" required value={categoryForm.name} />
                  <input className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white" aria-label="Category description" onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} placeholder="Short description (optional)" value={categoryForm.description} />
                  <div className="flex gap-2"><button className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#1d382b] text-xs font-semibold text-white transition hover:bg-[#294a39] disabled:opacity-60" disabled={busy === 'category'} type="submit"><span className="text-base">{editingCategoryId ? '✓' : '+'}</span>{busy === 'category' ? 'Saving category…' : editingCategoryId ? 'Save category' : 'Add category'}</button>{editingCategoryId && <button className="rounded-lg border border-slate-200 px-3 text-xs" onClick={() => { setCategoryForm({ name: '', description: '' }); setEditingCategoryId('') }} type="button">Cancel</button>}</div>
                </form>
                <div className="mt-5 divide-y divide-slate-100">
                  {categoryCounts.map((category, index) => (
                    <div className="flex items-center justify-between gap-3 py-3" key={category._id}>
                      <div className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold ${['bg-violet-50 text-violet-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700', 'bg-sky-50 text-sky-700'][index % 4]}`}>{category.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-700">{category.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{category.productCount} products</p></div></div>
                      <div className="flex gap-1"><button className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-emerald-800 transition hover:bg-emerald-50" onClick={() => { setEditingCategoryId(category._id); setCategoryForm({ name: category.name, description: category.description || '' }); window.scrollTo({ top: 0, behavior: 'smooth' }) }} type="button">Edit</button><button className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium text-slate-400 transition hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50" disabled={busy === category._id} onClick={() => handleCategoryDelete(category)} type="button">{busy === category._id ? 'Removing…' : 'Delete'}</button></div>
                    </div>
                  ))}
                  {!categories.length && <p className="py-6 text-center text-xs text-slate-400">No categories yet. Add your first one above.</p>}
                </div>
            </section>}

            {activeSection === 'inventory' && <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.025)]">
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
                  <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">Catalog</p><h2 className="mt-1 text-base font-semibold text-slate-900">All products <span className="ml-1 text-xs font-normal text-slate-400">({totalProducts})</span></h2></div>
                  <div className="flex flex-wrap gap-2"><input className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white sm:w-52" aria-label="Filter product list" onChange={(event) => setSearch(event.target.value)} placeholder="Filter products" value={search} /><a className="inline-flex h-9 items-center rounded-lg bg-[#1d382b] px-3 text-xs font-semibold text-white no-underline transition hover:bg-[#294a39]" href="/admin/products">Add / edit products ↗</a></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[580px] text-left">
                    <thead className="bg-slate-50/80 text-[9px] uppercase tracking-[0.12em] text-slate-400"><tr><th className="px-6 py-3 font-semibold">Product</th><th className="px-4 py-3 font-semibold">Category</th><th className="px-4 py-3 font-semibold">Stock</th><th className="px-6 py-3 text-right font-semibold">Price</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleProducts.slice(0, 8).map((product) => (
                        <tr className="transition hover:bg-slate-50/70" key={product._id}>
                          <td className="px-6 py-3.5"><p className="text-xs font-semibold text-slate-800">{product.title}</p><p className="mt-1 text-[10px] text-slate-400">{product.brand}</p></td>
                          <td className="px-4 py-3.5 text-xs text-slate-500">{product.category}</td>
                          <td className="px-4 py-3.5"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.stock <= 5 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{product.stock} in stock</span></td>
                          <td className="px-6 py-3.5 text-right text-xs font-semibold text-slate-700">{money(product.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visibleProducts.length && <p className="px-6 py-12 text-center text-xs text-slate-400">No matching products.</p>}
                  {visibleProducts.length > 8 && <p className="border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-500">Showing 8 of {visibleProducts.length} products</p>}
                </div>
            </section>}
            <footer className="flex flex-col justify-between gap-2 px-1 py-3 text-[10px] text-slate-400 sm:flex-row"><span>© 2026 Noshin Store Management</span><span>Thoughtfully managing the everyday.</span></footer>
          </section>
        </div>
      </div>
    </main>
  )
}

function AccessMessage({ title, message }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7fb] px-5 text-slate-800">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <a className="mx-auto mb-7 grid size-14 place-items-center rounded-2xl bg-[#172820] font-serif text-3xl font-bold text-emerald-200 no-underline" href="/">n.</a>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-800">Noshin store management</p>
        <h1 className="mt-3 font-serif text-3xl font-medium text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{message}</p>
        <a className="mt-7 inline-flex h-11 items-center justify-center gap-3 rounded-xl bg-[#1d382b] px-5 text-xs font-semibold text-white no-underline transition hover:bg-[#294a39]" href="/">Return to store <span>→</span></a>
      </section>
    </main>
  )
}

function Icon({ name, className = '' }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    box: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 9 5 9-5" /><path d="M3 8v9l9 5 9-5V8M12 13v9" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    tag: <><path d="M20.59 13.41 11 3.83A2.8 2.8 0 0 0 9 3H4a1 1 0 0 0-1 1v5a2.8 2.8 0 0 0 .83 2l9.58 9.59a2 2 0 0 0 2.83 0l4.35-4.35a2 2 0 0 0 0-2.83Z" /><circle cx="7.5" cy="7.5" r=".75" /></>,
    alert: <><path d="M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4m0 4h.01" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.64 9A7 7 0 0 1 17.5 6.5L20 12M4 12l2.5 5.5A7 7 0 0 0 18.36 15" /></>,
    external: <><path d="M14 3h7v7m0-7-9 9" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
  }

  return <svg className={`size-4 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export default AdminPage
