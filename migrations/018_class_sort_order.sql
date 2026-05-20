-- 018: add per-user ordering for classes (drag-to-reorder on dashboard)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
UPDATE classes SET sort_order = 0 WHERE sort_order IS NULL;
