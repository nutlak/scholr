-- 036_assessment_type.sql
-- "What kind of thing is this unit" (exam, quiz, homework, project, reading)
-- alongside the existing due_date/status columns, so the class syllabus view
-- can show more than just a date. Free text, not an enum — assessment
-- vocabulary varies too much by course/teacher to lock down server-side, and
-- the client offers a fixed picker anyway.

ALTER TABLE notebooks ADD COLUMN IF NOT EXISTS assessment_type TEXT;
