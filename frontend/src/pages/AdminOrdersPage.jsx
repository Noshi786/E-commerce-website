import { useCallback, useEffect, useState } from 'react'
import StyledSelect from '../components/StyledSelect.jsx'

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'completed', 'failed']

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

function AdminOrdersPage() {
  const [orders, setOrders] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const user = (() => {
    try { return JSON.parse(sessionStorage.getItem('ecommerce-user') || 'null') } catch { return null }
  })()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter) params.set('orderStatus', statusFilter)
      if (paymentFilter) params.set('paymentStatus', paymentFilter)
      const data = await request(`/api/orders/admin/all?${params}`)
      setOrders(data.orders || [])
      setPages(data.pages || 1)
      setTotal(data.total || 0)
      setError('')
    } catch (loadError) {
      setError(loadError.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter, paymentFilter])

  useEffect(() => {
    if (user?.role !== 'admin' || !sessionStorage.getItem('ecommerce-token')) return
    let active = true
    Promise.resolve().then(() => {
      if (active) load()
    })
    return () => { active = false }
  }, [load, user?.role])

  const updateOrder = async (order, path, body, label) => {
    setBusy(`${order._id}-${label}`)
    setError('')
    setNotice('')
    try {
      const updated = await request(`/api/orders/${order._id}/${path}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      setOrders((current) => current.map((item) => item._id === order._id ? { ...item, ...updated } : item))
      setNotice(`${label === 'orderStatus' ? 'Delivery' : 'Payment'} status updated.`)
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setBusy('')
    }
  }

  if (!sessionStorage.getItem('ecommerce-token') || user?.role !== 'admin') {
    return <main className="grid min-h-screen place-items-center bg-slate-50 px-5"><section className="rounded-2xl bg-white p-8 text-center shadow"><h1 className="font-serif text-3xl">Admin access only</h1><p className="mt-2 text-sm text-slate-500">Sign in with an administrator account to manage orders.</p><a className="mt-5 inline-block text-sm text-emerald-800" href="/">Return to store</a></section></main>
  }

  return (
    <main className="min-h-screen bg-[#fffaf8] px-5 py-7 text-[#2d3934] sm:px-8 lg:px-12">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
        <a className="font-serif text-2xl font-semibold text-[#233d36] no-underline" href="/admin">← Noshin admin</a>
        <nav className="flex gap-3 text-xs"><a className="text-slate-600 no-underline" href="/admin/products">Manage products</a><a className="text-slate-600 no-underline" href="/">View store</a></nav>
      </header>
      <section className="mx-auto mt-8 max-w-7xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-800">Order desk</p><h1 className="mt-2 font-serif text-4xl text-slate-900">Orders</h1><p className="mt-2 text-sm text-slate-500">Track fulfilment, payment and customer cancellation requests.</p></div>
          <div className="flex flex-wrap gap-2">
            <StyledSelect aria-label="Filter delivery status" onChange={(value) => { setPage(1); setStatusFilter(value) }} options={STATUSES.map((status) => ({ value: status, label: status }))} placeholder="All delivery statuses" value={statusFilter} />
            <StyledSelect aria-label="Filter payment status" onChange={(value) => { setPage(1); setPaymentFilter(value) }} options={PAYMENT_STATUSES.map((status) => ({ value: status, label: status }))} placeholder="All payment statuses" value={paymentFilter} />
            <button className="h-10 rounded-xl border border-[#eadfe1] bg-[#fff5f3] px-3 text-xs font-medium text-[#4d5954] transition hover:bg-[#fceeea]" onClick={load} type="button">Refresh</button>
          </div>
        </div>
        {error && <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
        {notice && <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800" role="status">{notice}</p>}
        <div className="order-desk-board mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? <p className="page-loading p-12 text-center text-sm text-slate-500">Loading orders…</p> : orders.length ? <div className="divide-y divide-slate-100">
            {orders.map((order) => <article className="grid gap-4 p-5 lg:grid-cols-[1fr_1.2fr_1.2fr]" key={order._id}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">#{String(order._id).slice(-8).toUpperCase()}</p>
                <p className="mt-1 text-sm font-semibold text-slate-800">{order.user?.name || order.guestName || 'Guest customer'}</p>
                <p className="mt-1 break-all text-xs text-slate-500">{order.user?.email || order.guestEmail}</p>
                <p className="mt-2 text-[10px] text-slate-400">{new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(order.createdAt))}</p>
                <p className="mt-2 text-xs font-semibold text-slate-700">{money(order.totalAmount)} · {order.orderItems?.length || 0} item(s)</p>
                {order.cancellationRequested && <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">Cancellation requested</span>}
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Delivery status</p>
                <StyledSelect aria-label={`Delivery status for order ${order._id}`} className="mt-2 w-full" disabled={busy === `${order._id}-orderStatus`} onChange={(value) => updateOrder(order, 'status', { orderStatus: value }, 'orderStatus')} options={STATUSES.map((status) => ({ value: status, label: status }))} value={order.orderStatus} />
                {order.orderItems?.map((item, index) => <p className="mt-2 truncate text-[10px] text-slate-500" key={`${item.product}-${index}`}>{item.quantity} × {item.title}</p>)}
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Payment status</p>
                <StyledSelect aria-label={`Payment status for order ${order._id}`} className="mt-2 w-full" disabled={busy === `${order._id}-paymentStatus`} onChange={(value) => updateOrder(order, 'payment-status', { paymentStatus: value }, 'paymentStatus')} options={PAYMENT_STATUSES.map((status) => ({ value: status, label: status }))} value={order.paymentStatus} />
                <p className="mt-2 text-[10px] text-slate-500">Ship to: {order.shippingAddress?.city}, {order.shippingAddress?.country}</p>
              </div>
            </article>)}
          </div> : <p className="p-12 text-center text-sm text-slate-500">No orders match these filters.</p>}
          <footer className="flex items-center justify-between border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>{total} orders</span><div className="flex items-center gap-3"><button className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button><span>{page} / {pages}</span><button className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40" disabled={page >= pages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button></div></footer>
        </div>
      </section>
    </main>
  )
}

export default AdminOrdersPage
