-- Persistent shared chat history per notebook
CREATE TABLE messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid        NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  role        text        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     text        NOT NULL,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid        REFERENCES auth.users(id)
);

CREATE INDEX idx_messages_notebook_id ON messages(notebook_id);
