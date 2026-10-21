const env = require('dotenv').config();
const http = require('http');
const PORT = process.env.PORT || 5000;
const pool = require('./db');

const server = http.createServer(async (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = 200;
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') {
		res.writeHead(204); // status code for no content
		res.end();
		return;
	}
	if (req.url === '/api/employees' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM employee_directory');
			res.end(JSON.stringify(rows));
		}
		catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}
	}
	else if (req.url === '/api/manager' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM manager_view');
			res.end(JSON.stringify(rows));
		}
		catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}
	}
	else if (req.url === '/api/hr' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM hr_view');
			res.end(JSON.stringify(rows));
		}
		catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}
	}
	else {
		res.statusCode = 404;
		res.end((JSON.stringify({ message: 'Not Found' })));
	}
});
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
