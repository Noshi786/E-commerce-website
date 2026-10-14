import { useEffect, useState } from 'react'

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

function WishlistPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(Boolean(sessionStorage.getItem('ecommerce-token')))
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [notice, setNotice] = useState('')
  const token = sessionStorage.getItem('ecommerce-token')

  useEffect(() => {
    if (!token) return
    let active = true
    fetch('/api/wishlist', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => [])
        if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
        if (active) setProducts(Array.isArray(data) ? data : [])
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const remove = async (productId) => {
    setBusyId(productId)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/wishlist/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
      setProducts(Array.isArray(data) ? data : [])
      setNotice('Removed from your wishlist.')
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf8] text-[#2d3934]">
      <header className="flex items-center justify-between border-b border-[#f1e5df] bg-[#fffdfd]/90 px-5 py-4 backdrop-blur sm:px-10">
        <a className="font-serif text-2xl font-semibold tracking-tight text-[#233d36] no-underline" href="/">noshin<span className="text-[#b96e7d]">.</span></a>
        <nav className="flex gap-4 text-xs sm:gap-6"><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/">Shop</a><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/orders">My orders</a><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/addresses">Addresses</a></nav>
      </header>
      <section className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b96e7d]">Saved with love</p>
        <h1 className="mt-2 font-serif text-4xl text-[#233d36]">Your wishlist</h1>
        <p className="mt-2 text-sm text-[#6c7571]">The good things you’re keeping an eye on.</p>
        {error && <p className="mt-5 rounded-2xl border border-[#f0d8d6] bg-[#fff4f4] p-4 text-sm text-[#8c4b4e]" role="alert">{error}</p>}
        {notice && <p className="mt-5 rounded-2xl border border-[#dfeadf] bg-[#f2faf3] p-4 text-sm text-[#3d6a4d]" role="status">{notice}</p>}
        {!token ? <div className="mt-8 rounded-[28px] border border-[#f0e5e0] bg-[#fffdfc] p-8 text-center shadow-[0_16px_40px_rgba(34,55,49,0.05)]"><p className="text-[#596862]">Sign in to keep your saved pieces in one place.</p><a className="mt-4 inline-flex rounded-xl bg-[#2d4d45] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_12px_25px_rgba(45,77,69,0.2)] transition hover:bg-[#1d3a34]" href="/">Return to sign in</a></div>
          : loading ? <div className="page-loading mt-8 rounded-[28px] border border-[#f0e5e0] p-8 text-sm" aria-live="polite" aria-busy="true">Gathering your saved pieces…</div>
          : products.length ? <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => <article className="overflow-hidden rounded-[26px] border border-[#f1e6e0] bg-[#fffefc] shadow-[0_18px_40px_rgba(27,52,46,0.04)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(27,52,46,0.08)]" key={product._id}>
              <a className="block aspect-[0.84] bg-[#f6efe9]" href={`/product/${product._id}`}>{product.images?.[0] && <img className="h-full w-full object-cover" src={product.images[0]} alt={product.title} />}</a>
              <div className="p-4"><p className="truncate font-serif text-lg text-[#213c35]">{product.title}</p><p className="mt-1 text-sm font-semibold text-[#2d4d45]">{money(product.price)}</p><div className="mt-4 grid gap-2"><a className="rounded-xl bg-[#2d4d45] py-2.5 text-center text-xs font-semibold text-white no-underline transition hover:bg-[#1d3933]" href={`/product/${product._id}`}>View piece</a><button className="rounded-xl border border-[#f0d8d3] bg-[#fff5f2] py-2 text-xs font-medium text-[#5d6863] transition hover:bg-[#feefeb] disabled:opacity-50" disabled={busyId === product._id} onClick={() => remove(product._id)} type="button">{busyId === product._id ? 'Removing…' : 'Remove'}</button></div></div>
            </article>)}
          </div> : <div className="mt-8 rounded-[28px] border border-[#f0e5e0] bg-[#fffdfc] p-10 text-center shadow-[0_18px_40px_rgba(34,55,49,0.04)]"><p className="font-serif text-2xl text-[#233d36]">A little room for lovely things.</p><p className="mt-2 text-sm text-[#6c7571]">Your wishlist is empty for now.</p><a className="mt-5 inline-flex rounded-xl bg-[#2d4d45] px-5 py-3 text-sm font-semibold text-white no-underline shadow-[0_12px_25px_rgba(45,77,69,0.2)] transition hover:bg-[#1d3933]" href="/">Explore the collection</a></div>}
      </section>
    </main>
  )
}

export default WishlistPage
