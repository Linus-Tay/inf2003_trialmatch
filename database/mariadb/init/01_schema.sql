USE trialmatch_db;

-- ============================================================
-- TrialMatch MariaDB schema
-- Purpose: normalized operational database for authentication,
-- structured clinical-trial filtering, patient matching, saved
-- trial workflow, auditing, data quality, and cache-backed
-- analytics.
-- ============================================================

-- ------------------------------------------------------------
-- User and authentication tables
-- ------------------------------------------------------------
CREATE TABLE user_roles (
  role_id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE app_users (
  user_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  role_id TINYINT UNSIGNED NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_users_role FOREIGN KEY (role_id) REFERENCES user_roles(role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Controlled lookup tables
-- These normalize repeated categorical strings from the source
-- dataset, improving consistency and reducing repeated text.
-- ------------------------------------------------------------
CREATE TABLE trial_phases (
  phase_id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  phase_name VARCHAR(80) NOT NULL UNIQUE,
  phase_order TINYINT UNSIGNED
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trial_statuses (
  status_id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  status_name VARCHAR(100) NOT NULL UNIQUE,
  is_open_to_recruitment BOOLEAN NOT NULL DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE study_types (
  study_type_id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  study_type_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sex_eligibilities (
  sex_id TINYINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sex_name VARCHAR(30) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Core clinical trial table
-- One row per trial. Repeated categories are referenced by FKs.
-- healthy_volunteers is a structured trial-level eligibility
-- filter because it directly affects whether healthy participants
-- may be matched to the trial.
-- ------------------------------------------------------------
CREATE TABLE trials (
  trial_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nct_id VARCHAR(30) NOT NULL UNIQUE,
  brief_title VARCHAR(500) NOT NULL,
  official_title TEXT,
  brief_summary TEXT,
  phase_id TINYINT UNSIGNED,
  status_id TINYINT UNSIGNED,
  study_type_id TINYINT UNSIGNED,
  sex_id TINYINT UNSIGNED,
  minimum_age INT,
  maximum_age INT,
  healthy_volunteers BOOLEAN,
  source_url VARCHAR(1000),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_trials_phase FOREIGN KEY (phase_id) REFERENCES trial_phases(phase_id),
  CONSTRAINT fk_trials_status FOREIGN KEY (status_id) REFERENCES trial_statuses(status_id),
  CONSTRAINT fk_trials_study_type FOREIGN KEY (study_type_id) REFERENCES study_types(study_type_id),
  CONSTRAINT fk_trials_sex FOREIGN KEY (sex_id) REFERENCES sex_eligibilities(sex_id),
  CONSTRAINT chk_trials_min_age CHECK (minimum_age IS NULL OR minimum_age BETWEEN 0 AND 120),
  CONSTRAINT chk_trials_max_age CHECK (maximum_age IS NULL OR maximum_age BETWEEN 0 AND 120),
  CONSTRAINT chk_trials_age_range CHECK (
    minimum_age IS NULL OR maximum_age IS NULL OR minimum_age <= maximum_age
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Source-level metadata table
-- This preserves derived/source fields from the cleaned dataset
-- without overloading the normalized trials table. It also makes
-- it easy to explain why raw retrieval fields are kept separate
-- from operational relational fields.
-- ------------------------------------------------------------
CREATE TABLE trial_source_metadata (
  trial_id BIGINT UNSIGNED PRIMARY KEY,
  source_condition_query VARCHAR(255),
  criteria_split_status VARCHAR(100),
  combined_text_for_retrieval LONGTEXT,
  has_eligibility_criteria BOOLEAN,
  eligibility_criteria_length INT,
  inclusion_criteria_length INT,
  exclusion_criteria_length INT,
  imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trial_source_metadata_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Clinical condition model
-- conditions stores unique normalized condition names.
-- trial_conditions implements the many-to-many relationship
-- between trials and conditions.
-- ------------------------------------------------------------
CREATE TABLE conditions (
  condition_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  condition_name VARCHAR(255) NOT NULL,
  normalised_name VARCHAR(255) NOT NULL UNIQUE,
  condition_category VARCHAR(150),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trial_conditions (
  trial_id BIGINT UNSIGNED NOT NULL,
  condition_id BIGINT UNSIGNED NOT NULL,
  condition_role VARCHAR(50) DEFAULT 'Primary',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trial_id, condition_id),
  CONSTRAINT fk_trial_conditions_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_conditions_condition FOREIGN KEY (condition_id) REFERENCES conditions(condition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Clinical intervention model
-- interventions stores unique normalized intervention names.
-- trial_interventions supports many interventions per trial and
-- many trials per intervention.
-- ------------------------------------------------------------
CREATE TABLE interventions (
  intervention_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  intervention_name VARCHAR(500) NOT NULL,
  normalised_name VARCHAR(500) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trial_interventions (
  trial_id BIGINT UNSIGNED NOT NULL,
  intervention_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trial_id, intervention_id),
  CONSTRAINT fk_trial_interventions_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  CONSTRAINT fk_trial_interventions_intervention FOREIGN KEY (intervention_id) REFERENCES interventions(intervention_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Eligibility criteria
-- The source eligibility text is split into criterion-level rows.
-- This supports criterion-level review, filtering, complexity
-- analysis, and targeted manual-review prioritisation.
-- ------------------------------------------------------------
CREATE TABLE eligibility_criteria (
  criteria_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  trial_id BIGINT UNSIGNED NOT NULL,
  criteria_type ENUM('Inclusion', 'Exclusion', 'General') NOT NULL DEFAULT 'General',
  criteria_text TEXT NOT NULL,
  criteria_order INT NOT NULL DEFAULT 1,
  text_length INT,
  keyword_count INT DEFAULT 0,
  complexity_score DECIMAL(5,2) DEFAULT 0.00,
  requires_manual_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_eligibility_criteria_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  CONSTRAINT chk_criteria_order CHECK (criteria_order >= 1),
  CONSTRAINT chk_criteria_text_length CHECK (text_length IS NULL OR text_length >= 0),
  CONSTRAINT chk_criteria_complexity CHECK (complexity_score IS NULL OR complexity_score BETWEEN 0 AND 99.99)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Patient profile and patient condition model
-- Used for patient matching and application CRUD.
-- ------------------------------------------------------------
CREATE TABLE patient_profiles (
  patient_profile_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  profile_name VARCHAR(150) NOT NULL,
  age INT NOT NULL,
  sex_id TINYINT UNSIGNED NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_patient_profiles_user FOREIGN KEY (created_by_user_id) REFERENCES app_users(user_id),
  CONSTRAINT fk_patient_profiles_sex FOREIGN KEY (sex_id) REFERENCES sex_eligibilities(sex_id),
  CONSTRAINT chk_patient_age CHECK (age BETWEEN 0 AND 120)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patient_conditions (
  patient_profile_id BIGINT UNSIGNED NOT NULL,
  condition_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_profile_id, condition_id),
  CONSTRAINT fk_patient_conditions_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(patient_profile_id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_conditions_condition FOREIGN KEY (condition_id) REFERENCES conditions(condition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Matching workflow tables
-- patient_trial_matches stores structured match outcomes.
-- match_status_history stores trigger-generated status history.
-- ------------------------------------------------------------
CREATE TABLE patient_trial_matches (
  match_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  patient_profile_id BIGINT UNSIGNED NOT NULL,
  trial_id BIGINT UNSIGNED NOT NULL,
  structured_match_passed BOOLEAN NOT NULL DEFAULT FALSE,
  criteria_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  match_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  match_status ENUM('Potential Match', 'Needs Review', 'Not Suitable') NOT NULL DEFAULT 'Needs Review',
  matched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_patient_trial_match (patient_profile_id, trial_id),
  CONSTRAINT fk_patient_trial_matches_profile FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(patient_profile_id) ON DELETE CASCADE,
  CONSTRAINT fk_patient_trial_matches_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  CONSTRAINT chk_match_score CHECK (match_score BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE match_status_history (
  history_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(80),
  new_status VARCHAR(80) NOT NULL,
  change_reason TEXT,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_match_status_history_match FOREIGN KEY (match_id) REFERENCES patient_trial_matches(match_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Saved-trial workflow table
-- Tracks user-specific interest, notes, and review state.
-- ------------------------------------------------------------
CREATE TABLE saved_trials (
  saved_trial_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  trial_id BIGINT UNSIGNED NOT NULL,
  saved_status ENUM('Saved', 'Interested', 'Potential Match', 'Needs Review') NOT NULL DEFAULT 'Saved',
  notes TEXT,
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved_trial_user_trial (user_id, trial_id),
  CONSTRAINT fk_saved_trials_user FOREIGN KEY (user_id) REFERENCES app_users(user_id),
  CONSTRAINT fk_saved_trials_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Logging and data quality
-- ------------------------------------------------------------
CREATE TABLE search_logs (
  search_log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  query_text VARCHAR(500),
  filters_json JSON,
  result_count INT NOT NULL DEFAULT 0,
  searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_search_logs_user FOREIGN KEY (user_id) REFERENCES app_users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE audit_logs (
  audit_log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  table_name VARCHAR(100) NOT NULL,
  record_pk VARCHAR(100) NOT NULL,
  action_type ENUM('INSERT', 'UPDATE', 'DELETE', 'ARCHIVE') NOT NULL,
  old_values JSON,
  new_values JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES app_users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE data_quality_flags (
  flag_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  trial_id BIGINT UNSIGNED,
  criteria_id BIGINT UNSIGNED,
  flag_type VARCHAR(100) NOT NULL,
  severity ENUM('Low', 'Medium', 'High') NOT NULL DEFAULT 'Low',
  description TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  CONSTRAINT fk_data_quality_flags_trial FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  CONSTRAINT fk_data_quality_flags_criteria FOREIGN KEY (criteria_id) REFERENCES eligibility_criteria(criteria_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- Cache tables
-- These tables are intentionally part of the schema rather than
-- the index file. They support dashboard and search performance
-- when the full dataset is imported.
-- ------------------------------------------------------------
CREATE TABLE trial_search_cache (
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

CREATE TABLE condition_summary_cache (
  condition_id BIGINT UNSIGNED PRIMARY KEY,
  trial_count INT NOT NULL DEFAULT 0,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_condition_summary_cache_condition FOREIGN KEY (condition_id) REFERENCES conditions(condition_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
