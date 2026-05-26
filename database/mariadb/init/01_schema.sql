USE trialmatch_db;

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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES user_roles(role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE trials (
  trial_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  nct_id VARCHAR(30) NOT NULL UNIQUE,
  brief_title VARCHAR(500) NOT NULL,
  official_title TEXT,
  acronym VARCHAR(100),
  brief_summary TEXT,
  phase_id TINYINT UNSIGNED,
  status_id TINYINT UNSIGNED,
  study_type_id TINYINT UNSIGNED,
  sex_id TINYINT UNSIGNED,
  minimum_age INT,
  maximum_age INT,
  enrollment_count INT,
  start_date DATE,
  completion_date DATE,
  source_url VARCHAR(1000),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (phase_id) REFERENCES trial_phases(phase_id),
  FOREIGN KEY (status_id) REFERENCES trial_statuses(status_id),
  FOREIGN KEY (study_type_id) REFERENCES study_types(study_type_id),
  FOREIGN KEY (sex_id) REFERENCES sex_eligibilities(sex_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  FOREIGN KEY (condition_id) REFERENCES conditions(condition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE interventions (
  intervention_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  intervention_name VARCHAR(500) NOT NULL,
  intervention_type VARCHAR(150),
  normalised_name VARCHAR(500) NOT NULL UNIQUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE trial_interventions (
  trial_id BIGINT UNSIGNED NOT NULL,
  intervention_id BIGINT UNSIGNED NOT NULL,
  arm_group_label VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trial_id, intervention_id),
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  FOREIGN KEY (intervention_id) REFERENCES interventions(intervention_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patient_profiles (
  patient_profile_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  created_by_user_id BIGINT UNSIGNED NOT NULL,
  profile_name VARCHAR(150) NOT NULL,
  age INT NOT NULL,
  sex_id TINYINT UNSIGNED NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_user_id) REFERENCES app_users(user_id),
  FOREIGN KEY (sex_id) REFERENCES sex_eligibilities(sex_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE patient_conditions (
  patient_profile_id BIGINT UNSIGNED NOT NULL,
  condition_id BIGINT UNSIGNED NOT NULL,
  condition_status VARCHAR(80) DEFAULT 'Current',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (patient_profile_id, condition_id),
  FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(patient_profile_id) ON DELETE CASCADE,
  FOREIGN KEY (condition_id) REFERENCES conditions(condition_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(patient_profile_id) ON DELETE CASCADE,
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE match_status_history (
  history_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  old_status VARCHAR(80),
  new_status VARCHAR(80) NOT NULL,
  change_reason TEXT,
  changed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (match_id) REFERENCES patient_trial_matches(match_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE saved_trials (
  saved_trial_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  patient_profile_id BIGINT UNSIGNED,
  trial_id BIGINT UNSIGNED NOT NULL,
  saved_status ENUM('Saved', 'Interested', 'Potential Match', 'Needs Review') NOT NULL DEFAULT 'Saved',
  notes TEXT,
  saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_saved_trial_user_trial (user_id, trial_id),
  FOREIGN KEY (user_id) REFERENCES app_users(user_id),
  FOREIGN KEY (patient_profile_id) REFERENCES patient_profiles(patient_profile_id) ON DELETE SET NULL,
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE search_logs (
  search_log_id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  query_text VARCHAR(500),
  filters_json JSON,
  result_count INT NOT NULL DEFAULT 0,
  searched_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES app_users(user_id)
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
  FOREIGN KEY (user_id) REFERENCES app_users(user_id)
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
  FOREIGN KEY (trial_id) REFERENCES trials(trial_id) ON DELETE CASCADE,
  FOREIGN KEY (criteria_id) REFERENCES eligibility_criteria(criteria_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;