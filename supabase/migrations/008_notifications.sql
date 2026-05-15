-- Activity log + per-user notifications for Scholr
CREATE TABLE activities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid        REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id     uuid        REFERENCES auth.users(id),
  action      text        NOT NULL,
  description text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_id uuid        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  is_read     boolean     DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX idx_activities_notebook ON activities(notebook_id);
CREATE INDEX idx_notifications_user   ON notifications(user_id, is_read);
