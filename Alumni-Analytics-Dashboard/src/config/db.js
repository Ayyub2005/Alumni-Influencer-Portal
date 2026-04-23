const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT || 3306,
  user:     process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('Dashboard DB connected.');
    conn.release();
  } catch (err) {
    console.error('Dashboard DB connection failed:', err.message);
    process.exit(1);
  }
}

module.exports = { pool, testConnection };
