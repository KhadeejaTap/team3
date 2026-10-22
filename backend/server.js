
require('dotenv').config();
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
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/api/employees' && req.method === 'GET') {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM employee_directory'
            );
            res.end(JSON.stringify(rows));
        } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    else if (req.url === '/api/manager' && req.method === 'GET') {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM manager_view'
            );
            res.end(JSON.stringify(rows));
        } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    else if (req.url === '/api/hr' && req.method === 'GET') {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM hr_view'
            );
            res.end(JSON.stringify(rows));
        } catch (err) {
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

                const [rows] = await pool.query(
                    'SELECT userID, role FROM users WHERE email = ? AND password = ?',
                    [email, password]
                );

                if (rows.length > 0) {
                    res.statusCode = 200;
                    res.end(JSON.stringify(rows[0]));
                } else {
                    res.statusCode = 401;
                    res.end(JSON.stringify({
                        error: 'Invalid email or password or user does not exist'
                    }));
                }
            } catch (err) {
                console.log(err);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: 'Server error' }));
            }
        });
    }
    else if (req.url === '/api/animals' && req.method === 'GET') {
        try {
            const [rows] = await pool.query('SELECT * FROM ANIMAL');
            res.end(JSON.stringify(rows));
        } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
        }
    }
    else if (req.url === '/api/animals' && req.method === 'POST') {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk;
        });

        req.on('end', async () => {
            try {
                const animal = JSON.parse(body);

                const [result] = await pool.query(
                    `INSERT INTO ANIMAL
                    (name, species_ID, enclosure_ID, age, gender, weight, arrival_date, breeding_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        animal.name || null,
                        animal.species_ID,
                        animal.enclosure_ID,
                        animal.age || null,
                        animal.gender || null,
                        animal.weight || null,
                        animal.arrival_date || null,
                        animal.breeding_status || null
                    ]
                );

                res.statusCode = 201;
                res.end(JSON.stringify({
                    message: 'Animal saved successfully',
                    animal_ID: result.insertId
                }));
            } catch (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err.message }));
            }
        });
    }
    else {
        res.statusCode = 404;
        res.end(JSON.stringify({ message: 'Not Found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
