-- Script de Données de Test (Seed) pour Saint Lambert ERP

-- 1. Insertion de Classes
INSERT INTO classes (nom, niveau, effectif) VALUES
('6ème A', '6ème', 35),
('5ème B', '5ème', 30),
('Terminale C', 'Terminale', 25)
ON CONFLICT (nom) DO NOTHING;

-- 2. Insertion de Matières (pour la 6ème A)
WITH cla AS (SELECT id FROM classes WHERE nom = '6ème A' LIMIT 1)
INSERT INTO matieres (nom, coefficient, classe_id)
SELECT m.nom, m.coeff, cla.id
FROM (VALUES 
  ('Mathématiques', 4),
  ('Français', 4),
  ('Anglais', 2),
  ('SVT', 2),
  ('Histoire-Géo', 2),
  ('Physique-Chimie', 2)
) as m(nom, coeff), cla
ON CONFLICT (nom, classe_id) DO NOTHING;

-- 3. Insertion d'Élèves (pour la 6ème A)
WITH cla AS (SELECT id FROM classes WHERE nom = '6ème A' LIMIT 1)
INSERT INTO students (matricule, prenom, nom, classe_id, sexe, date_naissance)
SELECT 
  '000' || n || ' SLB 26',
  p, 
  n_fam, 
  cla.id,
  s,
  d
FROM (VALUES 
  (1, 'Jean', 'KOUNDÉ', 'M', '2014-05-12'::date),
  (2, 'Marie', 'AGOSSOU', 'F', '2013-11-20'::date),
  (3, 'Idriss', 'SOSSOU', 'M', '2014-02-15'::date),
  (4, 'Sonia', 'N’CHO', 'F', '2015-01-10'::date),
  (5, 'Marc', 'TOHOUN', 'M', '2014-09-30'::date)
) as s_data(n, p, n_fam, s, d), cla
ON CONFLICT (matricule) DO NOTHING;

-- 4. Quelques notes de test (Optionnel)
-- Cela permettra de voir les calculs de moyennes immédiatement
WITH 
  stu AS (SELECT id FROM students WHERE nom = 'KOUNDÉ' LIMIT 1),
  mat AS (SELECT id FROM matieres WHERE nom = 'Mathématiques' LIMIT 1)
INSERT INTO grades (student_id, matiere_id, interro1, interro2, dw, composition, trimestre, school_year, evaluation_type)
SELECT stu.id, mat.id, 12, 14, 13, 11, 1, '2025-2026', 'etape'
FROM stu, mat
ON CONFLICT (student_id, matiere_id, trimestre, school_year, evaluation_type) DO NOTHING;
