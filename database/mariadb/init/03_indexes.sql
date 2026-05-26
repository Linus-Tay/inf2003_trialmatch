USE trialmatch_db;

CREATE INDEX idx_trials_nct_id ON trials(nct_id);
CREATE INDEX idx_trials_status_phase ON trials(status_id, phase_id);
CREATE INDEX idx_trials_age_sex ON trials(minimum_age, maximum_age, sex_id);
CREATE INDEX idx_conditions_name ON conditions(condition_name);
CREATE INDEX idx_interventions_name ON interventions(intervention_name);
CREATE INDEX idx_eligibility_trial_type ON eligibility_criteria(trial_id, criteria_type);
CREATE INDEX idx_eligibility_complexity ON eligibility_criteria(complexity_score);
CREATE INDEX idx_patient_matches_score ON patient_trial_matches(match_score);
CREATE INDEX idx_saved_trials_user_status ON saved_trials(user_id, saved_status);
CREATE INDEX idx_data_quality_unresolved ON data_quality_flags(is_resolved, severity);