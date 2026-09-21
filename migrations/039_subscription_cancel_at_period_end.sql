-- A subscription cancelled through the Stripe billing portal keeps
-- status="active" until the paid period runs out, which is correct: the
-- customer paid for that period. But the app had no idea it was ending, so
-- Settings kept saying "Next billing on <date>" for a subscription that will
-- never bill again — the one place wording like that really matters.
--
-- Stripe is the source of truth; this column mirrors sub.cancel_at_period_end
-- so the UI can say "Cancels on <date>" without a round trip to Stripe.
alter table subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;
