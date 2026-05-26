USE trialmatch_db;

-- ============================================================
-- Seed controlled lookup values only.
-- No application users, demo trials, patient profiles, saved
-- trials, matches, or sample clinical records are inserted here.
-- Real application users are created through the signup route.
-- Real clinical trial records are imported by the ETL scripts from
-- the cleaned dataset.
-- ============================================================

INSERT INTO user_roles (role_name, description) VALUES
('Patient', 'Patient-facing user who searches, matches, and saves trials.'),
('Researcher', 'Researcher user who manages and reviews trial records.'),
('Admin', 'Data steward/admin user who reviews data quality and database evidence.');

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
