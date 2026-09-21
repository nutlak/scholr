# Testing billing without real money

Live Stripe is on Railway only and must stay there. Local runs in **test mode**,
a separate Stripe world: separate keys, customers, prices, and cards that never
move money.

The 2026-09-16 outage — a live price id that did not exist, and a webhook with
no `checkout.session.completed` — survived weeks of green builds because nobody
had run a checkout end to end. This is how you run one.

## Setup (already done on this machine)

`server/.env` holds the test key, the two test price ids and a webhook secret.
It is gitignored. Never put a live key there: a live price id sitting next to a
test secret key is exactly what caused the outage above.

| Plan  | Test price id                     | Amount |
|-------|-----------------------------------|--------|
| Pro   | `price_1UIGN0L1rN0GosQGjvX65he8`  | $8.49  |
| Squad | `price_1UIGN1L1rN0GosQGj8qdP4QL`  | $24.99 |

## Running a checkout

1. Forward webhooks (the CLI now requires `--events`):

```
stripe listen \
  --events checkout.session.completed,customer.subscription.updated,customer.subscription.deleted,invoice.payment_failed \
  --forward-to localhost:3001/api/webhooks/stripe
```

2. Put the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET` in `server/.env`
   and restart the API with `DISABLE_WORKERS=1`.

3. Check `/api/health` reports `pro: true, squad: true`. If not, the keys are
   not loaded and every billing CTA will look live and die on click.

4. Sign up a throwaway account, upgrade, pay with `4242 4242 4242 4242`,
   any future expiry, any CVC and ZIP.

Use a throwaway account, not your own: local runs against the **production**
Supabase, so a checkout on your own account rewrites your real subscription row.

## What to check

- `[stripe] checkout.session.completed: user=… → pro` in the server log
- `/api/user/subscription` returns `tier: "pro"`
- a second `POST /api/create-checkout-session` returns 400 `already_subscribed`
- cancelling at period end leaves `tier: "pro"` with `cancelAtPeriodEnd: true`,
  and Settings reads "Pro ends on <date>" rather than "Next billing on <date>"

## Cleanup

Delete the throwaway user and its `subscriptions` / `usage` rows afterwards —
production Supabase, real rows.
