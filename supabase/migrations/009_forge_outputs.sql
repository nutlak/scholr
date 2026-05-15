-- forge_outputs: study materials generated and saved by The Forge
CREATE TABLE forge_outputs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('study_guide', 'questions', 'flashcards', 'summary')),
  title       text        NOT NULL,
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_forge_outputs_notebook ON forge_outputs(notebook_id, created_at DESC);
CREATE INDEX idx_forge_outputs_user ON forge_outputs(user_id);
