-- Ajouter les colonnes pour la restriction d'écoles
ALTER TABLE schools
ADD COLUMN IF NOT EXISTS restricted_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restriction_reason TEXT,
ADD COLUMN IF NOT EXISTS restricted_at TIMESTAMPTZ;
