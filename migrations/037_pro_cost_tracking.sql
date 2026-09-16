-- Run this in Supabase Dashboard SQL Editor.
-- Soft monthly cost tripwire for Pro accounts — tracks real Claude API $
-- spend per user so a runaway cram-session doesn't silently erode margin.
ALTER TABLE usage ADD COLUMN IF NOT EXISTS pro_cost_cents_this_month int DEFAULT 0;
ALTER TABLE usage ADD COLUMN IF NOT EXISTS cost_alert_sent_this_month boolean DEFAULT false;
