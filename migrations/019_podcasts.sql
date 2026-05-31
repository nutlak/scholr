-- 019: Podcast Mode — AI two-host audio overviews per notebook
-- Pro-gated; one row per generated episode. transcript is the parsed
-- {speaker, text}[] from the Claude script, kept for the "Show transcript"
-- UI and as a fallback if the audio_url stops resolving.

CREATE TABLE IF NOT EXISTS podcasts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id      uuid NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  created_by       uuid NOT NULL REFERENCES auth.users(id),
  title            text NOT NULL,
  audio_url        text,
  duration_seconds int,
  length_preset    text DEFAULT 'standard',  -- quick | standard | deep
  format_preset    text DEFAULT 'casual',    -- casual | examcram | eli5 | debate
  focus_topic      text,
  status           text DEFAULT 'generating', -- generating | ready | failed
  error_message    text,
  transcript       jsonb,                    -- [{speaker:'alex'|'sam', text:string}]
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_podcasts_notebook ON podcasts(notebook_id);
CREATE INDEX IF NOT EXISTS idx_podcasts_created  ON podcasts(notebook_id, created_at DESC);
