-- =================================================
-- Phantasmagoria Alumni Platform - Database Schema
-- Run this in phpMyAdmin -> SQL tab
-- Satisfies 3NF: no repeating groups, no transitive dependencies
-- =================================================

CREATE DATABASE IF NOT EXISTS phantasmagoria;
USE phantasmagoria;

-- -------------------------
-- USERS TABLE
-- Stores alumni login credentials only (not profile info)
-- Separated from profiles for 3NF compliance
-- -------------------------
CREATE TABLE IF NOT EXISTS users (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  email            VARCHAR(255) NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,              -- bcrypt hash (never plain text)
  role             ENUM('alumni', 'developer') DEFAULT 'alumni', -- User authority level
  is_verified      BOOLEAN DEFAULT FALSE,              -- Must verify email before login
  verify_token     VARCHAR(64),                        -- Crypto-random token (single use)
  verify_expires   DATETIME,                           -- Token expiry (1 hour)
  reset_token      VARCHAR(64),                        -- Password reset token
  reset_expires    DATETIME,                           -- Reset token expiry
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- -------------------------
-- API TOKENS TABLE
-- Bearer tokens for client access
-- Separate from users to track per-token usage stats
-- -------------------------
CREATE TABLE IF NOT EXISTS api_tokens (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT NOT NULL,
  token_hash   VARCHAR(128) NOT NULL UNIQUE,           -- SHA-256 hash of the actual token
  token_name   VARCHAR(100),                           -- Label (e.g. "AR Client Key")
  is_revoked   BOOLEAN DEFAULT FALSE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------
-- TOKEN USAGE LOGS TABLE
-- Tracks timestamps + endpoints
-- -------------------------
CREATE TABLE IF NOT EXISTS token_logs (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  token_id   INT NOT NULL,
  endpoint   VARCHAR(255),                             -- e.g. GET /api/alumni/featured
  ip_address VARCHAR(45),
  accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (token_id) REFERENCES api_tokens(id) ON DELETE CASCADE
);

-- -------------------------
-- PROFILES TABLE
-- Alumni professional profile (one per user)
-- -------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL UNIQUE,                  -- One profile per user
  first_name     VARCHAR(100),
  last_name      VARCHAR(100),
  biography      TEXT,
  linkedin_url   VARCHAR(500),
  profile_image  VARCHAR(500),                         -- File path to uploaded image
  is_featured_today   BOOLEAN DEFAULT FALSE,            -- Today's Alumni of the Day
  has_event_participation BOOLEAN DEFAULT FALSE,        -- Grants 4th monthly win possibility
  appearance_count    INT DEFAULT 0,                    -- Lifetime total times featured (reset by admin)
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- -------------------------
-- DEGREES TABLE
-- Multiple degrees per profile (separate table = 3NF)
-- -------------------------
CREATE TABLE IF NOT EXISTS degrees (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  profile_id      INT NOT NULL,
  title           VARCHAR(255) NOT NULL,               -- e.g. "BSc Computer Science"
  institution     VARCHAR(255),
  degree_url      VARCHAR(500),                        -- URL to official university page
  completion_date DATE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- CERTIFICATIONS TABLE
-- Professional certs (AWS, Google, etc.) - multiple per profile
-- -------------------------
CREATE TABLE IF NOT EXISTS certifications (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  profile_id      INT NOT NULL,
  title           VARCHAR(255) NOT NULL,
  cert_url        VARCHAR(500),                        -- URL to cert course page
  completion_date DATE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- LICENCES TABLE
-- Professional licences - multiple per profile
-- -------------------------
CREATE TABLE IF NOT EXISTS licences (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  profile_id      INT NOT NULL,
  title           VARCHAR(255) NOT NULL,
  awarding_body   VARCHAR(255),
  licence_url     VARCHAR(500),                        -- URL to licence awarding body
  completion_date DATE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- COURSES TABLE
-- Short professional courses - multiple per profile
-- -------------------------
CREATE TABLE IF NOT EXISTS courses (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  profile_id      INT NOT NULL,
  title           VARCHAR(255) NOT NULL,
  course_url      VARCHAR(500),
  completion_date DATE,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- EMPLOYMENT TABLE
-- Work history - multiple entries per profile
-- -------------------------
CREATE TABLE IF NOT EXISTS employment (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  profile_id INT NOT NULL,
  company    VARCHAR(255) NOT NULL,
  role       VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date   DATE,                                     -- NULL = current job
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- -------------------------
-- BIDS TABLE
-- Blind bidding system - core business logic
-- -------------------------
CREATE TABLE IF NOT EXISTS bids (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  amount      DECIMAL(10, 2) NOT NULL,                 -- Bid amount in GBP
  bid_date    DATE NOT NULL,                           -- Date this bid is for
  is_winner   BOOLEAN DEFAULT FALSE,                   -- Set to TRUE by midnight cron job
  status      ENUM('active', 'won', 'lost') DEFAULT 'active',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- Each user can only have ONE bid per date
  UNIQUE KEY unique_user_bid_date (user_id, bid_date)
);

-- -------------------------
-- MONTHLY WIN TRACKING TABLE
-- Tracks how many times each alumni has won per calendar month
-- Enforces the 3 wins/month limit
-- -------------------------
CREATE TABLE IF NOT EXISTS monthly_wins (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  year_month VARCHAR(7) NOT NULL,                      -- Format: "2026-04"
  win_count  INT DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_month (user_id, year_month)
);

-- -------------------------
-- MIGRATION: Add appearance_count to profiles
-- Run this if you created the DB before this column was added.
-- Safe to run multiple times (checks IF NOT EXISTS via stored procedure pattern).
-- -------------------------
SET @col_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'profiles'
    AND COLUMN_NAME  = 'appearance_count'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE profiles ADD COLUMN appearance_count INT DEFAULT 0 COMMENT ''Lifetime total times featured as Alumni of the Day''',
  'SELECT ''appearance_count column already exists, skipping migration.'''
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

