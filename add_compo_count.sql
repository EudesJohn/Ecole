-- ==========================================
-- ADD COMPO_COUNT TO CLASSES
-- ==========================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS compo_count INTEGER DEFAULT 3;

-- Comment to documentation
COMMENT ON COLUMN classes.compo_count IS 'Number of compositions for primary/maternelle cycles';
