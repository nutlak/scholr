import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './hud.css'
import App from './App.jsx'
import { captureReferral } from './lib/referral.js'
import { installSheetDrag } from './lib/sheetDrag.js'

// Runs before render so a /@username or ?ref= link is banked (and stripped
// from the URL) no matter which screen the app lands on. Never blocks the
// app: a failed lookup just means no attribution.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
captureReferral(API_URL).catch(() => {})

// The worker was only ever registered from enablePush(), so anyone who had not
// turned on notifications had no worker at all — and without an active worker
// Chrome will not offer to install scholr, and there is no offline page. Push
// still calls register() itself and that is fine: it is idempotent for the same
// URL. Failure here is not worth surfacing; it costs the install prompt, not
// the app.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// iOS Safari has ignored `user-scalable=no` since iOS 10, on purpose, so the
// viewport meta alone does not hold there — pinch arrives as these three
// Safari-only gesture events instead. Blocking them is what actually stops the
// page being zoomed on an iPhone. Remove this (and the meta's maximum-scale)
// together if pinch-to-zoom should come back.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false })
}

// One delegated listener for every bottom sheet in the app, rather than a
// gesture prop threaded through fourteen components.
installSheetDrag()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
