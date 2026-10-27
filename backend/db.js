const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
	host: process.env.DB_HOST || 'localhost',
	user: process.env.DB_USER,
	password: process.env.DB_PASS,
	database: process.env.DB_NAME,
	port: 3306,
	ssl: process.env.DB_HOST
        ? { rejectUnauthorized: true }
        : undefined,
	connectionLimit: 10
});

module.exports = pool;
