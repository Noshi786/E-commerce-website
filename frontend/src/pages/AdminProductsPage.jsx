import { useCallback, useEffect, useState } from 'react'
import StyledSelect from '../components/StyledSelect.jsx'

const EMPTY_PRODUCT = {
  title: '',
  description: '',
  price: '',
  category: '',
  brand: '',
  stock: '',
  images: '',
  variants: '[]',
}

const readUser = () => {
  try {
    return JSON.parse(sessionStorage.getItem('ecommerce-user') || 'null')
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

function AdminProductsPage() {
  const user = readUser()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [editingId, setEditingId] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (query = '', pageNumber = 1) => {
    try {
      const params = new URLSearchParams({ limit: '20', page: String(pageNumber) })
      if (query.trim()) params.set('search', query.trim())
      const [productData, categoryData] = await Promise.all([
        request(`/api/products?${params}`),
        request('/api/categories'),
      ])
      setProducts(productData.products || [])
      setPages(productData.pages || 1)
      setTotal(productData.total || 0)
      setCategories(Array.isArray(categoryData) ? categoryData : [])
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'admin' || !sessionStorage.getItem('ecommerce-token')) return
    let active = true
    const timer = window.setTimeout(() => {
      if (active) load(search, page)
    }, search ? 250 : 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [load, search, page, user?.role])

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (!form.category) throw new Error('Choose a category.')

      let variants
      try {
        variants = JSON.parse(form.variants || '[]')
      } catch {
        throw new Error('Variants must be valid JSON, for example [{"size":"M","color":"Green","additionalPrice":0}]')
      }
      if (!Array.isArray(variants)) throw new Error('Variants must be a JSON array.')
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        category: form.category.trim(),
        brand: form.brand.trim(),
        stock: Number(form.stock),
        images: form.images.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        variants,
      }
      await request(editingId ? `/api/products/${editingId}` : '/api/products', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      })
      setNotice(editingId ? 'Product updated.' : 'Product created.')
      setEditingId('')
      setForm(EMPTY_PRODUCT)
      setPage(1)
      await load(search, 1)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setBusy(false)
    }
  }

  const edit = (product) => {
    setEditingId(product._id)
    setForm({
      title: product.title || '',
      description: product.description || '',
      price: String(product.price ?? ''),
      category: product.category || '',
      brand: product.brand || '',
      stock: String(product.stock ?? ''),
      images: (product.images || []).join('\n'),
      variants: JSON.stringify(product.variants || [], null, 2),
    })
    setError('')
    setNotice('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (product) => {
    if (!window.confirm(`Delete "${product.title}" from the catalog?`)) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/products/${product._id}`, { method: 'DELETE' })
      setNotice('Product deleted.')
      await load(search, page)
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  if (!sessionStorage.getItem('ecommerce-token') || user?.role !== 'admin') {
    return <AccessMessage />
  }

  return (
    <main className="min-h-screen bg-[#fffaf8] px-5 py-7 text-[#2d3934] sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <a className="font-serif text-2xl font-semibold text-[#193b30] no-underline" href="/admin">← Noshin admin</a>
        <nav className="flex gap-3 text-xs"><a className="text-slate-600 no-underline" href="/admin/orders">Orders</a><a className="text-slate-600 no-underline" href="/">View store</a></nav>
      </header>
      <div className="mx-auto mt-8 grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.75fr)]">
        <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Catalog management</p>
          <h1 className="mt-2 font-serif text-3xl text-slate-900">{editingId ? 'Edit product' : 'Add a product'}</h1>
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800" role="alert">{error}</p>}
          {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800" role="status">{notice}</p>}
          <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
            <label className="grid gap-1.5 text-xs font-medium">Product name<input className="h-10 rounded-lg border border-slate-200 px-3" onChange={(event) => setForm({ ...form, title: event.target.value })} required value={form.title} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Brand<input className="h-10 rounded-lg border border-slate-200 px-3" onChange={(event) => setForm({ ...form, brand: event.target.value })} required value={form.brand} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Price (PKR)<input className="h-10 rounded-lg border border-slate-200 px-3" min="0" onChange={(event) => setForm({ ...form, price: event.target.value })} required type="number" value={form.price} /></label>
            <label className="grid gap-1.5 text-xs font-medium">Stock quantity<input className="h-10 rounded-lg border border-slate-200 px-3" min="0" onChange={(event) => setForm({ ...form, stock: event.target.value })} required type="number" value={form.stock} /></label>
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">Category
              <StyledSelect aria-label="Choose category" onChange={(value) => setForm({ ...form, category: value })} options={categories.map((category) => ({ value: category.name, label: category.name }))} placeholder="Choose category" required value={form.category} />
            </label>
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">Description<textarea className="min-h-24 rounded-lg border border-slate-200 p-3" onChange={(event) => setForm({ ...form, description: event.target.value })} required value={form.description} /></label>
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">Image URLs <span className="font-normal text-slate-400">One full URL per line</span><textarea className="min-h-20 rounded-lg border border-slate-200 p-3 font-normal" onChange={(event) => setForm({ ...form, images: event.target.value })} placeholder="https://…" required value={form.images} /></label>
            <label className="grid gap-1.5 text-xs font-medium sm:col-span-2">Variants (JSON) <span className="font-normal text-slate-400">Optional size, color and extra price list</span><textarea className="min-h-28 rounded-lg border border-slate-200 p-3 font-mono text-[11px] font-normal" onChange={(event) => setForm({ ...form, variants: event.target.value })} value={form.variants} /></label>
            <div className="flex gap-2 sm:col-span-2">
              <button className="rounded-xl bg-[#2d4d45] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#1d3933] disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}</button>
              {editingId && <button className="rounded-lg border border-slate-200 px-4 py-3 text-xs" onClick={() => { setEditingId(''); setForm(EMPTY_PRODUCT) }} type="button">Cancel</button>}
            </div>
          </form>
        </section>
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-violet-700">In your store</p><h2 className="mt-1 text-lg font-semibold">Products <span className="text-xs font-normal text-slate-400">({total})</span></h2></div>
            <input className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs sm:w-48" aria-label="Search products" onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Search catalog" value={search} />
          </div>
          {loading ? <p className="page-loading p-8 text-center text-sm text-slate-500">Loading products…</p> : products.length ? <div className="max-h-[75vh] divide-y divide-slate-100 overflow-y-auto">
            {products.map((product) => <article className="flex gap-3 p-4" key={product._id}>
              <div className="h-16 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">{product.images?.[0] && <img className="h-full w-full object-cover" src={product.images[0]} alt="" />}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{product.title}</p><p className="mt-1 truncate text-[10px] text-slate-500">{product.brand} · {product.category}</p><p className="mt-1 text-xs font-medium">{money(product.price)} <span className="text-slate-400">· {product.stock} in stock</span></p></div>
              <div className="flex shrink-0 flex-col gap-1"><button className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-medium" onClick={() => edit(product)} type="button">Edit</button><button className="rounded-md px-2.5 py-1.5 text-[10px] text-rose-700 hover:bg-rose-50 disabled:opacity-50" disabled={busy} onClick={() => remove(product)} type="button">Delete</button></div>
            </article>)}
          </div> : <p className="p-8 text-center text-sm text-slate-500">No products match this search.</p>}
          <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500"><span>Page {page} of {pages}</span><div className="flex gap-2"><button className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><button className="rounded-md border border-slate-200 px-3 py-1.5 disabled:opacity-40" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div></footer>
        </section>
      </div>
    </main>
  )
}

function AccessMessage() {
  return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><section className="rounded-2xl bg-white p-8 text-center shadow"><h1 className="font-serif text-3xl">Admin access only</h1><p className="mt-2 text-sm text-slate-500">Sign in with an administrator account to manage the catalog.</p><a className="mt-5 inline-block text-sm text-emerald-800" href="/">Return to store</a></section></main>
}

export default AdminProductsPage
