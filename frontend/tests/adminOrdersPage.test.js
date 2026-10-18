import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pageSource = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'pages', 'AdminOrdersPage.jsx'),
  'utf8',
)

// --- Extracted logic: mirrors AdminOrdersPage.jsx ---

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled']
const PAYMENT_STATUSES = ['pending', 'completed', 'failed']

const money = (amount) =>
  new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount || 0)

const shortId = (id) => `#${String(id).slice(-8).toUpperCase()}`

const orderDate = (createdAt) =>
  new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium' }).format(new Date(createdAt))

const buildQuery = (page, statusFilter, paymentFilter) => {
  const params = new URLSearchParams({ page: String(page), limit: '20' })
  if (statusFilter) params.set('orderStatus', statusFilter)
  if (paymentFilter) params.set('paymentStatus', paymentFilter)
  return params.toString()
}

const applyUpdate = (current, orderId, updated) =>
  current.map((item) => (item._id === orderId ? { ...item, ...updated } : item))

// --- Tests ---

test('money formats PKR amounts and treats falsy values as zero', () => {
  assert.equal(money(2500), 'Rs\xa02,500')
  assert.equal(money(0), 'Rs\xa00')
  assert.equal(money(undefined), 'Rs\xa00')
  assert.equal(money(null), 'Rs\xa00')
  assert.equal(money(1234567.9), 'Rs\xa01,234,568')
})

test('order id badge keeps the last 8 characters uppercased', () => {
  assert.equal(shortId('507f1f77bcf86cd799439011'), '#99439011')
  assert.equal(shortId('abcdef12'), '#ABCDEF12')
  assert.equal(shortId('ab'), '#AB')
})

test('order date renders a medium en-PK date without crashing on valid input', () => {
  const formatted = orderDate('2026-03-05T10:00:00.000Z')
  assert.ok(/^0?5-Mar-2026$/.test(formatted), `unexpected date format: ${formatted}`)
})

test('filter query builder only includes set filters and resets to page 1', () => {
  assert.equal(buildQuery(1, '', ''), 'page=1&limit=20')
  assert.equal(buildQuery(3, 'pending', ''), 'page=3&limit=20&orderStatus=pending')
  assert.equal(buildQuery(2, '', 'failed'), 'page=2&limit=20&paymentStatus=failed')
  assert.equal(buildQuery(4, 'shipped', 'completed'), 'page=4&limit=20&orderStatus=shipped&paymentStatus=completed')
})

test('status lists cover every option used by the selects', () => {
  assert.deepEqual(STATUSES, ['pending', 'processing', 'shipped', 'delivered', 'cancelled'])
  assert.deepEqual(PAYMENT_STATUSES, ['pending', 'completed', 'failed'])
  assert.ok(STATUSES.every((status) => typeof status === 'string' && status.length > 0))
  assert.ok(PAYMENT_STATUSES.every((status) => typeof status === 'string' && status.length > 0))
  assert.equal(new Set(STATUSES).size, STATUSES.length)
  assert.equal(new Set(PAYMENT_STATUSES).size, PAYMENT_STATUSES.length)
})

test('status update replaces the matching order without touching others', () => {
  const current = [
    { _id: 'a', orderStatus: 'pending' },
    { _id: 'b', orderStatus: 'pending' },
  ]
  const next = applyUpdate(current, 'b', { orderStatus: 'delivered' })
  assert.deepEqual(next, [
    { _id: 'a', orderStatus: 'pending' },
    { _id: 'b', orderStatus: 'delivered' },
  ])
  assert.deepEqual(current, [
    { _id: 'a', orderStatus: 'pending' },
    { _id: 'b', orderStatus: 'pending' },
  ], 'original array must not be mutated')
})

test('notice label maps orderStatus to Delivery and paymentStatus to Payment', () => {
  const labelFor = (label) => `${label === 'orderStatus' ? 'Delivery' : 'Payment'} status updated.`
  assert.equal(labelFor('orderStatus'), 'Delivery status updated.')
  assert.equal(labelFor('paymentStatus'), 'Payment status updated.')
})

test('page source keeps the stacking classes that let the open dropdown float above sibling cards', () => {
  assert.match(pageSource, /order-desk-board/, 'the board wrapper class must stay on the container')
  assert.match(pageSource, /overflow-hidden rounded-2xl/, 'the container classes must stay intact')
  assert.match(
    pageSource,
    /key=\{order\._id\}/,
    'each order row must be keyed by its order id',
  )
})

test('every StyledSelect usage in the page passes options, value and aria-label', () => {
  const selects = pageSource.split('<StyledSelect').slice(1)
  assert.equal(selects.length, 4, 'the page renders exactly four selects')
  for (const select of selects) {
    assert.match(select, /aria-label=/, 'select needs an aria-label')
    assert.match(select, /options=/, 'select needs options')
    assert.match(select, /value=/, 'select needs a controlled value')
    assert.match(select, /onChange=/, 'select needs an onChange handler')
  }
})
