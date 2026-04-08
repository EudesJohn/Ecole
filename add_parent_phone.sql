-- ==========================================
-- ADD TELEPHONE_PARENT TO STUDENTS TABLE
-- ==========================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS telephone_parent TEXT;

COMMENT ON COLUMN students.telephone_parent IS 'Phone number of the student parent for administrative contact.';
