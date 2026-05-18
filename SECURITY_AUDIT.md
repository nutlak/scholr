# Scholr Security Audit

**Date:** 2026-05-18  
**Auditor:** Claude (automated)

---

## ✅ Checks Passed

### Phase 1 — Backend Secrets
- No `sk_live_`, `sk_test_`, `whsec_`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE`, `CLAUDE_API_KEY`, `RESEND_API_KEY` anywhere in `src/`
- Only `VITE_API_URL` uses the `VITE_` prefix in frontend code — all other env vars are server-only
- No `.env` files appear in git history

### Phase 2 — API Responses
- `SUPABASE_SERVICE_ROLE_KEY` referenced only in `process.env` reads and `REQUIRED_ENV` check — never returned in responses
- Stripe webhook endpoint validates signatures via `stripe.webhooks.constructEvent()` ✅
- Public routes are appropriate: `/api/invite/:token` (join links), `/api/auth/*` (login flow), `/healthz`

### Phase 4 — Claude / Anthropic API
- Zero Anthropic API calls in `src/` — all go through server endpoints ✅
- Usage limits checked **before** every Claude call in `/api/notebooks/:id/query` and `/api/notebooks/:id/forge` ✅

### Phase 5 — Stripe Integration
- Checkout session uses `req.user.id` exclusively — never accepts `user_id` from request body ✅
- Portal session looks up `stripe_customer_id` from DB by `req.user.id` ✅
- `STRIPE_PRICE_ID` never referenced in `src/` ✅

### Phase 6 — Supabase Security
- `SUPABASE_SERVICE_ROLE_KEY` only in `server/index.js` (process.env) and `server/.env` (gitignored) ✅
- Frontend uses anon key (`VITE_SUPABASE_KEY`) — no service role key in `src/` ✅

### Phase 7 — Build Artifacts
- Production bundle (`dist/`) contains zero secrets: no `sk_live_`, `sk_test_`, `whsec_`, `sb_secret_`, `ANTHROPIC` ✅
- No source maps in `dist/assets/` ✅

### Phase 8 — Git History
- No `.env` files in git history ✅
- No raw secret values found in last 50 commits ✅

---

## ⚠️ Issues Found and Fixed

| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| `err.message` returned in 5 error responses (could leak DB/API internals) | High | Replaced with generic messages; raw error logged server-side |
| `/api/test-email` endpoint unprotected — anyone could spam any address | High | Route removed |
| No rate limiting on Claude/Stripe endpoints | Medium | Added `express-rate-limit`: 100 req/hr (query), 20 req/hr (forge), 5 req/min (checkout), 1000 req/min (webhook) |
| Checkout session missing `client_reference_id` | Low | Added `client_reference_id: userId` for webhook resilience |
| `.gitignore` missing `.env`, `.env.production`, `.env.development` patterns | Low | Added all standard env file patterns |
| No pre-commit hook to prevent future secret commits | Low | Created `.husky/pre-commit` blocking `sk_live_`, `sk_test_`, `whsec_`, service role keys |

---

## 🚨 Action Required from You

### 1. Stripe API Keys — Keys Rejected by Stripe API
Both the test and live Stripe keys provided are returning `StripeAuthenticationError: Invalid API Key`. The Railway env var is set, but checkout will fail until this is resolved.

**Action:** Log into [dashboard.stripe.com](https://dashboard.stripe.com), ensure your account is fully verified (identity + bank account), copy the secret key fresh from the API Keys page, and provide it for Railway update.

### 2. Live Stripe Webhooks — Not Yet Created
Old test-mode webhooks cannot be audited or deleted (test key invalid). Live-mode webhook does not yet exist.

**Action:** In Stripe Dashboard → Developers → Webhooks:
1. Delete any existing test-mode webhook endpoints
2. Create endpoint: `https://scholr-production-612b.up.railway.app/api/webhooks/stripe`  
   Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. Copy the signing secret (`whsec_...`) and provide it to update Railway

### 3. Anthropic Spending Cap
No automated cap is set in the Anthropic console. An attacker who bypasses auth could drain credits.

**Action:** Go to [console.anthropic.com](https://console.anthropic.com) → Settings → Limits → Set daily spending cap ($50 recommended) with alerts at 50% and 80%.

### 4. Supabase RLS Policies
RLS policies on `subscriptions` and `usage` tables were not auditable from this machine. Verify in Supabase SQL Editor:
```sql
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('subscriptions', 'usage');
```
Both tables must have policies preventing users from reading or modifying other users' rows.

---

## 📊 Rate Limits Configured

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/notebooks/:id/query` | 100 req | per user per hour |
| `POST /api/notebooks/:id/forge` | 20 req | per user per hour |
| `POST /api/create-checkout-session` | 5 req | per user per minute |
| `POST /api/webhooks/stripe` | 1000 req | per IP per minute |

---

## 🔒 Pre-commit Hook

`.husky/pre-commit` blocks commits containing:  
`sk_live_`, `sk_test_`, `whsec_`, `SUPABASE_SERVICE_ROLE_KEY=`, `CLAUDE_API_KEY=`, `RESEND_API_KEY=`, `sb_secret_`

To activate on a fresh clone: `npx husky install`
