-- Subscriptions: tracks tier and Stripe billing state per user
CREATE TABLE IF NOT EXISTS subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                  text NOT NULL DEFAULT 'free',
  stripe_customer_id    text,
  stripe_subscription_id text,
  current_period_end    timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

-- Usage: monthly counters per user; reset_at marks when counts next reset
CREATE TABLE IF NOT EXISTS usage (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  messages_this_month         int DEFAULT 0,
  forge_outputs_this_month    int DEFAULT 0,
  reset_at                    timestamptz DEFAULT date_trunc('month', now()) + interval '1 month',
  updated_at                  timestamptz DEFAULT now()
);
