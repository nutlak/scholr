# Scholr — Targeted Audit (changes since AUDIT.md)

_Scope: ONLY the surfaces added/changed this session — billing notifications, notification-system changes, the friend-request feed responder, font/CSS, and the age gate. Prior audit (AUDIT.md) findings are treated as closed and were not re-reviewed. Report-first; no code changed (no zero-risk-trivial items like typos/dead imports were found in these surfaces). Severity: CRITICAL / HIGH / MEDIUM / LOW._

## Bottom line
**Nothing critical or high.** The new surfaces are largely clean: clear-inbox and the respond-deletion are correctly scoped to the current user, the new notification types render as escaped React text, the payment-failed webhook can't crash Stripe, and the age gate genuinely blocks under-13 on every server path with no client-side signup bypass. The only real items are on the **renewal-reminder worker**: a MEDIUM multi-instance double-send race (same single-instance limitation already noted for the existing email worker) and two LOWs around timestamp-equality fragility and a swallowed-failure-still-marks-sent. One LOW UX inconsistency in the feed responder's non-409 error path.

---

## 1. Billing notifications

### 1a. `invoice.payment_failed` webhook — CLEAN (one LOW)
- **User resolution correct.** `getUserIdByStripeCustomer(invoice.customer)` looks up `subscriptions.stripe_customer_id`. If `invoice.customer` is null/unknown it returns null → logged `warn`, no notification, no crash. ✓
- **Cannot crash the webhook / Stripe retry loop.** `pushNotification` does a Supabase insert and only `console.error`s on failure — it never throws (supabase-js resolves with `{error}`, doesn't reject). So `await pushNotification(...)` can't throw, the handler reaches `res.json({ received: true })` → **200 to Stripe**. Even if the `payment_failed` type weren't in the CHECK yet, the insert just errors-and-logs. ✓
- **Null-safety on the invoice object.** `attempt_count ?? null` and the `next_payment_attempt ? new Date(...*1000) : null` guard handle missing fields. ✓
- **[LOW] Repeat notifications across dunning.** Stripe emits `invoice.payment_failed` once per retry attempt, so a user can get 3–4 "update your card" notifications over a dunning cycle. That's arguably desirable, but there's no dedup. _Proposed (optional): skip if an unread `payment_failed` for this user already exists, or include the attempt in the line ("attempt 2 of 4")._
- _Note: an unexpected throw earlier in the `try` (e.g. Supabase outage) returns 500 → Stripe retries. Acceptable/transient — not the payment-failed path itself._

### 1b. Renewal worker `processRenewalReminders` + `reminder_sent_for_period`
- **[MEDIUM] Multi-instance double-send.** The idempotency is check-then-update in JS (`if (reminder_sent_for_period === current_period_end) continue;` … then `update`), which is **not atomic**. On a single Railway instance the daily timer won't overlap itself, so it's safe — but with ≥2 instances both can read the unmarked row and both `pushNotification` before either marks it → duplicate reminders. This matches the documented single-instance limitation of `processPendingEmails`. _Proposed fix: make the mark conditional in the write (e.g. `.update({reminder_sent_for_period}).eq("user_id",id).neq("reminder_sent_for_period", current_period_end)` and only notify if it returns a changed row), or run workers on a single instance / behind an advisory lock. At minimum, document the constraint (already commented)._
- **[LOW] Timestamp equality is string-fragile.** `row.reminder_sent_for_period === row.current_period_end` compares two timestamptz values as PostgREST-serialized strings. It works because both columns hold the same instant and share one serializer, but any serialization drift (precision/offset) would make it re-send daily. _Proposed: compare by `new Date(a).getTime() === new Date(b).getTime()`, or filter in the query._
- **[LOW] Swallowed push failure still marks sent.** Because `pushNotification` never signals failure, the worker always runs `update({reminder_sent_for_period})` even if the insert failed → that period's reminder is silently lost (an **under**-send, not a double-send). _Proposed: have `pushNotification` return/throw on error and only mark sent on success._
- Otherwise correct: 3-day horizon (`gte now`, `lte now+3d`), `tier='pro'` filter, `limit 500`, per-row try/catch, `days` clamped `>= 0`, migration-tolerant (errors logged, never crashes). ✓
- **Double-send verdict:** in normal single-instance operation, **no** — the marker prevents it. The realistic risk is multi-instance (MEDIUM, documented).

---

## 2. Notification-system changes — CLEAN

- **`DELETE /api/social/notifications` (clear inbox) — correctly scoped.** `.delete().eq("user_id", req.user.id)`, `requireAuth`. There is **no** way to clear another user's inbox (no id/user param accepted). ✓
- **Respond endpoint `clearRequestNotif` — can't delete wrong rows.** `.delete().eq("user_id", req.user.id).eq("type","friend_request").eq("payload->>requestId", requestId)`. `requestId` is validated as a non-empty string earlier in the handler, and the delete is triple-scoped (own rows, friend_request type, that specific requestId). Worst case it removes the one (or duplicate) notification for that exact request — never anyone else's. ✓
- **New types render safely.** `payment_failed` / `renewal_reminder` are rendered via `notifLine()` (App.jsx) and `describe()` (NotificationsBell.jsx) as plain React text nodes (auto-escaped); payload values (`days`, `fromUsername`) are interpolated as text, no `dangerouslySetInnerHTML`. Tappable rows call `handleManageSubscription`/`onOpenBilling` (Stripe portal) — no user-controlled URL. ✓

---

## 3. Friend-request feed responder (`respondToFriendFromFeed` + 409) — one LOW

- Happy path: optimistic `dropRow()` → `respondToFriend` → bump friends + refresh feed (server already deleted the notification, so it won't return). Consistent. ✓
- `409 already_actioned`: shows inline "This request was already handled." for 1.4s, bumps friends, then drops + refreshes. Consistent. ✓
- Missing-`requestId` legacy rows: dropped locally + marked read (no dead bail). ✓ (And migration 022 now removes these at the source.)
- **[LOW] Non-409 error leaves no retry affordance.** On a generic failure the row's buttons are replaced by the text "Couldn't respond — try again", but the render shows that message **instead of** the buttons — so there's no button left to actually retry. Copy promises a retry the UI doesn't offer. _Proposed: clear `feedActioned[n.id]` after a short delay (restore the buttons) or surface the error as a toast and keep the buttons._
- **[LOW/negligible] Stale map entries.** `feedActioned` keeps a `"busy"` entry keyed by `notifId` after the row is removed on success — a tiny, unbounded-in-theory memory artifact per session. Cosmetic; clears on reload.

---

## 4. Font / CSS changes — CLEAN

- Exactly **one** external font load: the Google Fonts `@import` in `src/index.css` (Inter + Newsreader) — the established pattern. No other `@import url`, no `@font-face`, no `<link>` to a font CDN, no `fonts.gstatic` references. ✓
- If `fonts.googleapis.com` is unreachable, the `--font`/`--font-serif` stacks fall back to system fonts (`-apple-system`/Georgia). No layout break, no data leak (Google Fonts CSS receives no user data beyond the standard request). ✓ Purely cosmetic, as expected.

---

## 5. Age-gate signup — CLEAN

- **Server-side block is authoritative and on every path.** In `POST /api/auth/verify-otp` (`type==="signup"`), before `supabase.auth.admin.createUser`: missing/empty/un-parseable/future `dateOfBirth` → **400** (no account); computed age `< 13` → **403** (no account). `createUser` only runs after both pass. ✓
- **Cannot bypass by calling the endpoint directly without DOB** — the missing-DOB branch returns 400 before any user creation. ✓
- **No alternate signup path.** `grep` finds **no** client-side `supabase.auth.signUp` anywhere in `src/`; the OTP/`admin.createUser` server flow is the only way to create an account, so the gate can't be sidestepped with the anon key. ✓
- _Inherent limitation (not a code flaw): the DOB is self-attested and can be falsified — standard for a neutral COPPA age screen; the gate correctly blocks an honest under-13 and all malformed/missing input._

---

## Recommended follow-ups (by impact)
1. **(MEDIUM) Harden the renewal worker against multi-instance double-send** — conditional update / single-worker / advisory lock — before scaling Railway past one instance.
2. **(LOW) Make `pushNotification` surface success/failure** so the renewal worker only marks `reminder_sent_for_period` when the notification actually landed (fixes both the under-send and enables conditional idempotency).
3. **(LOW) Compare renewal timestamps by epoch**, not string equality.
4. **(LOW) Fix the feed responder's non-409 error** to keep/restore a retry button (or toast).
5. **(LOW, optional) Dedup repeat `payment_failed` notifications** across dunning attempts.

_No code was modified by this audit; AUDIT2.md is the only addition._
