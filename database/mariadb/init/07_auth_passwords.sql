USE trialmatch_db;

ALTER TABLE app_users
ADD COLUMN password_hash VARCHAR(255) NULL AFTER email;

CREATE INDEX idx_app_users_email_active ON app_users(email, is_active);
