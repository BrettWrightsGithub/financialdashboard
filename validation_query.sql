-- ============================================================
-- COMPREHENSIVE VALIDATION FOR BATCH TABLE REFERENCE FIX
-- ============================================================

-- Create a temporary table to store validation results
CREATE TEMP TABLE validation_results AS
SELECT 'TABLE_EXISTS_CHECK' as check_type,
       CASE 
         WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_batches') 
         THEN 'PASS: category_batches table exists'
         ELSE 'FAIL: category_batches table missing'
       END as result

UNION ALL

SELECT 'ORPHANED_AUDIT_RULE_BATCHES' as check_type,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM category_audit_log cal
           LEFT JOIN rule_application_batches rab ON cal.batch_id = rab.id
           WHERE cal.batch_id IS NOT NULL AND rab.id IS NULL
           LIMIT 1
         )
         THEN 'FAIL: Found audit_log entries with batch_ids not in rule_application_batches'
         ELSE 'PASS: No orphaned audit_log entries relative to rule_application_batches'
       END as result

UNION ALL

SELECT 'ORPHANED_AUDIT_CATEGORY_BATCHES' as check_type,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM category_audit_log cal
           LEFT JOIN category_batches cb ON cal.batch_id = cb.id
           WHERE cal.batch_id IS NOT NULL AND cb.id IS NULL
           LIMIT 1
         )
         THEN 'FAIL: Found audit_log entries with batch_ids not in category_batches'
         ELSE 'PASS: No orphaned audit_log entries relative to category_batches'
       END as result

UNION ALL

SELECT 'RULE_BATCHES_COUNT' as check_type,
       'rule_application_batches count: ' || CAST(COUNT(*) AS TEXT) as result
FROM rule_application_batches

UNION ALL

SELECT 'CATEGORY_BATCHES_COUNT' as check_type,
       'category_batches count: ' || CAST(COUNT(*) AS TEXT) as result
FROM category_batches

UNION ALL

SELECT 'RECENT_RULE_BATCHES' as check_type,
       'rule_application_batches recent (7d): Checking table structure' as result
FROM rule_application_batches 
LIMIT 1

UNION ALL

SELECT 'RECENT_CATEGORY_BATCHES' as check_type,
       'category_batches recent (7d): Checking table structure' as result
FROM category_batches 
LIMIT 1

UNION ALL

SELECT 'FUNCTION_DEPENDENCIES_RULE' as check_type,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM pg_proc 
           WHERE prosrc LIKE '%rule_application_batches%'
           AND proname != 'fn_run_categorization_waterfall'
         )
         THEN 'FAIL: Other functions reference rule_application_batches'
         ELSE 'PASS: No other functions reference rule_application_batches'
       END as result

UNION ALL

SELECT 'FUNCTION_DEPENDENCIES_CATEGORY' as check_type,
       CASE 
         WHEN EXISTS (
           SELECT 1 FROM pg_proc 
           WHERE prosrc LIKE '%category_batches%'
           AND proname != 'fn_run_categorization_waterfall'
         )
         THEN 'INFO: Other functions reference category_batches'
         ELSE 'PASS: No other functions reference category_batches'
       END as result;

-- Display validation results
SELECT * FROM validation_results ORDER BY 
  CASE WHEN result LIKE 'FAIL%' THEN 1 
       WHEN result LIKE 'INFO%' THEN 2 
       ELSE 3 END,
  check_type;

-- Check table structures
SELECT 'RULE_BATCHES_STRUCTURE' as info_type,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'rule_application_batches'
ORDER BY ordinal_position

UNION ALL

SELECT 'CATEGORY_BATCHES_STRUCTURE' as info_type,
       column_name,
       data_type,
       is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'category_batches'
ORDER BY ordinal_position;

-- Detailed orphaned data (if any)
SELECT 'ORPHANED_IN_RULE_BATCHES' as detail_type,
       cal.batch_id,
       COUNT(*) as count
FROM category_audit_log cal
LEFT JOIN rule_application_batches rab ON cal.batch_id = rab.id
WHERE cal.batch_id IS NOT NULL AND rab.id IS NULL
GROUP BY cal.batch_id

UNION ALL

SELECT 'ORPHANED_IN_CATEGORY_BATCHES' as detail_type,
       cal.batch_id,
       COUNT(*) as count
FROM category_audit_log cal
LEFT JOIN category_batches cb ON cal.batch_id = cb.id
WHERE cal.batch_id IS NOT NULL AND cb.id IS NULL
GROUP BY cal.batch_id

ORDER BY detail_type, count DESC;
