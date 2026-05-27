-- ============================================================
-- SCRIPT: DELETE SAINT LAMBERT SCHOOL (SLB) WITH ALL DATA
-- Specific script to delete the Saint Lambert school and all its data
-- WARNING: This is IRREVERSIBLE - all SLB data will be permanently deleted
-- ============================================================

BEGIN;

-- ==============================
-- SAFETY CHECKS AND DRY RUN
-- ==============================

DO $$
DECLARE
  v_school_id UUID;
  v_school_name TEXT;
  v_grades_count INTEGER;
  v_absences_count INTEGER;
  v_cahier_count INTEGER;
  v_matieres_count INTEGER;
  v_students_count INTEGER;
  v_classes_count INTEGER;
  v_profiles_count INTEGER;
BEGIN
  -- Get the school information
  SELECT id, nom INTO v_school_id, v_school_name
  FROM schools
  WHERE abreviation = 'SLB';

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'School SLB not found!';
  END IF;

  -- Count all related data
  SELECT COUNT(*) INTO v_grades_count FROM grades WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_absences_count FROM absences WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_cahier_count FROM cahier_texte WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_matieres_count FROM matieres WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_students_count FROM students WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_classes_count FROM classes WHERE school_id = v_school_id;
  SELECT COUNT(*) INTO v_profiles_count FROM profiles WHERE school_id = v_school_id;

  RAISE NOTICE '=================================================';
  RAISE NOTICE 'DRY RUN: Data that will be deleted for % (SLB)', v_school_name;
  RAISE NOTICE '=================================================';
  RAISE NOTICE 'School ID: %', v_school_id;
  RAISE NOTICE '  - Grades: % records', v_grades_count;
  RAISE NOTICE '  - Absences: % records', v_absences_count;
  RAISE NOTICE '  - Cahier de texte: % records', v_cahier_count;
  RAISE NOTICE '  - Matieres (subjects): % records', v_matieres_count;
  RAISE NOTICE '  - Students: % records', v_students_count;
  RAISE NOTICE '  - Classes: % records', v_classes_count;
  RAISE NOTICE '  - Profiles (users): % records', v_profiles_count;
  RAISE NOTICE ' ';
  RAISE NOTICE 'THIS ACTION IS IRREVERSIBLE!';
  RAISE NOTICE 'All data for Saint Lambert school will be permanently deleted.';
  RAISE NOTICE ' ';
  RAISE NOTICE 'To proceed with actual deletion:';
  RAISE NOTICE '1. Remove the ROLLBACK line at the end of this script';
  RAISE NOTICE '2. Uncomment the DELETE statements below';
  RAISE NOTICE '3. Execute the script';
  RAISE NOTICE '=================================================';
END$$;

-- ==============================
-- ACTUAL DELETION (COMMENTED OUT FOR SAFETY)
-- Uncomment these lines to actually delete the data
-- ==============================

-- RAISE NOTICE 'Starting deletion of Saint Lambert school (SLB)...';

-- Delete from tables in the correct order (child tables first)
-- DELETE FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all grades for SLB';

-- DELETE FROM absences WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all absences for SLB';

-- DELETE FROM cahier_texte WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all cahier_texte entries for SLB';

-- DELETE FROM matieres WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all matieres for SLB';

-- DELETE FROM students WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all students for SLB';

-- DELETE FROM classes WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all classes for SLB';

-- DELETE FROM school_config_mt WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all school configuration for SLB';

-- DELETE FROM profiles WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SLB');
-- RAISE NOTICE 'Deleted all profiles for SLB';

-- Finally, delete the school itself
-- DELETE FROM schools WHERE abreviation = 'SLB';
-- RAISE NOTICE 'Deleted Saint Lambert school record';

-- RAISE NOTICE 'All SLB data has been successfully deleted!';

-- ==============================
-- ROLLBACK FOR SAFETY
-- Remove this line when ready to actually delete
-- ==============================

ROLLBACK;

-- ==============================
-- INSTRUCTIONS:
-- ==============================
-- 1. Execute this script as-is to see what will be deleted (dry run)
-- 2. If you're sure you want to proceed:
--    a. Remove the ROLLBACK line above
--    b. Uncomment all the DELETE statements
--    c. Execute the script again
-- 3. Consider backing up your database before executing this script
-- 4. This action cannot be undone!
