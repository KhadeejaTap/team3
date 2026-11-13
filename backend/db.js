const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: 3306,
    timezone: 'Z',
    // Increase timeout to 30 seconds to avoid premature ETIMEDOUT
    connectTimeout: 30000,
    // Use SSL only for remote hosts; disable for localhost to simplify testing
    ssl: ['localhost', '127.0.0.1'].includes(
        (process.env.DB_HOST || 'localhost').toLowerCase()
    )
        ? undefined
        : { rejectUnauthorized: true },
    connectionLimit: 10,
});

// Basic sanity checks for required DB env vars
if (!process.env.DB_HOST) console.warn('[WARN] DB_HOST is not set, defaulting to localhost');
if (!process.env.DB_USER) console.warn('[WARN] DB_USER is not set');
if (!process.env.DB_PASS) console.warn('[WARN] DB_PASS is not set');
if (!process.env.DB_NAME) console.warn('[WARN] DB_NAME is not set');

module.exports = pool;
