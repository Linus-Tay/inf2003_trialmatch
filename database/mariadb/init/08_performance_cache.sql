USE trialmatch_db;

DROP PROCEDURE IF EXISTS add_index_if_missing;
DELIMITER $$
CREATE PROCEDURE add_index_if_missing(IN p_table_name VARCHAR(128), IN p_index_name VARCHAR(128), IN p_create_sql TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = p_table_name
          AND index_name = p_index_name
    ) THEN
        SET @sql_to_run = p_create_sql;
        PREPARE stmt FROM @sql_to_run;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

CALL add_index_if_missing('trials','idx_trials_archived_id','CREATE INDEX idx_trials_archived_id ON trials(is_archived, trial_id)');
CALL add_index_if_missing('trials','idx_trials_status_phase_sex','CREATE INDEX idx_trials_status_phase_sex ON trials(status_id, phase_id, sex_id)');
CALL add_index_if_missing('trials','idx_trials_age_range','CREATE INDEX idx_trials_age_range ON trials(minimum_age, maximum_age)');
CALL add_index_if_missing('trials','idx_trials_updated','CREATE INDEX idx_trials_updated ON trials(updated_at)');
CALL add_index_if_missing('trial_conditions','idx_trial_conditions_condition_trial','CREATE INDEX idx_trial_conditions_condition_trial ON trial_conditions(condition_id, trial_id)');
CALL add_index_if_missing('trial_conditions','idx_trial_conditions_trial_condition','CREATE INDEX idx_trial_conditions_trial_condition ON trial_conditions(trial_id, condition_id)');
CALL add_index_if_missing('trial_interventions','idx_trial_interventions_trial_intervention','CREATE INDEX idx_trial_interventions_trial_intervention ON trial_interventions(trial_id, intervention_id)');
CALL add_index_if_missing('eligibility_criteria','idx_criteria_trial_type_review','CREATE INDEX idx_criteria_trial_type_review ON eligibility_criteria(trial_id, criteria_type, requires_manual_review)');
CALL add_index_if_missing('eligibility_criteria','idx_criteria_complexity_trial','CREATE INDEX idx_criteria_complexity_trial ON eligibility_criteria(complexity_score, trial_id)');
CALL add_index_if_missing('patient_profiles','idx_patient_profiles_user_created','CREATE INDEX idx_patient_profiles_user_created ON patient_profiles(created_by_user_id, created_at)');
CALL add_index_if_missing('patient_conditions','idx_patient_conditions_condition_profile','CREATE INDEX idx_patient_conditions_condition_profile ON patient_conditions(condition_id, patient_profile_id)');
CALL add_index_if_missing('saved_trials','idx_saved_trials_user_saved_at','CREATE INDEX idx_saved_trials_user_saved_at ON saved_trials(user_id, saved_at)');
CALL add_index_if_missing('patient_trial_matches','idx_matches_profile_score','CREATE INDEX idx_matches_profile_score ON patient_trial_matches(patient_profile_id, match_score)');
DROP PROCEDURE IF EXISTS add_index_if_missing;

CREATE TABLE IF NOT EXISTS trial_search_cache (
    trial_id BIGINT UNSIGNED PRIMARY KEY,
    condition_count INT NOT NULL DEFAULT 0,
    intervention_count INT NOT NULL DEFAULT 0,
    criteria_count INT NOT NULL DEFAULT 0,
    inclusion_count INT NOT NULL DEFAULT 0,
    exclusion_count INT NOT NULL DEFAULT 0,
    avg_complexity_score DECIMAL(8,2),
    manual_review_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_trial_search_cache_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS condition_summary_cache (
    condition_id BIGINT UNSIGNED PRIMARY KEY,
    trial_count INT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_condition_summary_cache_condition FOREIGN KEY (condition_id) REFERENCES conditions(condition_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

REPLACE INTO trial_search_cache (trial_id, condition_count, intervention_count, criteria_count, inclusion_count, exclusion_count, avg_complexity_score, manual_review_count, updated_at)
SELECT t.trial_id,
       COALESCE(tc.condition_count, 0),
       COALESCE(ti.intervention_count, 0),
       COALESCE(ec.criteria_count, 0),
       COALESCE(ec.inclusion_count, 0),
       COALESCE(ec.exclusion_count, 0),
       ec.avg_complexity_score,
       COALESCE(ec.manual_review_count, 0),
       CURRENT_TIMESTAMP
FROM trials t
LEFT JOIN (SELECT trial_id, COUNT(*) AS condition_count FROM trial_conditions GROUP BY trial_id) tc ON t.trial_id = tc.trial_id
LEFT JOIN (SELECT trial_id, COUNT(*) AS intervention_count FROM trial_interventions GROUP BY trial_id) ti ON t.trial_id = ti.trial_id
LEFT JOIN (
    SELECT trial_id,
           COUNT(*) AS criteria_count,
           SUM(CASE WHEN criteria_type = 'Inclusion' THEN 1 ELSE 0 END) AS inclusion_count,
           SUM(CASE WHEN criteria_type = 'Exclusion' THEN 1 ELSE 0 END) AS exclusion_count,
           ROUND(AVG(complexity_score), 2) AS avg_complexity_score,
           SUM(CASE WHEN requires_manual_review = TRUE THEN 1 ELSE 0 END) AS manual_review_count
    FROM eligibility_criteria
    GROUP BY trial_id
) ec ON t.trial_id = ec.trial_id;

REPLACE INTO condition_summary_cache (condition_id, trial_count, updated_at)
SELECT c.condition_id, COUNT(tc.trial_id), CURRENT_TIMESTAMP
FROM conditions c
LEFT JOIN trial_conditions tc ON c.condition_id = tc.condition_id
GROUP BY c.condition_id;
