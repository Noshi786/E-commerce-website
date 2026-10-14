import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// ===== Interaction effects: reveal, tilt, cursor glow, sticky header =====
const REVEAL = '.shop-heading,.shop-tools,.product-card,.recent-section > div:first-child,.store-note > *,.hero-copy > *,.order-card,.orders-state,main:not(.storefront) article,main:not(.storefront) section > form,main:not(.storefront) section > div[class*="rounded"]'
const root = document.getElementById('root')
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const io = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view')
      io.unobserve(entry.target)
    }
  })
}, { threshold: 0.1 })

const tagRevealables = () => {
  let n = 0
  root.querySelectorAll(REVEAL).forEach((el) => {
    if (el.dataset.rv) return
    el.dataset.rv = '1'
    el.classList.add('rv')
    el.style.setProperty('--d', `${(n++ % 4) * 90}ms`)
    io.observe(el)
  })
}
tagRevealables()
new MutationObserver(tagRevealables).observe(root, { childList: true, subtree: true })

const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 40)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

if (!reduceMotion) {
  document.addEventListener('mousemove', (event) => {
    const card = event.target.closest?.('.product-card')
    if (card) {
      const r = card.getBoundingClientRect()
      card.style.setProperty('--ry', `${((event.clientX - r.left) / r.width - 0.5) * 7}deg`)
      card.style.setProperty('--rx', `${-((event.clientY - r.top) / r.height - 0.5) * 7}deg`)
    }
    const btn = event.target.closest?.('.add-button,.primary-button,.hero-cta,.bag-button,.google-signin')
    if (btn) {
      const r = btn.getBoundingClientRect()
      btn.style.setProperty('--mx', `${event.clientX - r.left}px`)
      btn.style.setProperty('--my', `${event.clientY - r.top}px`)
    }
    const hero = event.target.closest?.('.store-hero')
    if (hero) {
      const r = hero.getBoundingClientRect()
      hero.style.setProperty('--px', `${((event.clientX - r.left) / r.width - 0.5) * 24}px`)
      hero.style.setProperty('--py', `${((event.clientY - r.top) / r.height - 0.5) * 24}px`)
    }
  })
  document.addEventListener('mouseout', (event) => {
    const card = event.target.closest?.('.product-card')
    if (card && !card.contains(event.relatedTarget)) {
      card.style.setProperty('--rx', '0deg')
      card.style.setProperty('--ry', '0deg')
    }
  }, true)
}