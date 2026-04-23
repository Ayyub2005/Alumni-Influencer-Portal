-- =========================================================
-- Phantasmagoria University Analytics Dashboard (CW2)
-- Database Initiation Script
-- =========================================================

-- Create the database if it doesn't already exist
CREATE DATABASE IF NOT EXISTS phantasmagoria_dashboard;
USE phantasmagoria_dashboard;

-- Staff Users Table (strictly separated from Alumni users in CW1)
DROP TABLE IF EXISTS dashboard_users;
CREATE TABLE IF NOT EXISTS dashboard_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_verified BOOLEAN DEFAULT FALSE,
  verify_token VARCHAR(255) DEFAULT NULL,
  verify_expires DATETIME DEFAULT NULL,
  reset_token VARCHAR(255) DEFAULT NULL,
  reset_expires DATETIME DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Indexing for optimized token lookup and authentication
  INDEX idx_verify_token (verify_token),
  INDEX idx_reset_token (reset_token)
);

-- Note: No actual data (e.g., Alumni or Analytics) is stored in this database. 
-- The Dashboard fetches all analytics reporting purely via the API Keys 
-- attached to the phantasmagoria (.env) proxy.
