-- 027_upgrade_trigger.sql
-- Track which limit triggered a contextual upgrade prompt (conversion analytics).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS upgrade_trigger TEXT;
