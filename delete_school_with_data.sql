-- ============================================================
-- SCRIPT: DELETE SCHOOL WITH ALL RELATED DATA
-- Usage: Execute in Supabase SQL Editor
-- This script deletes a school and ALL its associated data across all tables
-- WARNING: This is IRREVERSIBLE - all data will be permanently deleted
-- ============================================================

-- ==============================
-- PARAMETERS - SET THESE BEFORE EXECUTING
-- ==============================
-- Replace 'SCHOOL_ABREV' with the school abbreviation to delete (e.g., 'SLB')
-- Replace 'School Name' with the actual school name for confirmation

BEGIN;

-- Safety check: Verify the school exists and get its ID
DO $$
DECLARE
  v_school_id UUID;
  v_school_name TEXT;
  v_confirmation TEXT := 'I UNDERSTAND THIS WILL PERMANENTLY DELETE ALL DATA FOR ';
  v_school_abrev TEXT := 'SCHOOL_ABREV'; -- CHANGE THIS TO THE SCHOOL ABBREVIATION
BEGIN
  -- Get the school ID and name
  SELECT id, nom INTO v_school_id, v_school_name
  FROM schools
  WHERE abreviation = v_school_abrev;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School with abbreviation % not found', v_school_abrev;
  END IF;

  RAISE NOTICE 'PREPARING TO DELETE SCHOOL: % (ID: %)', v_school_name, v_school_id;
  RAISE NOTICE 'This will delete ALL related data including:';
  RAISE NOTICE '  - All classes, students, teachers, parents';
  RAISE NOTICE '  - All grades, absences, lesson plans';
  RAISE NOTICE '  - All school configuration';
  RAISE NOTICE ' ';
  RAISE NOTICE 'THIS ACTION IS IRREVERSIBLE!';

  -- Uncomment the following line to actually perform the deletion
  -- PERFORM delete_school_cascade(v_school_id);

  RAISE NOTICE ' ';
  RAISE NOTICE 'DRY RUN COMPLETE. To actually delete, uncomment the PERFORM line above.';
END$$;

-- Rollback for safety - remove this line to actually execute
ROLLBACK;

-- ==============================
-- ACTUAL DELETION FUNCTION (commented out for safety)
-- Uncomment this entire block when ready to execute
-- ==============================

-- CREATE OR REPLACE FUNCTION delete_school_cascade(p_school_id UUID)
-- RETURNS VOID AS $$
-- DECLARE
--   v_count INTEGER;
-- BEGIN
--   RAISE NOTICE 'Starting deletion of school ID: %', p_school_id;
--
--   -- 1. Delete from tables with CASCADE (automatic due to FK constraints)
--   RAISE NOTICE 'Deleting grades...';
--   DELETE FROM grades WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % grades', v_count;
--
--   RAISE NOTICE 'Deleting absences...';
--   DELETE FROM absences WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % absences', v_count;
--
--   RAISE NOTICE 'Deleting cahier_texte...';
--   DELETE FROM cahier_texte WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % lesson entries', v_count;
--
--   -- 2. Delete matieres (subjects) - this will cascade to related data
--   RAISE NOTICE 'Deleting matieres...';
--   DELETE FROM matieres WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % subjects', v_count;
--
--   -- 3. Delete students
--   RAISE NOTICE 'Deleting students...';
--   DELETE FROM students WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % students', v_count;
--
--   -- 4. Delete classes
--   RAISE NOTICE 'Deleting classes...';
--   DELETE FROM classes WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % classes', v_count;
--
--   -- 5. Delete school_config_mt entries
--   RAISE NOTICE 'Deleting school configuration...';
--   DELETE FROM school_config_mt WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % config entries', v_count;
--
--   -- 6. Delete profiles (users) associated with this school
--   -- Note: This will delete admin, teacher, and parent accounts
--   RAISE NOTICE 'Deleting profiles...';
--   DELETE FROM profiles WHERE school_id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % user profiles', v_count;
--
--   -- 7. Finally, delete the school itself
--   RAISE NOTICE 'Deleting school record...';
--   DELETE FROM schools WHERE id = p_school_id;
--   GET DIAGNOSTICS v_count = ROW_COUNT;
--   RAISE NOTICE '  Deleted % school record(s)', v_count;
--
--   RAISE NOTICE 'School deletion completed successfully!';
-- END;
-- $$ LANGUAGE plpgsql;

-- ==============================
-- ALTERNATIVE: Table-by-table deletion with counts (more controlled)
-- ==============================

-- To use this approach, uncomment and execute each section one by one

-- First, check what will be deleted:
-- SELECT 'Grades', COUNT(*) FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Absences', COUNT(*) FROM absences WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Cahier de texte', COUNT(*) FROM cahier_texte WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Matieres', COUNT(*) FROM matieres WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Students', COUNT(*) FROM students WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Classes', COUNT(*) FROM classes WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- SELECT 'Profiles', COUNT(*) FROM profiles WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- Then delete in the correct order (due to foreign key constraints):
-- DELETE FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM absences WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM cahier_texte WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM matieres WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM students WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM classes WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM school_config_mt WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM profiles WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
-- DELETE FROM schools WHERE abreviation = 'SCHOOL_ABREV';

-- ==============================
-- INSTRUCTIONS FOR USE:
-- ==============================
-- 1. Replace 'SCHOOL_ABREV' with the actual school abbreviation (e.g., 'SLB')
-- 2. Review the script and understand what will be deleted
-- 3. Execute the script in dry-run mode first (as is)
-- 4. To actually delete, either:
--    a) Uncomment the PERFORM line in the first DO block, OR
--    b) Uncomment the delete_school_cascade function and the PERFORM line, OR
--    c) Execute the alternative table-by-table deletions at the bottom
-- 5. Remove the ROLLBACK line when ready to execute
-- 6. Consider backing up your database before executing this script
