USE trialmatch_db;

-- ============================================================
-- Non-redundant indexing strategy
-- Primary keys, unique keys, and foreign keys already create
-- useful indexes. This file only adds indexes that support actual
-- query patterns, reverse lookups, analytics, or full-text search.
-- ============================================================

-- ------------------------------------------------------------
-- Trial filters used by /trials and analytics.
-- nct_id is already UNIQUE in the schema, so no duplicate index
-- is created for nct_id here.
-- ------------------------------------------------------------
CREATE INDEX idx_trials_active_status_phase_sex
ON trials(is_archived, status_id, phase_id, sex_id, trial_id);

CREATE INDEX idx_trials_active_healthy
ON trials(is_archived, healthy_volunteers, trial_id);

CREATE INDEX idx_trials_age_range
ON trials(minimum_age, maximum_age);

CREATE INDEX idx_trials_active_updated
ON trials(is_archived, updated_at);

-- Full-text indexes support future MATCH AGAINST searches.
-- Current LIKE '%keyword%' queries still work, but full-text search
-- should be preferred for large datasets.
CREATE FULLTEXT INDEX ft_trials_title_summary
ON trials(brief_title, official_title, brief_summary);

CREATE FULLTEXT INDEX ft_trial_source_combined_text
ON trial_source_metadata(combined_text_for_retrieval);

-- ------------------------------------------------------------
-- Lookup names. normalised_name is already UNIQUE for conditions
-- and interventions, so these support display-name search only.
-- ------------------------------------------------------------
CREATE INDEX idx_conditions_name
ON conditions(condition_name);

CREATE INDEX idx_interventions_name
ON interventions(intervention_name);

-- ------------------------------------------------------------
-- Many-to-many reverse lookup indexes.
-- trial_conditions already has PRIMARY KEY(trial_id, condition_id).
-- trial_interventions already has PRIMARY KEY(trial_id, intervention_id).
-- These reverse indexes support finding trials by condition or
-- intervention efficiently.
-- ------------------------------------------------------------
CREATE INDEX idx_trial_conditions_condition_trial
ON trial_conditions(condition_id, trial_id);

CREATE INDEX idx_trial_interventions_intervention_trial
ON trial_interventions(intervention_id, trial_id);

-- ------------------------------------------------------------
-- Eligibility criteria indexes for per-trial criteria display,
-- analytics, manual review filtering, and optional text search.
-- ------------------------------------------------------------
CREATE INDEX idx_eligibility_trial_type_order
ON eligibility_criteria(trial_id, criteria_type, criteria_order);

CREATE INDEX idx_eligibility_trial_review
ON eligibility_criteria(trial_id, requires_manual_review);

CREATE INDEX idx_eligibility_complexity_trial
ON eligibility_criteria(complexity_score, trial_id);

CREATE FULLTEXT INDEX ft_eligibility_criteria_text
ON eligibility_criteria(criteria_text);

-- ------------------------------------------------------------
-- Patient/profile workflow indexes.
-- ------------------------------------------------------------
CREATE INDEX idx_patient_profiles_user_created
ON patient_profiles(created_by_user_id, created_at);

CREATE INDEX idx_patient_conditions_condition_profile
ON patient_conditions(condition_id, patient_profile_id);

CREATE INDEX idx_saved_trials_user_saved_at
ON saved_trials(user_id, saved_at);

CREATE INDEX idx_saved_trials_user_status
ON saved_trials(user_id, saved_status);

CREATE INDEX idx_patient_matches_profile_score
ON patient_trial_matches(patient_profile_id, match_score);

CREATE INDEX idx_patient_matches_trial_status
ON patient_trial_matches(trial_id, match_status);

-- ------------------------------------------------------------
-- Data quality, logging, and source metadata indexes.
-- ------------------------------------------------------------
CREATE INDEX idx_trial_source_split_status
ON trial_source_metadata(criteria_split_status);

CREATE INDEX idx_data_quality_unresolved
ON data_quality_flags(is_resolved, severity, created_at);

CREATE INDEX idx_search_logs_user_time
ON search_logs(user_id, searched_at);

CREATE INDEX idx_audit_logs_table_record_time
ON audit_logs(table_name, record_pk, created_at);

CREATE INDEX idx_match_history_match_time
ON match_status_history(match_id, changed_at);
