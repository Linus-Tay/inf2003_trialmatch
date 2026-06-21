USE trialmatch_db;

-- ============================================================
-- SQL views for reporting, demos, and readable database evidence.
-- Views make complex joins explainable without hiding the base
-- schema. Cache-backed views avoid recalculating heavy aggregates
-- from 825k+ criteria rows during every dashboard request.
-- ============================================================

CREATE OR REPLACE VIEW trial_summary_view AS
SELECT
  t.trial_id,
  t.nct_id,
  t.brief_title,
  p.phase_name,
  s.status_name,
  s.is_open_to_recruitment,
  st.study_type_name,
  sex.sex_name,
  t.minimum_age,
  t.maximum_age,
  t.healthy_volunteers,
  COALESCE(cache.condition_count, 0) AS condition_count,
  COALESCE(cache.intervention_count, 0) AS intervention_count,
  COALESCE(cache.criteria_count, 0) AS criteria_count,
  COALESCE(cache.inclusion_count, 0) AS inclusion_count,
  COALESCE(cache.exclusion_count, 0) AS exclusion_count,
  cache.avg_complexity_score,
  COALESCE(cache.manual_review_count, 0) AS manual_review_count,
  meta.criteria_split_status,
  meta.has_eligibility_criteria,
  t.source_url,
  t.is_archived,
  t.updated_at
FROM trials t
LEFT JOIN trial_phases p ON t.phase_id = p.phase_id
LEFT JOIN trial_statuses s ON t.status_id = s.status_id
LEFT JOIN study_types st ON t.study_type_id = st.study_type_id
LEFT JOIN sex_eligibilities sex ON t.sex_id = sex.sex_id
LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
LEFT JOIN trial_source_metadata meta ON t.trial_id = meta.trial_id;

CREATE OR REPLACE VIEW eligibility_complexity_view AS
SELECT
  t.trial_id,
  t.nct_id,
  t.brief_title,
  COALESCE(cache.criteria_count, 0) AS total_criteria,
  COALESCE(cache.inclusion_count, 0) AS inclusion_count,
  COALESCE(cache.exclusion_count, 0) AS exclusion_count,
  cache.avg_complexity_score,
  COALESCE(cache.manual_review_count, 0) AS manual_review_count,
  meta.eligibility_criteria_length AS source_total_eligibility_length,
  meta.inclusion_criteria_length AS source_inclusion_length,
  meta.exclusion_criteria_length AS source_exclusion_length
FROM trials t
LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
LEFT JOIN trial_source_metadata meta ON t.trial_id = meta.trial_id;

CREATE OR REPLACE VIEW condition_trial_stats_view AS
SELECT
  c.condition_id,
  c.condition_name,
  c.normalised_name,
  c.condition_category,
  COALESCE(cache.trial_count, 0) AS trial_count
FROM conditions c
LEFT JOIN condition_summary_cache cache ON c.condition_id = cache.condition_id;

CREATE OR REPLACE VIEW criteria_distribution_view AS
SELECT
  criteria_type,
  requires_manual_review,
  COUNT(*) AS criteria_count,
  ROUND(AVG(text_length), 2) AS avg_text_length,
  ROUND(AVG(complexity_score), 2) AS avg_complexity_score
FROM eligibility_criteria
GROUP BY criteria_type, requires_manual_review;

CREATE OR REPLACE VIEW trial_data_quality_view AS
SELECT
  t.trial_id,
  t.nct_id,
  t.brief_title,
  CASE WHEN t.phase_id IS NULL THEN TRUE ELSE FALSE END AS missing_phase,
  CASE WHEN t.status_id IS NULL THEN TRUE ELSE FALSE END AS missing_status,
  CASE WHEN t.minimum_age IS NULL AND t.maximum_age IS NULL THEN TRUE ELSE FALSE END AS missing_age_range,
  CASE WHEN t.healthy_volunteers IS NULL THEN TRUE ELSE FALSE END AS missing_healthy_volunteer_flag,
  CASE WHEN COALESCE(cache.criteria_count, 0) = 0 THEN TRUE ELSE FALSE END AS no_imported_criteria,
  meta.criteria_split_status,
  meta.has_eligibility_criteria,
  meta.eligibility_criteria_length,
  COALESCE(cache.criteria_count, 0) AS imported_criteria_count,
  COALESCE(cache.manual_review_count, 0) AS manual_review_count
FROM trials t
LEFT JOIN trial_search_cache cache ON t.trial_id = cache.trial_id
LEFT JOIN trial_source_metadata meta ON t.trial_id = meta.trial_id;

CREATE OR REPLACE VIEW duplicate_criteria_view AS
SELECT
  trial_id,
  criteria_type,
  LEFT(criteria_text, 500) AS criteria_text_sample,
  COUNT(*) AS duplicate_count
FROM eligibility_criteria
GROUP BY trial_id, criteria_type, LEFT(criteria_text, 500)
HAVING COUNT(*) > 1;

CREATE OR REPLACE VIEW patient_match_summary_view AS
SELECT
  m.match_id,
  pp.patient_profile_id,
  pp.profile_name,
  pp.age,
  pse.sex_name AS patient_sex,
  t.trial_id,
  t.nct_id,
  t.brief_title,
  tse.sex_name AS trial_sex,
  t.minimum_age,
  t.maximum_age,
  t.healthy_volunteers,
  m.structured_match_passed,
  m.criteria_review_required,
  m.match_score,
  m.match_status,
  m.matched_at
FROM patient_trial_matches m
JOIN patient_profiles pp ON m.patient_profile_id = pp.patient_profile_id
JOIN trials t ON m.trial_id = t.trial_id
LEFT JOIN sex_eligibilities pse ON pp.sex_id = pse.sex_id
LEFT JOIN sex_eligibilities tse ON t.sex_id = tse.sex_id;
