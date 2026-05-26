USE trialmatch_db;

CREATE OR REPLACE VIEW trial_summary_view AS
SELECT
  t.trial_id,
  t.nct_id,
  t.brief_title,
  p.phase_name,
  s.status_name,
  st.study_type_name,
  sex.sex_name,
  COUNT(DISTINCT tc.condition_id) AS condition_count,
  COUNT(DISTINCT ti.intervention_id) AS intervention_count,
  COUNT(DISTINCT ec.criteria_id) AS criteria_count,
  t.minimum_age,
  t.maximum_age,
  t.enrollment_count,
  t.is_archived
FROM trials t
LEFT JOIN trial_phases p ON t.phase_id = p.phase_id
LEFT JOIN trial_statuses s ON t.status_id = s.status_id
LEFT JOIN study_types st ON t.study_type_id = st.study_type_id
LEFT JOIN sex_eligibilities sex ON t.sex_id = sex.sex_id
LEFT JOIN trial_conditions tc ON t.trial_id = tc.trial_id
LEFT JOIN trial_interventions ti ON t.trial_id = ti.trial_id
LEFT JOIN eligibility_criteria ec ON t.trial_id = ec.trial_id
GROUP BY
  t.trial_id, t.nct_id, t.brief_title, p.phase_name, s.status_name,
  st.study_type_name, sex.sex_name, t.minimum_age, t.maximum_age,
  t.enrollment_count, t.is_archived;

CREATE OR REPLACE VIEW eligibility_complexity_view AS
SELECT
  t.trial_id,
  t.nct_id,
  t.brief_title,
  COUNT(ec.criteria_id) AS total_criteria,
  SUM(CASE WHEN ec.criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
  SUM(CASE WHEN ec.criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
  ROUND(AVG(ec.text_length), 2) AS avg_text_length,
  ROUND(AVG(ec.complexity_score), 2) AS avg_complexity_score,
  SUM(CASE WHEN ec.requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
FROM trials t
LEFT JOIN eligibility_criteria ec ON t.trial_id = ec.trial_id
GROUP BY t.trial_id, t.nct_id, t.brief_title;