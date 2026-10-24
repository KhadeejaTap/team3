const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const http = require('http');
const PORT = process.env.PORT || 5000;
const pool = require('./db');

const server = http.createServer(async (req, res) => {
	res.setHeader('Content-Type', 'application/json');
	res.statusCode = 200;
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
	else if (req.url === '/api/admin' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM admin_view');
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
	else if (req.url === '/api/attractions' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT attr_ID, name, location, type FROM ATTRACTION ORDER BY name ASC');
			res.end(JSON.stringify(rows));
		}
		catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
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
	else if (req.url === '/api/register' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
		});
		req.on('end', async () => {
			try {
				const { email, password } = JSON.parse(body);

				if (!email || !password) {
					res.statusCode = 400;
					res.end(JSON.stringify({ error: 'Both email and password are required.' }));
					return;
				}

				const [result] = await pool.query(
					'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
					[email.trim(), password.trim(), 'visitor']
				);

				res.statusCode = 201;
				res.end(JSON.stringify({
					message: 'Visitor account created successfully!',
					userID: result.insertId,
					role: 'visitor'
				}));
			} catch (err) {
				if (err.code === 'ER_DUP_ENTRY') {
					res.statusCode = 409;
					res.end(JSON.stringify({ error: 'An account with this email already exists. Please log in instead.' }));
				} else {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
				}
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
	else if (req.method == 'DELETE' && req.url.startsWith('/api/employees/')) {
		const parts = req.url.split('/');
		const employeeID = parts[3];
		if (!employeeID || isNaN(employeeID)) {
			res.statusCode = 400;
			res.end(JSON.stringify({ error: 'A valid numeric Employee ID is required.' }));
			return;
		}
		try {
			const [result] = await pool.query(
				'UPDATE EMPLOYEE SET current = 0 WHERE employee_ID = ?',
				[employeeID]
			);
			if (result.affectedRows === 0) {
				res.statusCode = 404;
				res.end(JSON.stringify({ error: `Employee ID ${employeeID} was not found.` }));
			} else {
				// worked so update active history row as terminated
				await pool.query("UPDATE EMPLOYMENT_HISTORY SET status = 'terminated', end_date = CURDATE() WHERE employee_ID = ? AND status = 'active'", [employeeID]);
				res.statusCode = 200;
				res.end(JSON.stringify({ message: `Employee ID ${employeeID} deactivated successfully.` }));
			}
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: `Database error: ${err.message}, contact DBA` }));
		}
	}
	else if (req.url === '/api/employees' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
		});

		req.on('end', async () => {
			let data;
			try {
				data = JSON.parse(body);
			} catch {
				res.statusCode = 400;
				res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
				return;
			}

			const required = ['first_name', 'last_name', 'email', 'street_address', 'city', 'state', 'zip_code', 'country', 'department_ID', 'role', 'salary', 'hire_date'];
			for (const field of required) {
				if (!data[field] || data[field].toString().trim() === '') {
					res.statusCode = 400;
					res.end(JSON.stringify({ error: `Field '${field}' is required.` }));
					return;
				}
			}

			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				// 1. Insert into EMPLOYEE
				const [empResult] = await connection.query(
					`INSERT INTO EMPLOYEE 
					(first_name, minit, last_name, street_address, city, state, zip_code, country, email, phone_number, department_ID, role, salary, hire_date, \`current\`, hours, manager_ID) 
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
					[
						data.first_name.trim(),
						data.minit ? data.minit.trim() : null,
						data.last_name.trim(),
						data.street_address.trim(),
						data.city.trim(),
						data.state.trim(),
						data.zip_code.trim(),
						data.country.trim(),
						data.email.trim(),
						data.phone_number ? data.phone_number.trim() : null,
						data.department_ID,
						data.role.trim(),
						data.salary,
						data.hire_date,
						data.hours ? data.hours : null,
						data.manager_ID ? data.manager_ID : null
					]
				);

				const newEmployeeID = empResult.insertId;

				// 2. Insert initial record into EMPLOYMENT_HISTORY
				await connection.query(
					`INSERT INTO EMPLOYMENT_HISTORY 
					(employee_ID, department_ID, role, salary, start_date, end_date, status) 
					VALUES (?, ?, ?, ?, ?, NULL, 'active')`,
					[newEmployeeID, data.department_ID, data.role.trim(), data.salary, data.hire_date]
				);

				// 3. Insert login account into users with temporary password
				await connection.query(
					'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
					[data.email.trim(), 'welcome123', 'employee']
				);

				await connection.commit();

				res.statusCode = 201;
				res.end(JSON.stringify({
					message: `Employee ${data.first_name} ${data.last_name} created successfully (ID: ${newEmployeeID}). Login generated with temporary password 'welcome123'.`,
					employee_ID: newEmployeeID
				}));
			} catch (err) {
				await connection.rollback();

				if (err.code === 'ER_DUP_ENTRY') {
					res.statusCode = 409;
					res.end(JSON.stringify({ error: `An account or employee with email '${data.email}' already exists.` }));
				} else {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
				}
			} finally {
				connection.release();
			}
		});
	}
	else if (req.url === '/api/staffed-at' && req.method === 'POST') {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
		});
		req.on('end', async () => {
			try {
				const { employee_ID, attr_ID } = JSON.parse(body);
				if (!employee_ID || !attr_ID) {
					res.statusCode = 400;
					res.end(JSON.stringify({ error: 'Both employee_ID and attr_ID are required.' }));
					return;
				}
				await pool.query(
					'INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES (?, ?)',
					[employee_ID, attr_ID]
				);
				res.statusCode = 201;
				res.end(JSON.stringify({ message: 'Attraction assigned successfully.' }));
			} catch (err) {
				if (err.code === 'ER_DUP_ENTRY') {
					res.statusCode = 409;
					res.end(JSON.stringify({ error: 'Employee is already assigned to this attraction.' }));
				} else {
					res.statusCode = 500;
					res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
				}
			}
		});
	}
	else if (req.url === '/api/staffed-at' && req.method === 'DELETE') {
		let body = '';
		req.on('data', (chunk) => {
			body += chunk;
		});
		req.on('end', async () => {
			try {
				const { employee_ID, attr_ID } = JSON.parse(body);
				if (!employee_ID || !attr_ID) {
					res.statusCode = 400;
					res.end(JSON.stringify({ error: 'Both employee_ID and attr_ID are required.' }));
					return;
				}
				await pool.query(
					'DELETE FROM STAFFED_AT WHERE employee_ID = ? AND attr_ID = ?',
					[employee_ID, attr_ID]
				);
				res.statusCode = 200;
				res.end(JSON.stringify({ message: 'Attraction assignment removed successfully.' }));
			} catch (err) {
				res.statusCode = 500;
				res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
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
