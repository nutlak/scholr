-- ============================================================
-- Scholr Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Notebooks
CREATE TABLE notebooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  topic         TEXT,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_token  TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Notes (text content + optional file URL)
CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id   UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  uploader_id   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title         TEXT,
  content       TEXT,
  file_url      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Notebook membership + roles
CREATE TABLE notebook_members (
  notebook_id   UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (notebook_id, user_id)
);

-- ============================================================
-- Row-Level Security
-- ============================================================

ALTER TABLE notebooks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_members ENABLE ROW LEVEL SECURITY;

-- Helper: is the caller a member of this notebook?
CREATE OR REPLACE FUNCTION is_notebook_member(nb_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM notebook_members
    WHERE notebook_id = nb_id AND user_id = auth.uid()
  );
$$;

-- Helper: is the caller the owner of this notebook?
CREATE OR REPLACE FUNCTION is_notebook_owner(nb_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM notebook_members
    WHERE notebook_id = nb_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- notebooks: members can read; owners can update/delete
CREATE POLICY "members can read notebooks"
  ON notebooks FOR SELECT USING (is_notebook_member(id));

CREATE POLICY "owners can update notebooks"
  ON notebooks FOR UPDATE USING (is_notebook_owner(id));

CREATE POLICY "owners can delete notebooks"
  ON notebooks FOR DELETE USING (is_notebook_owner(id));

-- notes: members can read/insert; uploaders can delete their own
CREATE POLICY "members can read notes"
  ON notes FOR SELECT USING (is_notebook_member(notebook_id));

CREATE POLICY "members can insert notes"
  ON notes FOR INSERT WITH CHECK (is_notebook_member(notebook_id));

CREATE POLICY "uploaders can delete notes"
  ON notes FOR DELETE USING (uploader_id = auth.uid());

-- notebook_members: members can read; owners can insert/delete
CREATE POLICY "members can read membership"
  ON notebook_members FOR SELECT USING (is_notebook_member(notebook_id));

CREATE POLICY "owners can manage membership"
  ON notebook_members FOR INSERT WITH CHECK (is_notebook_owner(notebook_id));

CREATE POLICY "owners can remove members"
  ON notebook_members FOR DELETE USING (is_notebook_owner(notebook_id));

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX ON notes (notebook_id, created_at DESC);
CREATE INDEX ON notebook_members (user_id);
CREATE INDEX ON notebooks (invite_token);
