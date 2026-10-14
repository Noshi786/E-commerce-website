import { useEffect, useState } from 'react'

const EMPTY_ADDRESS = { street: '', city: '', state: '', postalCode: '', country: 'Pakistan', isDefault: false }

function AddressesPage() {
  const token = sessionStorage.getItem('ecommerce-token')
  const [addresses, setAddresses] = useState([])
  const [loading, setLoading] = useState(Boolean(token))
  const [form, setForm] = useState(EMPTY_ADDRESS)
  const [editingId, setEditingId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!token) return
    let active = true
    fetch('/api/users/me/addresses', { headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const data = await response.json().catch(() => [])
        if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
        if (active) setAddresses(Array.isArray(data) ? data : [])
      })
      .catch((loadError) => { if (active) setError(loadError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  const save = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/users/me/addresses${editingId ? `/${editingId}` : ''}`, {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
      setAddresses(Array.isArray(data) ? data : [])
      setForm(EMPTY_ADDRESS)
      setEditingId('')
      setNotice(editingId ? 'Address updated.' : 'Address saved.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (address) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/users/me/addresses/${address._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
      setAddresses(Array.isArray(data) ? data : [])
      setNotice('Address removed.')
    } catch (removeError) {
      setError(removeError.message)
    } finally {
      setBusy(false)
    }
  }

  const setDefault = async (address) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch(`/api/users/me/addresses/${address._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isDefault: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`)
      setAddresses(Array.isArray(data) ? data : [])
      setNotice('Default delivery address updated.')
    } catch (updateError) {
      setError(updateError.message)
    } finally {
      setBusy(false)
    }
  }

  const fields = [
    ['street', 'Street address', 'street-address'],
    ['city', 'City', 'address-level2'],
    ['state', 'Province / state', 'address-level1'],
    ['postalCode', 'Postal code', 'postal-code'],
    ['country', 'Country', 'country-name'],
  ]

  return (
    <main className="min-h-screen bg-[#fffaf8] text-[#2d3934]">
      <header className="flex items-center justify-between border-b border-[#f1e5df] bg-[#fffdfd]/90 px-5 py-4 backdrop-blur sm:px-10">
        <a className="font-serif text-2xl font-semibold tracking-tight text-[#233d36] no-underline" href="/">noshin<span className="text-[#b96e7d]">.</span></a>
        <nav className="flex gap-4 text-xs sm:gap-6"><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/">Shop</a><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/orders">My orders</a><a className="text-[#586860] no-underline transition hover:text-[#9d5a64]" href="/wishlist">Wishlist</a></nav>
      </header>
      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_1fr] sm:px-8">
        <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#b96e7d]">Your account</p>
        <h1 className="mt-2 font-serif text-4xl text-[#233d36]">Saved addresses</h1>
        <p className="mt-2 text-sm text-[#6c7571]">Keep your delivery details close for next time.</p>
        {error && <p className="mt-5 rounded-2xl border border-[#f0d8d6] bg-[#fff4f4] p-4 text-sm text-[#8c4b4e]" role="alert">{error}</p>}
        {notice && <p className="mt-5 rounded-2xl border border-[#dfeadf] bg-[#f2faf3] p-4 text-sm text-[#3d6a4d]" role="status">{notice}</p>}
        {!token ? <div className="mt-8 rounded-[26px] border border-[#f1e6e0] bg-[#fffdfc] p-6 text-sm text-[#596862] shadow-[0_18px_38px_rgba(34,55,49,0.04)]">Sign in to manage your saved addresses. <a className="font-semibold text-[#2d4d45]" href="/">Sign in</a></div>
          : loading ? <div className="page-loading mt-7 rounded-[24px] border border-[#f1e6e0] p-7 text-sm" aria-live="polite" aria-busy="true">Loading your saved addresses…</div>
          : <div className="mt-7 space-y-3">{addresses.length ? addresses.map((address) => <article className="rounded-[24px] border border-[#f1e6e0] bg-[#fffdfc] p-5 shadow-[0_18px_38px_rgba(34,55,49,0.04)]" key={address._id}>
            <div className="flex justify-between gap-3"><div><p className="text-sm font-semibold text-[#233d36]">{address.street}</p><p className="mt-1 text-xs leading-5 text-[#717d79]">{address.city}, {address.state} {address.postalCode}<br />{address.country}</p></div>{address.isDefault && <span className="h-fit rounded-full bg-[#edf5f1] px-2.5 py-1 text-[10px] font-semibold text-[#315346]">Default</span>}</div>
              <div className="mt-4 flex flex-wrap gap-2">
              {!address.isDefault && <button className="rounded-xl border border-[#e8ddd7] bg-white px-3 py-2 text-[11px] font-medium text-[#4f5d57] transition hover:bg-[#f9f2f1] disabled:opacity-50" disabled={busy} onClick={() => setDefault(address)} type="button">Make default</button>}
              <button className="rounded-xl border border-[#e8ddd7] bg-white px-3 py-2 text-[11px] font-medium text-[#4f5d57] transition hover:bg-[#f9f2f1] disabled:opacity-50" disabled={busy} onClick={() => { setForm({ street: address.street, city: address.city, state: address.state, postalCode: address.postalCode, country: address.country, isDefault: address.isDefault }); setEditingId(address._id) }} type="button">Edit</button>
              <button className="rounded-xl bg-[#fff5f2] px-3 py-2 text-[11px] font-medium text-[#9d5a64] transition hover:bg-[#fceeea] disabled:opacity-50" disabled={busy} onClick={() => remove(address)} type="button">Remove</button>
              </div>
          </article>) : <p className="rounded-[24px] border border-[#f1e6e0] bg-[#fffdfc] p-6 text-sm text-[#6c7571] shadow-[0_18px_38px_rgba(34,55,49,0.04)]">No saved addresses yet.</p>}</div>}
        </div>
        {token && <form className="h-fit rounded-[28px] border border-[#f1e6e0] bg-[#fffdfc] p-6 shadow-[0_22px_50px_rgba(34,55,49,0.05)] sm:p-8" onSubmit={save}>
        <h2 className="font-serif text-2xl text-[#233d36]">{editingId ? 'Edit address' : 'Add an address'}</h2>
        <div className="mt-5 grid gap-3">{fields.map(([field, label, autocomplete]) => <label className="grid gap-1.5 text-xs font-semibold text-[#4a5a55]" key={field}>{label}<input autoComplete={autocomplete} className="h-11 rounded-xl border border-[#e7deda] bg-white px-3 font-normal text-[#2d3934] outline-none transition focus:border-[#b96e7d] focus:shadow-[0_0_0_4px_rgba(185,110,125,0.12)]" onChange={(event) => setForm({ ...form, [field]: event.target.value })} required value={form[field]} /></label>)}</div>
        <label className="mt-4 flex items-center gap-2 text-xs text-[#596862]"><input checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} type="checkbox" />Set as my default address</label>
        <div className="mt-5 flex gap-2"><button className="rounded-xl bg-[#2d4d45] px-5 py-3 text-xs font-semibold text-white transition hover:bg-[#1d3933] disabled:opacity-60" disabled={busy} type="submit">{busy ? 'Saving…' : editingId ? 'Update address' : 'Save address'}</button>{editingId && <button className="rounded-xl border border-[#e7deda] bg-white px-4 py-3 text-xs text-[#4a5a55]" onClick={() => { setForm(EMPTY_ADDRESS); setEditingId('') }} type="button">Cancel</button>}</div>
        </form>}
      </section>
    </main>
  )
}

export default AddressesPage
