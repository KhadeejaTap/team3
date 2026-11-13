async function handleEmployees(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isEmployeeRoute =
		(pathname === "/api/employees" && ["GET", "POST"].includes(req.method)) ||
		(pathname.startsWith("/api/manager") && req.method === "GET") ||
		(pathname === "/api/admin" && req.method === "GET") ||
		(pathname === "/api/hr" && req.method === "GET") ||
		(pathname.startsWith("/api/employees/") && ["PUT", "DELETE"].includes(req.method)) ||
		(pathname === "/api/staffed-at" && ["POST", "DELETE"].includes(req.method)) ||
		(pathname === "/api/department/set-head" && req.method === "POST");

	if (!isEmployeeRoute) {
		return false;
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
	} else if (
		req.url.startsWith('/api/manager') &&
		req.method === 'GET'
	) {
		try {
			const parsedUrl = new URL(req.url, 'http://localhost');
			const email = parsedUrl.searchParams.get('email');
			let query = 'SELECT * FROM manager_view';
			const params = [];

			if (email) {
				const [emp] = await pool.query('SELECT department_ID FROM EMPLOYEE WHERE email = ?', [email]);
				const isFinHR = emp.length > 0 && emp[0].department_ID === 1;

				if (!isFinHR) {
					query +=
						' WHERE department_ID = (SELECT department_ID FROM EMPLOYEE WHERE email = ?)';
					params.push(email);
				}
			}

			const [rows] = await pool.query(query, params);
			res.end(JSON.stringify(rows));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}
	} else if (req.url === '/api/admin' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM admin_view');
			res.end(JSON.stringify(rows));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}
	} else if (req.url === '/api/hr' && req.method === 'GET') {
		try {
			const [rows] = await pool.query('SELECT * FROM admin_view WHERE department_ID = 1');
			res.end(JSON.stringify(rows));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: err.message }));
		}

	} else if (		req.method === 'DELETE' &&
		req.url.startsWith('/api/employees/')
	) {
		const parts = req.url.split('/');
		const employeeID = parts[3];

		if (!employeeID || isNaN(employeeID)) {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					error: 'A valid numeric Employee ID is required.'
				})
			);
			return;
		}

		try {
			const requesterEmail = req.headers['x-user-email'] || req.headers['user-email'];
			if (requesterEmail) {
				const [authRows] = await pool.query(
					`SELECT e.employee_ID
           FROM employee e
           JOIN department d ON e.department_ID = d.department_ID
           WHERE e.email = ? AND e.department_ID = 1 AND e.employee_ID = d.head_employee_ID`,
					[requesterEmail.trim()]
				);

				if (authRows.length === 0) {
					res.statusCode = 403;
					res.end(
						JSON.stringify({
							error: 'Permission denied: Only the Financial & HR Director is authorized to terminate employees.'
						})
					);
					return;
				}
			}

			const [result] = await pool.query(
				'UPDATE EMPLOYEE SET current = 0 WHERE employee_ID = ?',
				[employeeID]
			);

			if (result.affectedRows === 0) {
				res.statusCode = 404;
				res.end(
					JSON.stringify({
						error: `Employee ID ${employeeID} was not found.`
					})
				);
			} else {
				await pool.query(
					`UPDATE EMPLOYMENT_HISTORY
           SET status = 'terminated', end_date = CURDATE()
           WHERE employee_ID = ? AND status = 'active'`,
					[employeeID]
				);

				res.statusCode = 200;
				res.end(
					JSON.stringify({
						message: `Employee ID ${employeeID} deactivated successfully.`
					})
				);
			}
		} catch (err) {
			res.statusCode = 500;
			res.end(
				JSON.stringify({
					error: `Database error: ${err.message}, contact DBA`
				})
			);
		}
	} else if (
		req.method === 'PUT' &&
		req.url.startsWith('/api/employees/')
	) {
		const parts = req.url.split('/');
		const employeeID = parts[3];

		if (!employeeID || isNaN(employeeID)) {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					error: 'A valid numeric Employee ID is required.'
				})
			);
			return;
		}

		let data;
		try {
			data = await readBody(req);
		} catch {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					error: 'Invalid JSON request body.'
				})
			);
			return;
		}

			const allowedFields = [
				'first_name',
				'minit',
				'last_name',
				'sex',
				'street_address',
				'city',
				'state',
				'zip_code',
				'country',
				'email',
				'phone_number',
				'department_ID',
				'role',
				'salary',
				'hire_date',
				'hours',
				'manager_ID'
			];

			const updates = [];
			const params = [];

			for (const field of allowedFields) {
				if (data[field] !== undefined) {
					updates.push(`\`${field}\` = ?`);
					params.push(data[field]);
				}
			}

			if (updates.length === 0) {
				res.statusCode = 400;
				res.end(
					JSON.stringify({
						error: 'No valid fields provided to update.'
					})
				);
				return;
			}

			params.push(employeeID);

			const connection = await pool.getConnection();

			try {
				await connection.beginTransaction();

				const [oldEmp] = await connection.query(
					'SELECT email FROM EMPLOYEE WHERE employee_ID = ?',
					[employeeID]
				);

				if (oldEmp.length > 0) {
					const userUpdates = [];
					const userParams = [];

					if (data.email && data.email.trim() !== oldEmp[0].email) {
						userUpdates.push('email = ?');
						userParams.push(data.email.trim());
					}
					if (data.first_name !== undefined) {
						userUpdates.push('first_name = ?');
						userParams.push(data.first_name.trim());
					}
					if (data.last_name !== undefined) {
						userUpdates.push('last_name = ?');
						userParams.push(data.last_name.trim());
					}

					if (userUpdates.length > 0) {
						userParams.push(oldEmp[0].email);
						await connection.query(
							`UPDATE users SET ${userUpdates.join(', ')} WHERE email = ?`,
							userParams
						);
					}
				}

				const [result] = await connection.query(
					`UPDATE EMPLOYEE
           SET ${updates.join(', ')}
           WHERE employee_ID = ?`,
					params
				);

				if (result.affectedRows === 0) {
					await connection.rollback();
					res.statusCode = 404;
					res.end(
						JSON.stringify({
							error: `Employee ID ${employeeID} was not found.`
						})
					);
					return;
				}

				if (
					data.department_ID !== undefined ||
					data.role !== undefined ||
					data.salary !== undefined ||
					data.hire_date !== undefined
				) {
					const histUpdates = [];
					const histParams = [];

					if (data.department_ID !== undefined) {
						histUpdates.push('department_ID = ?');
						histParams.push(data.department_ID);
					}

					if (data.role !== undefined) {
						histUpdates.push('role = ?');
						histParams.push(data.role);
					}

					if (data.salary !== undefined) {
						histUpdates.push('salary = ?');
						histParams.push(data.salary);
					}

					if (data.hire_date !== undefined) {
						histUpdates.push('start_date = ?');
						histParams.push(data.hire_date);
					}

					histParams.push(employeeID);

					await connection.query(
						`UPDATE EMPLOYMENT_HISTORY
             SET ${histUpdates.join(', ')}
             WHERE employee_ID = ? AND status = 'active'`,
						histParams
					);
				}

				await connection.commit();

				res.statusCode = 200;
				res.end(
					JSON.stringify({
						message: `Employee ID ${employeeID} updated successfully.`
					})
				);
			} catch (err) {
				await connection.rollback();

				if (err.code === 'ER_DUP_ENTRY') {
					res.statusCode = 409;
					const isSSN = err.sqlMessage && (err.sqlMessage.includes('ssn') || err.sqlMessage.includes('SSN'));
					res.end(
						JSON.stringify({
							error: isSSN
								? `An employee with SSN '${data.ssn}' already exists.`
								: `An account or employee with email '${data.email || ''}' already exists.`
						})
					);
				} else {
					res.statusCode = 500;
					res.end(
						JSON.stringify({
							error: `Database error: ${err.message}`
						})
					);
				}
			} finally {
				connection.release();
			}
	} else if (
		req.url === '/api/employees' &&
		req.method === 'POST'
	) {
		let data;
		try {
			data = await readBody(req);
		} catch {
			res.statusCode = 400;
			res.end(
				JSON.stringify({
					error: 'Invalid JSON request body.'
				})
			);
			return;
		}

			const required = [
				'first_name',
				'last_name',
				'ssn',
				'street_address',
				'city',
				'state',
				'zip_code',
				'country',
				'department_ID',
				'role',
				'salary',
				'hire_date'
			];

			for (const field of required) {
				if (!data[field] || data[field].toString().trim() === '') {
					res.statusCode = 400;
					res.end(
						JSON.stringify({
							error: `Field '${field}' is required.`
						})
					);
					return;
				}
			}

			const cleanFirst = data.first_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			const cleanLast = data.last_name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
			const finalEmail = (data.email && data.email.toString().trim() !== '')
				? data.email.toString().trim()
				: `${cleanFirst}.${cleanLast}@gmail.com`;

			const connection = await pool.getConnection();

			try {
				await connection.beginTransaction();

				let assignedManagerID = data.manager_ID ? Number(data.manager_ID) : null;
				if (!assignedManagerID && data.department_ID) {
					const [deptHead] = await connection.query(
						'SELECT head_employee_ID FROM DEPARTMENT WHERE department_ID = ?',
						[data.department_ID]
					);
					if (deptHead.length > 0 && deptHead[0].head_employee_ID) {
						assignedManagerID = deptHead[0].head_employee_ID;
					}
				}

				const [empResult] = await connection.query(
					`INSERT INTO EMPLOYEE
           (first_name, minit, ssn, last_name, sex, street_address, city,
            state, zip_code, country, email, phone_number,
            department_ID, role, salary, hire_date,
            \`current\`, hours, manager_ID)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
					[
						data.first_name.trim(),
						data.minit ? data.minit.trim() : null,
						data.ssn.toString().trim(),
						data.last_name.trim(),
						data.sex && ['M', 'F', 'Other'].includes(data.sex.toString().trim()) ? data.sex.toString().trim() : 'Other',
						data.street_address.trim(),
						data.city.trim(),
						data.state.trim(),
						data.zip_code.trim(),
						data.country.trim(),
						finalEmail,
						data.phone_number ? data.phone_number.trim() : null,
						data.department_ID,
						data.role.trim(),
						data.salary,
						data.hire_date,
						data.hours ? data.hours : null,
						assignedManagerID
					]
				);

				const newEmployeeID = empResult.insertId;

				await connection.query(
					`INSERT INTO EMPLOYMENT_HISTORY
           (employee_ID, department_ID, role, salary,
            start_date, end_date, status)
           VALUES (?, ?, ?, ?, ?, NULL, 'active')`,
					[
						newEmployeeID,
						data.department_ID,
						data.role.trim(),
						data.salary,
						data.hire_date
					]
				);

				const paychecks = generatePaychecksForPeriod(
					newEmployeeID,
					Number(data.department_ID),
					Number(data.salary),
					data.hire_date
				);

				for (let i = 0; i < paychecks.length; i += 500) {
					await connection.query(
						`INSERT INTO PAYCHECK
             (employee_ID, department_ID, pay_period_start, pay_period_end,
              payment_date, gross_pay, federal_tax, fica_tax, state_tax,
              benefits_deduction, net_pay, payment_method)
             VALUES ?`,
						[paychecks.slice(i, i + 500)]
					);
				}

				const defaultPassword = `${data.first_name.trim().toLowerCase()}123`;
				const userRole = (data.user_role && ['admin', 'manager', 'employee'].includes(data.user_role))
					? data.user_role
					: (!data.manager_ID || (data.role && /(lead|director|chief|manager|supervisor)/i.test(data.role))
						? 'manager'
						: 'employee');

				await connection.query(
					'INSERT INTO users (email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
					[finalEmail, defaultPassword, userRole, data.first_name.trim(), data.last_name.trim()]
				);

				if (data.attr_ID) {
					await connection.query(
						'INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES (?, ?)',
						[newEmployeeID, data.attr_ID]
					);
				}

				await connection.commit();

				res.statusCode = 201;
				res.end(
					JSON.stringify({
						message:
							`Employee ${data.first_name} ${data.last_name} created successfully (ID: ${newEmployeeID}). Login generated: ${finalEmail} with password '${defaultPassword}' (${userRole}).`,
						employee_ID: newEmployeeID,
						generatedEmail: finalEmail,
						generatedPassword: defaultPassword
					})
				);
			} catch (err) {
				await connection.rollback();

				if (err.code === 'ER_DUP_ENTRY') {
					res.statusCode = 409;
					const isSSN = err.sqlMessage && (err.sqlMessage.includes('ssn') || err.sqlMessage.includes('SSN'));
					res.end(
						JSON.stringify({
							error: isSSN
								? `An employee with SSN '${data.ssn}' already exists.`
								: `An account or employee with email '${data.email || finalEmail || ''}' already exists.`
						})
					);
				} else {
					res.statusCode = 500;
					res.end(
						JSON.stringify({
							error: `Database error: ${err.message}`
						})
					);
				}
			} finally {
				connection.release();
			}
	} else if (
		pathname === '/api/department/set-head' &&
		req.method === 'POST'
	) {
		try {
			const body = await readBody(req);
			const { employee_ID, department_ID } = body;

			if (!employee_ID || !department_ID) {
				send(res, 400, { error: 'Both employee_ID and department_ID are required.' });
				return;
			}

			const connection = await pool.getConnection();
			try {
				await connection.beginTransaction();

				const [emp] = await connection.query(
					'SELECT employee_ID, department_ID, email, first_name, last_name FROM EMPLOYEE WHERE employee_ID = ? AND `current` = 1',
					[employee_ID]
				);

				if (emp.length === 0) {
					await connection.rollback();
					send(res, 404, { error: `Active employee ID ${employee_ID} not found.` });
					return;
				}

				if (Number(emp[0].department_ID) !== Number(department_ID)) {
					await connection.rollback();
					send(res, 400, { error: `Employee ${emp[0].first_name} ${emp[0].last_name} belongs to department ${emp[0].department_ID}, not ${department_ID}.` });
					return;
				}

				const [prevHeadRows] = await connection.query(
					'SELECT head_employee_ID FROM DEPARTMENT WHERE department_ID = ?',
					[department_ID]
				);
				const oldHeadID = prevHeadRows.length > 0 ? prevHeadRows[0].head_employee_ID : null;

				await connection.query(
					'UPDATE DEPARTMENT SET head_employee_ID = ? WHERE department_ID = ?',
					[employee_ID, department_ID]
				);

				await connection.query(
					'UPDATE EMPLOYEE SET manager_ID = NULL WHERE employee_ID = ?',
					[employee_ID]
				);

				if (emp[0].email) {
					await connection.query(
						"UPDATE users SET role = 'manager' WHERE email = ?",
						[emp[0].email]
					);
				}

				if (oldHeadID && Number(oldHeadID) !== Number(employee_ID)) {
					const [oldHeadEmp] = await connection.query(
						'SELECT email FROM EMPLOYEE WHERE employee_ID = ?',
						[oldHeadID]
					);
					if (oldHeadEmp.length > 0 && oldHeadEmp[0].email) {
						await connection.query(
							"UPDATE users SET role = 'employee' WHERE email = ?",
							[oldHeadEmp[0].email]
						);
					}
					await connection.query(
						'UPDATE EMPLOYEE SET manager_ID = ? WHERE employee_ID = ?',
						[employee_ID, oldHeadID]
					);
				}

				await connection.commit();

				send(res, 200, {
					success: true,
					message: `${emp[0].first_name} ${emp[0].last_name} is now the Department Head of department ${department_ID}.`,
					head_employee_ID: employee_ID,
					department_ID
				});
			} catch (err) {
				await connection.rollback();
				throw err;
			} finally {
				connection.release();
			}
		} catch (err) {
			send(res, 500, { error: err.message });
		}
	} else if (
		pathname === '/api/staffed-at' &&
		req.method === 'POST'
	) {
		try {
			const body = await readBody(req);
			const { employee_ID, attr_ID } = body;

			if (!employee_ID || !attr_ID) {
				send(res, 400, { error: 'Both employee_ID and attr_ID are required.' });
				return;
			}

			await pool.query(
				'INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES (?, ?)',
				[employee_ID, attr_ID]
			);

			send(res, 201, {
				message: 'Attraction assigned successfully.'
			});
		} catch (err) {
			if (err.sqlState === '45000') {
				send(res, 400, {
					error: err.sqlMessage || err.message
				});
			} else if (err.code === 'ER_DUP_ENTRY') {
				send(res, 409, {
					error: 'Employee is already assigned to this attraction.'
				});
			} else {
				send(res, 500, {
					error: `Database error: ${err.message}`
				});
			}
		}
	} else if (
		pathname === '/api/staffed-at' &&
		req.method === 'DELETE'
	) {
		try {
			const body = await readBody(req);
			const { employee_ID, attr_ID } = body;

			if (!employee_ID || !attr_ID) {
				send(res, 400, { error: 'Both employee_ID and attr_ID are required.' });
				return;
			}

			await pool.query(
				'DELETE FROM STAFFED_AT WHERE employee_ID = ? AND attr_ID = ?',
				[employee_ID, attr_ID]
			);

			send(res, 200, {
				message: 'Attraction assignment removed successfully.'
			});
		} catch (err) {
			send(res, 500, {
				error: `Database error: ${err.message}`
			});
		}
	}
	return true;
}

module.exports = handleEmployees;
