# School Deletion Instructions

## Overview

This document provides instructions for deleting a school and all its associated data from the multi-tenant school management system.

## Important Warnings

⚠️ **WARNING**: Deleting a school is **IRREVERSIBLE**. All data associated with the school will be permanently deleted, including:
- All classes, students, and teachers
- All grades, absences, and lesson plans
- All school configuration
- All user accounts (admin, teacher, parent)

⚠️ **BACKUP FIRST**: Before proceeding, ensure you have a complete database backup.

## Files Created

1. **`delete_school_with_data.sql`** - Generic script for deleting any school
2. **`delete_slb_school.sql`** - Specific script for deleting Saint Lambert (SLB)

## Deletion Process

### Option 1: Using the Generic Script (for any school)

1. Open `delete_school_with_data.sql` in a text editor
2. Replace `'SCHOOL_ABREV'` with the actual school abbreviation (e.g., 'SLB')
3. Execute the script in Supabase SQL Editor (dry run mode)
4. Review the output to confirm what will be deleted
5. To actually delete:
   - Uncomment the deletion function or DELETE statements
   - Remove the ROLLBACK line
   - Execute the script again

### Option 2: Using the SLB-Specific Script

1. Open `delete_slb_school.sql` in a text editor
2. Execute the script in Supabase SQL Editor (dry run mode)
3. Review the output showing counts of all data that will be deleted
4. To actually delete:
   - Uncomment all DELETE statements
   - Remove the ROLLBACK line
   - Execute the script again

### Option 3: Manual Deletion (Step-by-Step)

If you prefer more control, delete data in this order:

```sql
BEGIN;

-- 1. Delete child records first (due to foreign key constraints)
DELETE FROM grades WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
DELETE FROM absences WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');
DELETE FROM cahier_texte WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 2. Delete subjects (matieres)
DELETE FROM matieres WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 3. Delete students
DELETE FROM students WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 4. Delete classes
DELETE FROM classes WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 5. Delete school configuration
DELETE FROM school_config_mt WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 6. Delete user profiles (this deletes all admin, teacher, and parent accounts)
DELETE FROM profiles WHERE school_id = (SELECT id FROM schools WHERE abreviation = 'SCHOOL_ABREV');

-- 7. Finally, delete the school record
DELETE FROM schools WHERE abreviation = 'SCHOOL_ABREV';

COMMIT;
```

## Post-Deletion Steps

After deleting a school:

1. **Verify deletion**: Check that the school no longer appears in the schools table
2. **Update frontend**: If the deleted school was hardcoded anywhere (e.g., SLB references), update the frontend code
3. **Notify users**: Inform any remaining super admins about the deletion
4. **Monitor system**: Check for any errors in the application logs

## Files That Reference SLB (Saint Lambert)

If you deleted SLB, you may want to review these files for hardcoded references:

- `Frontend/api/utils/generateMatricule.js` - Default school abbreviation
- `Frontend/api/routes/admin.js` - Fallback school abbreviation
- Various frontend components that may have SLB-specific logic

## Troubleshooting

### Error: "Cannot delete because of foreign key constraints"

If you encounter foreign key errors, ensure you're deleting in the correct order (child tables first, then parent tables).

### Error: "School not found"

Verify the school abbreviation exists in the schools table:
```sql
SELECT * FROM schools WHERE abreviation = 'YOUR_ABBREV';
```

### Partial deletion

If the script fails mid-execution, check which tables were affected and manually delete remaining data.

## Support

For assistance with school deletion, contact the system administrator or database administrator.
