-- ==========================================
-- ADD FLEXIBLE COMPOSITIONS STORAGE
-- ==========================================

ALTER TABLE grades ADD COLUMN IF NOT EXISTS compositions JSONB DEFAULT '[]';

-- Optional: Comments
COMMENT ON COLUMN grades.compositions IS 'Array of grades for Primary/Maternelle cycles';
