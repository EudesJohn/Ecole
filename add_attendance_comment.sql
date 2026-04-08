-- ==========================================
-- ADD COMMENTAIRE TO ABSENCES TABLE
-- ==========================================

ALTER TABLE absences ADD COLUMN IF NOT EXISTS commentaire TEXT;

COMMENT ON COLUMN absences.commentaire IS 'Teacher comments or notifications for parents and administration during attendance.';
