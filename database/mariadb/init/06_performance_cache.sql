USE trialmatch_db;

-- ============================================================
-- Performance cache refresh
-- This file intentionally does NOT create indexes. All indexes are
-- centralized in 03_indexes.sql to avoid redundant and confusing
-- duplicate index definitions.
--
-- Run this file after full ETL import to rebuild
-- dashboard/search aggregates. It is safe as a no-op on an empty database.
-- ============================================================

REPLACE INTO trial_search_cache (
  trial_id,
  condition_count,
  intervention_count,
  criteria_count,
  inclusion_count,
  exclusion_count,
  avg_complexity_score,
  manual_review_count,
  updated_at
)
SELECT
  t.trial_id,
  COALESCE(tc.condition_count, 0) AS condition_count,
  COALESCE(ti.intervention_count, 0) AS intervention_count,
  COALESCE(ec.criteria_count, 0) AS criteria_count,
  COALESCE(ec.inclusion_count, 0) AS inclusion_count,
  COALESCE(ec.exclusion_count, 0) AS exclusion_count,
  ec.avg_complexity_score,
  COALESCE(ec.manual_review_count, 0) AS manual_review_count,
  CURRENT_TIMESTAMP AS updated_at
FROM trials t
LEFT JOIN (
  SELECT trial_id, COUNT(*) AS condition_count
  FROM trial_conditions
  GROUP BY trial_id
) tc ON t.trial_id = tc.trial_id
LEFT JOIN (
  SELECT trial_id, COUNT(*) AS intervention_count
  FROM trial_interventions
  GROUP BY trial_id
) ti ON t.trial_id = ti.trial_id
LEFT JOIN (
  SELECT
    trial_id,
    COUNT(*) AS criteria_count,
    SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
    SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
    ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
    SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
  FROM eligibility_criteria
  GROUP BY trial_id
) ec ON t.trial_id = ec.trial_id;

REPLACE INTO condition_summary_cache (
  condition_id,
  trial_count,
  updated_at
)
SELECT
  c.condition_id,
  COUNT(tc.trial_id) AS trial_count,
  CURRENT_TIMESTAMP AS updated_at
FROM conditions c
LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
GROUP BY c.condition_id;
