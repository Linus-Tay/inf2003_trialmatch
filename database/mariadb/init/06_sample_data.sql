USE trialmatch_db;

INSERT INTO conditions (condition_name, normalised_name, condition_category) VALUES
('Diabetes Mellitus Type 2', 'diabetes mellitus type 2', 'Endocrine'),
('Hypertension', 'hypertension', 'Cardiovascular');

INSERT INTO interventions (intervention_name, intervention_type, normalised_name) VALUES
('Lifestyle Intervention', 'Behavioral', 'lifestyle intervention'),
('Metformin', 'Drug', 'metformin');

INSERT INTO trials
(nct_id, brief_title, official_title, brief_summary, phase_id, status_id, study_type_id, sex_id, minimum_age, maximum_age, enrollment_count, source_url)
VALUES
(
  'NCT00000001',
  'Lifestyle Study for Type 2 Diabetes',
  'A Demo Lifestyle Intervention Study for Type 2 Diabetes',
  'Demo trial used for database testing.',
  5,
  1,
  1,
  1,
  18,
  65,
  120,
  'https://example.com/NCT00000001'
);

INSERT INTO trial_conditions (trial_id, condition_id, condition_role) VALUES
(1, 1, 'Primary');

INSERT INTO trial_interventions (trial_id, intervention_id, arm_group_label) VALUES
(1, 1, 'Lifestyle Arm'),
(1, 2, 'Medication Arm');

INSERT INTO eligibility_criteria
(trial_id, criteria_type, criteria_text, criteria_order, keyword_count, requires_manual_review)
VALUES
(1, 'Inclusion', 'Participants must be aged 18 to 65 years and diagnosed with type 2 diabetes.', 1, 5, FALSE),
(1, 'Exclusion', 'Participants with severe kidney disease are excluded.', 2, 3, TRUE);

INSERT INTO patient_profiles (created_by_user_id, profile_name, age, sex_id, notes)
VALUES
(1, 'Demo Patient Profile', 45, 2, 'Demo profile for matching workflow.');

INSERT INTO patient_conditions (patient_profile_id, condition_id, condition_status)
VALUES
(1, 1, 'Current');

INSERT INTO patient_trial_matches
(patient_profile_id, trial_id, structured_match_passed, criteria_review_required, match_score)
VALUES
(1, 1, TRUE, TRUE, 72.50);

INSERT INTO saved_trials (user_id, patient_profile_id, trial_id, saved_status, notes)
VALUES
(1, 1, 1, 'Needs Review', 'Saved after demo pre-screening.');