import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './hud.css'
import App from './App.jsx'
import { captureReferral } from './lib/referral.js'

// Runs before render so a /@username or ?ref= link is banked (and stripped
// from the URL) no matter which screen the app lands on. Never blocks the
// app: a failed lookup just means no attribution.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
captureReferral(API_URL).catch(() => {})

// iOS Safari has ignored `user-scalable=no` since iOS 10, on purpose, so the
// viewport meta alone does not hold there — pinch arrives as these three
// Safari-only gesture events instead. Blocking them is what actually stops the
// page being zoomed on an iPhone. Remove this (and the meta's maximum-scale)
// together if pinch-to-zoom should come back.
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, e => e.preventDefault(), { passive: false })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
