import { useEffect, useState } from 'react'
import StyledSelect from '../components/StyledSelect.jsx'
import { responsiveImage } from '../utils/responsiveImage.js'

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

const readGuestCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('noshin-guest-cart') || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

async function request(path, options = {}) {
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
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
  return data
}

function ProductDetailPage() {
  const productId = window.location.pathname.split('/').filter(Boolean).at(-1)
  const [product, setProduct] = useState(null)
  const [related, setRelated] = useState([])
  const [imageIndex, setImageIndex] = useState(0)
  const [selectedVariant, setSelectedVariant] = useState({})
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [cartBusy, setCartBusy] = useState(false)

  useEffect(() => {
    let active = true
    request(`/api/products/${productId}`)
      .then((detail) => {
        if (!active) return
        setProduct(detail)
        let viewed = []
        try {
          const saved = JSON.parse(localStorage.getItem('noshin-recently-viewed') || '[]')
          viewed = Array.isArray(saved) ? saved : []
        } catch {
          viewed = []
        }
        const recentIds = [detail._id, ...viewed.filter((id) => id !== detail._id)].slice(0, 8)
        localStorage.setItem('noshin-recently-viewed', JSON.stringify(recentIds))
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    request(`/api/products/${productId}/related`)
      .then((relatedProducts) => {
        if (active) setRelated(Array.isArray(relatedProducts) ? relatedProducts : [])
      })
      .catch((requestError) => {
        if (active) setError(`Could not load recommendations: ${requestError.message}`)
      })
    return () => { active = false }
  }, [productId])

  const addToCart = async () => {
    if (product.variants?.length && !Object.keys(selectedVariant).length) {
      setError('Choose an available size or color first.')
      return
    }
    setCartBusy(true)
    setError('')
    setNotice('')
    try {
      const token = sessionStorage.getItem('ecommerce-token')
      if (token) {
        await request('/api/cart/items', {
          method: 'POST',
          body: JSON.stringify({ productId, quantity: 1, selectedVariant }),
        })
      } else {
        const cart = readGuestCart()
        const sameItem = (item) =>
          (typeof item.product === 'object' ? item.product?._id : item.product) === productId &&
          (item.selectedVariant?.size || '') === (selectedVariant.size || '') &&
          (item.selectedVariant?.color || '') === (selectedVariant.color || '')
        const existing = cart.find(sameItem)
        if ((existing?.quantity || 0) >= product.stock) throw new Error('Requested quantity exceeds available stock')
        if (existing) existing.quantity += 1
        else cart.push({
          product: productId,
          productInfo: product,
          quantity: 1,
          selectedVariant,
          price: product.price + (product.variants?.find((variant) =>
            (variant.size || '') === (selectedVariant.size || '') &&
            (variant.color || '') === (selectedVariant.color || ''),
          )?.additionalPrice || 0),
        })
        localStorage.setItem('noshin-guest-cart', JSON.stringify(cart))
      }
      setNotice('Added to your bag. Your cart is ready on the shop page.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setCartBusy(false)
    }
  }

  const addToWishlist = async () => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request('/api/wishlist', {
        method: 'POST',
        body: JSON.stringify({ productId }),
      })
      setNotice('Saved to your wishlist.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  const submitReview = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await request(`/api/products/${productId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      })
      const refreshedProduct = await request(`/api/products/${productId}`)
      setProduct(refreshedProduct)
      setComment('')
      setNotice('Thank you. Your review has been saved.')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#fffaf8] text-[#2d3934]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#f1e5df] bg-[#fffdfd]/95 px-5 py-4 backdrop-blur sm:px-10">
        <a className="font-serif text-2xl font-semibold tracking-tight text-[#233d36] no-underline" href="/">noshin<span className="text-[#b96e7d]">.</span></a>
        <nav className="flex items-center gap-3 text-xs sm:gap-6">
          <a className="text-[#536a63] no-underline transition hover:text-[#9d5a64]" href="/">Shop</a>
          <a className="text-[#536a63] no-underline transition hover:text-[#9d5a64]" href="/wishlist">Wishlist</a>
          <a className="rounded-full bg-[#2d4d45] px-4 py-2 text-white no-underline shadow-[0_12px_25px_rgba(45,77,69,0.15)] transition hover:bg-[#1d3933]" href="/">Back to collection</a>
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-9 sm:px-8 sm:py-14">
        {error && <p className="mb-5 rounded-2xl border border-[#f0d8d6] bg-[#fff4f4] p-4 text-sm text-[#8c4b4e]" role="alert">{error}</p>}
        {notice && <p className="mb-5 rounded-2xl border border-[#dfeadf] bg-[#f2faf3] p-4 text-sm text-[#3d6a4d]" role="status">{notice}</p>}
        {!product && !error ? <p className="page-loading py-24 text-center text-sm text-[#69756f]">Finding this lovely piece…</p> : null}
        {product && (
          <>
            <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div>
                <div className="relative grid aspect-[0.9] place-items-center overflow-hidden rounded-[30px] border border-[#f0e5e0] bg-[#f6efe9] shadow-[0_22px_40px_rgba(36,52,48,0.06)]">
                  {product.images?.[imageIndex] ? (
                    <img className="h-full w-full object-cover" {...responsiveImage(product.images[imageIndex], [640, 960, 1200])} alt={product.title} decoding="async" fetchPriority="high" sizes="(max-width: 1023px) 100vw, 55vw" />
                  ) : <span className="font-serif text-8xl italic text-[#25443c]/30">{product.title.slice(0, 1)}</span>}
                  {product.stock < 1 && <span className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold tracking-widest text-[#9d5a64]">SOLD OUT</span>}
                </div>
                {product.images?.length > 1 && (
                  <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                    {product.images.map((image, index) => (
                      <button className={`h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition duration-200 ${imageIndex === index ? 'border-[#2d4d45] shadow-md shadow-[#2d4d45]/10' : 'border-transparent hover:border-[#e7deda]'}`} key={image} onClick={() => setImageIndex(index)} type="button" aria-label={`View product image ${index + 1}`}>
                        <img className="h-full w-full object-cover" {...responsiveImage(image, [120, 180, 240])} alt="" decoding="async" loading="lazy" sizes="80px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <section className="self-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#b96e7d]">{product.category} · {product.brand}</p>
                <h1 className="mt-4 font-serif text-4xl leading-tight text-[#233d36] sm:text-5xl">{product.title}</h1>
                <p className="mt-4 flex items-center gap-2 text-sm text-[#8a5d21]">
                  <span className="review-star-pill" aria-label={`${product.averageRating || 0} out of 5 stars`}>
                    <span aria-hidden="true">★</span>
                    <span>{Number(product.averageRating || 0).toFixed(1)}</span>
                  </span>
                  <span className="text-[#6c7571]">({product.numReviews || 0} reviews)</span>
                </p>
                <p className="mt-5 text-2xl font-semibold text-[#233d36]">{money(product.price)}</p>
                <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#5a6662]">{product.description}</p>
                <p className={`mt-5 text-xs font-semibold ${product.stock > 0 ? 'text-[#3d6a4d]' : 'text-[#9d5a64]'}`}>{product.stock > 0 ? `${product.stock} in stock` : 'Currently unavailable'}</p>
                {product.variants?.length > 0 && (
                  <label className="mt-6 grid gap-2 text-xs font-semibold text-[#4a5a55]">
                    Choose your option
                    <StyledSelect
                      aria-label="Choose your option"
                      className="product-option-select"
                      value={`${selectedVariant.size || ''}|${selectedVariant.color || ''}`}
                      onChange={(value) => {
                        const [size = '', color = ''] = value.split('|')
                        setSelectedVariant({ ...(size ? { size } : {}), ...(color ? { color } : {}) })
                      }}
                      options={product.variants.map((variant) => ({
                        value: `${variant.size || ''}|${variant.color || ''}`,
                        label: `${[variant.size, variant.color].filter(Boolean).join(' / ')}${variant.additionalPrice ? ` (+${money(variant.additionalPrice)})` : ''}`,
                      }))}
                      placeholder="Select a size or color"
                    />
                  </label>
                )}
                <div className="mt-7 flex flex-wrap gap-3">
                  <button className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#2d4d45] px-6 text-sm font-semibold text-white transition hover:bg-[#1d3933] disabled:opacity-60" disabled={product.stock < 1 || cartBusy} onClick={addToCart} type="button">{cartBusy ? 'Adding…' : 'Add to bag'}</button>
                  {sessionStorage.getItem('ecommerce-token')
                    ? <button className="min-h-12 rounded-xl border border-[#e7deda] bg-white px-5 text-sm font-semibold text-[#233d36] transition hover:bg-[#f8f1ef] disabled:opacity-60" disabled={busy} onClick={addToWishlist} type="button">♡ Save for later</button>
                    : <a className="inline-flex min-h-12 items-center rounded-xl border border-[#e7deda] bg-white px-5 text-sm font-semibold text-[#233d36] no-underline transition hover:bg-[#f8f1ef]" href="/">Sign in to save</a>}
                </div>
              </section>
            </div>

            <section className="mt-16 grid gap-8 border-t border-[#e2e6dc] pt-10 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a55f3d]">A note from you</p>
                <h2 className="mt-2 font-serif text-3xl text-[#193b30]">Share a review</h2>
                {sessionStorage.getItem('ecommerce-token') ? (
                  <form className="mt-5 grid gap-3" onSubmit={submitReview}>
                    <label className="grid gap-2 text-xs font-semibold">Your rating
                      <StyledSelect
                        aria-label="Your rating"
                        className="review-rating-select"
                        value={String(rating)}
                        onChange={(value) => setRating(Number(value))}
                        options={[5, 4, 3, 2, 1].map((value) => ({
                          value: String(value),
                          label: `${value} star${value > 1 ? 's' : ''}`,
                        }))}
                      />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold">Your thoughts
                      <textarea className="min-h-28 rounded-lg border border-slate-200 bg-white p-3 font-normal" maxLength={1000} onChange={(event) => setComment(event.target.value)} required value={comment} />
                    </label>
                    <button className="w-fit rounded-lg bg-[#193b30] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#285442] disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Saving…' : 'Submit review'}</button>
                  </form>
                ) : <p className="mt-4 text-sm text-slate-500">Sign in to leave a review. <a className="text-emerald-800" href="/">Sign in</a></p>}
              </div>
              <div className="space-y-3">
                <h2 className="font-serif text-2xl text-[#193b30]">Customer notes <span className="font-sans text-sm text-slate-400">({product.ratings?.length || 0})</span></h2>
                {product.ratings?.length ? (
                  <div className="product-review-grid">
                    {[...product.ratings].reverse().map((review) => (
                      <article className="product-review-card" key={review._id}>
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-sm font-semibold text-[#193b30]">{review.name}</strong>
                          <span className="review-star-pill">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{review.comment}</p>
                      </article>
                    ))}
                  </div>
                ) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No reviews yet. Be the first to share a thought.</p>}
              </div>
            </section>

            {related.length > 0 && <section className="mt-16 border-t border-[#e2e6dc] pt-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#a55f3d]">Thoughtfully paired</p>
              <h2 className="mt-2 font-serif text-3xl text-[#193b30]">You may also love</h2>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {related.map((item) => <a className="group overflow-hidden rounded-2xl bg-white no-underline shadow-sm" href={`/product/${item._id}`} key={item._id}>
                  <div className="aspect-[0.85] bg-[#e8ece3]">{item.images?.[0] && <img className="h-full w-full object-cover transition duration-300 group-hover:scale-105" {...responsiveImage(item.images[0], [240, 360, 480])} alt={item.title} decoding="async" loading="lazy" sizes="(max-width: 640px) 50vw, 25vw" />}</div>
                  <div className="p-3"><p className="truncate text-sm font-semibold text-[#193b30]">{item.title}</p><p className="mt-1 text-xs text-slate-500">{money(item.price)}</p></div>
                </a>)}
              </div>
            </section>}
          </>
        )}
      </div>
    </main>
  )
}

export default ProductDetailPage
