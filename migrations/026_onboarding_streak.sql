-- 026_onboarding_streak.sql
-- Profile flags for the onboarding wizard + streak gamification (wave 2).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS streak_milestones_shown TEXT[] DEFAULT '{}';
