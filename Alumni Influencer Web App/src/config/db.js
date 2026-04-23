// src/config/db.js
// MySQL database connection pool
// Using mysql2 with promises for async/await support

const mysql = require('mysql2/promise');
require('dotenv').config();

// Create a connection pool (better than a single connection)
// A pool keeps multiple connections ready so the server doesn't slow down under load
const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit:    10,   // Max 10 simultaneous DB connections
  queueLimit:         0,    // Unlimited queue
});

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('MySQL connected successfully');
    connection.release(); // Always release back to pool
  } catch (err) {
    console.error('MySQL connection failed:', err.message);
    process.exit(1); // Stop server if DB is unreachable
  }
}

module.exports = { pool, testConnection };
