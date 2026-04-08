-- ==========================================
-- SCRIPT DE REMISE À ZÉRO TOTALE (SITE NEUF)
-- ==========================================
-- Ce script vide toutes les données transactionnelles et les entités
-- Tout en préservant les comptes administrateurs.

BEGIN;

-- 1. Désactiver temporairement les contraintes pour faciliter le nettoyage
SET CONSTRAINTS ALL DEFERRED;

-- 2. Vider les tables de données (Transactionnelles)
TRUNCATE TABLE absences CASCADE;
TRUNCATE TABLE grades CASCADE;
TRUNCATE TABLE cahier_texte CASCADE;

-- 3. Vider les entités (Élèves, Matières, Classes)
TRUNCATE TABLE students CASCADE;
TRUNCATE TABLE matieres CASCADE;
TRUNCATE TABLE classes CASCADE;

-- 4. Nettoyer les profils (Garder uniquement les admins)
DELETE FROM profiles WHERE role != 'admin';

-- 5. Réinitialiser la séquence des matricules
ALTER SEQUENCE IF EXISTS matricule_seq RESTART WITH 1;

COMMIT;

-- Note : Les utilisateurs dans Supabase Auth (auth.users) resteront présents 
-- mais n'auront plus de profil lié, ni d'élèves rattachés.
-- Ils ne pourront plus se connecter ou verront un compte vide.
