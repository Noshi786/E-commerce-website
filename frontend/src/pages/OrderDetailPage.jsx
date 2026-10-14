import { useEffect, useState } from 'react'

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

function OrderDetailPage() {
  const orderId = window.location.pathname.split('/').filter(Boolean).at(-1)
  const token = sessionStorage.getItem('ecommerce-token')
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    fetch(`/api/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
        if (active) setOrder(data)
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
    return () => { active = false }
  }, [orderId, token])

  return (
    <main className="min-h-screen bg-[#f8f7f1] text-[#26352e]">
      <header className="flex items-center justify-between border-b border-[#e6e8df] bg-[#fdfcf9] px-5 py-4 sm:px-10">
        <a className="font-serif text-2xl font-semibold text-[#193b30] no-underline" href="/">noshin<span className="text-[#a55f3d]">.</span></a>
        <a className="text-xs text-slate-600 no-underline hover:text-emerald-800" href="/orders">← All orders</a>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-12">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a55f3d]">Order details</p>
        <h1 className="mt-2 font-serif text-4xl text-[#193b30]">Your order</h1>
        {!token && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Please sign in to view your order details.</p>}
        {error && <p className="mt-6 rounded-xl bg-rose-50 p-4 text-sm text-rose-800" role="alert">{error}</p>}
        {!order && token && !error && <p className="page-loading mt-6 text-sm text-slate-500">Loading order…</p>}
        {order && <article className="mt-7 overflow-hidden rounded-3xl border border-[#e3e7de] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-6">
            <div><p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Order number</p><p className="mt-1 font-semibold">#{String(order._id).slice(-8).toUpperCase()}</p></div>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold capitalize text-emerald-800">{order.orderStatus}</span>
          </div>
          <div className="divide-y divide-slate-100 px-6">
            {order.orderItems?.map((item, index) => <div className="flex justify-between gap-4 py-4" key={`${item.product}-${index}`}><div><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-xs text-slate-500">Quantity {item.quantity}{item.selectedVariant?.size ? ` · ${item.selectedVariant.size}` : ''}{item.selectedVariant?.color ? ` · ${item.selectedVariant.color}` : ''}</p></div><p className="text-sm font-medium">{money(item.price * item.quantity)}</p></div>)}
          </div>
          <div className="grid gap-2 border-t border-slate-100 bg-[#fbfbf8] p-6 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{money(order.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Shipping</span><span>{money(order.shippingFee)}</span></div>
            {order.discount > 0 && <div className="flex justify-between"><span className="text-slate-500">Discount</span><span>-{money(order.discount)}</span></div>}
            <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 font-semibold"><span>Total</span><span>{money(order.totalAmount)}</span></div>
            <div className="mt-2 flex justify-between text-xs"><span className="text-slate-500">Payment status</span><span className="capitalize">{order.paymentStatus}</span></div>
          </div>
          <div className="p-6"><h2 className="text-sm font-semibold">Delivery address</h2><p className="mt-2 text-sm leading-6 text-slate-600">{order.shippingAddress.street}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />{order.shippingAddress.country}</p></div>
        </article>}
      </section>
    </main>
  )
}

export default OrderDetailPage
