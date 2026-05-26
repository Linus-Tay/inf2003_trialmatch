USE trialmatch_db;

INSERT INTO user_roles (role_name, description) VALUES
('Patient', 'Demo patient user who searches and saves trials.'),
('Researcher', 'Researcher user who manages trial records.'),
('Admin', 'Data steward/admin user who reviews data quality and database demos.');

INSERT INTO app_users (role_id, full_name, email) VALUES
(1, 'Demo Patient', 'patient@trialmatch.local'),
(2, 'Demo Researcher', 'researcher@trialmatch.local'),
(3, 'Demo Admin', 'admin@trialmatch.local');

INSERT INTO trial_phases (phase_name, phase_order) VALUES
('Not Applicable', 0),
('Early Phase 1', 1),
('Phase 1', 2),
('Phase 1/Phase 2', 3),
('Phase 2', 4),
('Phase 2/Phase 3', 5),
('Phase 3', 6),
('Phase 4', 7);

INSERT INTO trial_statuses (status_name, is_open_to_recruitment) VALUES
('Recruiting', TRUE),
('Not yet recruiting', TRUE),
('Enrolling by invitation', TRUE),
('Active, not recruiting', FALSE),
('Completed', FALSE),
('Terminated', FALSE),
('Withdrawn', FALSE),
('Unknown status', FALSE);

INSERT INTO study_types (study_type_name) VALUES
('Interventional'),
('Observational'),
('Expanded Access');

INSERT INTO sex_eligibilities (sex_name) VALUES
('All'),
('Male'),
('Female');