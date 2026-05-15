-- Starred / favorite notebooks per user
CREATE TABLE starred_notebooks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, notebook_id)
);

CREATE INDEX idx_starred_user ON starred_notebooks(user_id);
