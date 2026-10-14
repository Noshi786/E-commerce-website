import { useEffect, useState } from 'react'

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

const formatDate = (date) =>
  new Intl.DateTimeFormat('en-PK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date))

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
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`)
  }
  return data
}

function OrdersPage() {
  const hasToken = Boolean(sessionStorage.getItem('ecommerce-token'))
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(hasToken)
  const [error, setError] = useState('')
  const [busyOrder, setBusyOrder] = useState('')

  useEffect(() => {
    if (!hasToken) return

    let active = true
    request('/api/orders/myorders')
      .then((data) => {
        if (active) setOrders(Array.isArray(data) ? data : [])
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [hasToken])

  const requestCancellation = async (orderId) => {
    setBusyOrder(orderId)
    setError('')
    try {
      const updatedOrder = await request(`/api/orders/${orderId}/cancel-request`, {
        method: 'POST',
      })
      setOrders((current) =>
        current.map((order) => (order._id === orderId ? updatedOrder : order)),
      )
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusyOrder('')
    }
  }

  return (
    <main className="orders-page">
      <header className="orders-header">
        <a className="store-logo" href="/">noshin<span>.</span></a>
        <a className="orders-back-link" href="/">← Back to shop</a>
      </header>

      <section className="orders-content">
        <p className="store-eyebrow">YOUR NOSHIN ACCOUNT</p>
        <h1>My orders</h1>
        <p className="orders-intro">A little overview of the good things on their way to you.</p>

        {error && <p className="orders-error" role="alert">{error}</p>}

        {!hasToken ? (
          <div className="orders-state">
            <h2>Sign in to see your orders.</h2>
            <p>Your order history is available when you’re signed in to your account.</p>
            <a className="orders-primary-button" href="/">Return to sign in <span>→</span></a>
          </div>
        ) : loading ? (
          <div className="orders-state page-loading">Loading your orders…</div>
        ) : orders.length === 0 ? (
          <div className="orders-state">
            <h2>No orders just yet.</h2>
            <p>Your next everyday favorite might be waiting in the collection.</p>
            <a className="orders-primary-button" href="/">Explore the collection <span>→</span></a>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map((order) => (
              <article className="order-card" key={order._id}>
                <div className="order-card-header">
                  <div>
                    <a className="order-number" href={`/orders/${order._id}`}>ORDER #{order._id.slice(-8).toUpperCase()} · View details</a>
                    <p className="order-date">Placed {formatDate(order.createdAt)}</p>
                  </div>
                  <span className={`order-status status-${order.orderStatus}`}>
                    {order.orderStatus}
                  </span>
                </div>

                <div className="order-items">
                  {order.orderItems.map((item, index) => (
                    <div className="order-item" key={`${item.product}-${index}`}>
                      <div>
                        <strong>{item.title}</strong>
                        <span>
                          Qty {item.quantity}
                          {item.selectedVariant?.size ? ` · ${item.selectedVariant.size}` : ''}
                          {item.selectedVariant?.color ? ` · ${item.selectedVariant.color}` : ''}
                        </span>
                      </div>
                      <strong>{money(item.price * item.quantity)}</strong>
                    </div>
                  ))}
                </div>

                <div className="order-card-footer">
                  <div className="order-payment">
                    <span>Payment: {order.paymentStatus}</span>
                    <strong>{money(order.totalAmount)}</strong>
                  </div>
                  {order.cancellationRequested ? (
                    <span className="cancel-requested">Cancellation requested</span>
                  ) : ['pending', 'processing'].includes(order.orderStatus) ? (
                    <button
                      className="cancel-order-button"
                      disabled={busyOrder === order._id}
                      onClick={() => requestCancellation(order._id)}
                      type="button"
                    >
                      {busyOrder === order._id ? 'Sending request…' : 'Request cancellation'}
                    </button>
                  ) : null}
                </div>

                <p className="order-address">
                  Delivering to {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
                  {order.shippingAddress.state} {order.shippingAddress.postalCode},{' '}
                  {order.shippingAddress.country}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default OrdersPage
