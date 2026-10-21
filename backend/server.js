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
if (req.url === '/api/products' && req.method === 'GET') {
    try {
        const [rows] = await pool.query(`
            SELECT p.*, s.name AS shop_name
            FROM PRODUCT AS p
            JOIN GIFT_SHOP AS s ON p.shop_ID = s.shop_ID
            ORDER BY p.product_ID
        `);
        res.end(JSON.stringify(rows));
    } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
    }
}
else if (req.url === '/api/employees' && req.method === 'GET') {		try {
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
	else if (req.url === '/api/login' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
		});
		req.on('end', async () => {
			try {
				const { email, password } = JSON.parse(body);
				const [rows] = await pool.query( //.query is a built in method of pool . pool is a bunch of conections always open that i made
					'SELECT userID, role FROM users WHERE email = ? AND password = ?',
					[email, password]
				);
				if (rows.length > 0) {
					res.statusCode = 200;
					res.end(JSON.stringify(rows[0]));
				} else {
					res.statusCode = 401;
					res.end(JSON.stringify({ error: 'Invalid email or password or user does not exist' }));
				}
			}
			catch (err) {
				console.log(err);
				res.statusCode = 500;
				res.end(JSON.stringify({ error: 'Server error' }));
			}
		});
	}
	else {
		res.statusCode = 404;
		res.end((JSON.stringify({ message: 'Not Found' })));
	}
});
server.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});
