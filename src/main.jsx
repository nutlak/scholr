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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
