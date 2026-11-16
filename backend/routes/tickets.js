async function handleTickets(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isTicketRoute =
		pathname === "/api/tickets" ||
		pathname === "/api/user/upcoming-tickets" ||
		pathname === "/api/user/profile" ||
		pathname === "/api/user/orders" ||
		pathname === "/api/register";

	if (!isTicketRoute) {
		return false;
	}

	if (
		pathname === '/api/tickets' &&
		req.method === 'POST'
	) {
		let ticket;
		try {
			ticket = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return true;
		}

		if (
			!ticket ||
			typeof ticket !== 'object' ||
			Array.isArray(ticket)
		) {
			send(res, 400, { error: 'Request body must contain ticket details.' });
			return true;
		}

		const visitDate = new Date(
			`${ticket.visit_date}T00:00:00.000Z`
		);

		const validVisitDate =
			typeof ticket.visit_date === 'string' &&
			/^\d{4}-\d{2}-\d{2}$/.test(ticket.visit_date) &&
			!Number.isNaN(visitDate.getTime()) &&
			visitDate.toISOString().slice(0, 10) === ticket.visit_date;

		const ticketPrices = { Adult: 25, Child: 15 };

		const ticketType =
			typeof ticket.ticket_type === 'string'
				? ticket.ticket_type.trim()
				: '';

		const price = Object.prototype.hasOwnProperty.call(
			ticketPrices,
			ticketType
		)
			? ticketPrices[ticketType]
			: undefined;

		const visitorName = ticket.visitor_name;

		const hasValidVisitorName =
			visitorName == null ||
			(
				typeof visitorName === 'string' &&
				visitorName.trim() !== '' &&
				visitorName.trim().length <= 100
			);

		if (
			price === undefined ||
			!validVisitDate ||
			!hasValidVisitorName
		) {
			send(res, 400, {
				error:
					'Choose a valid ticket type, enter a valid visit date, and provide an optional visitor name.'
			});
			return true;
		}

		const connection = await pool.getConnection();
		let ticketID;

		try {
			await connection.beginTransaction();

			let visitorID = null;
			const visitorEmail =
				typeof ticket.email === 'string' && ticket.email.trim()
					? ticket.email.trim()
					: null;

			if (visitorName != null && visitorName.trim() !== '') {
				const cleanName = visitorName.trim();
				let selectQuery = 'SELECT visitor_ID FROM VISITOR WHERE LOWER(name) = LOWER(?)';
				const queryParams = [cleanName];

				if (visitorEmail) {
					selectQuery += ' AND LOWER(email) = LOWER(?)';
					queryParams.push(visitorEmail);
				} else {
					selectQuery += ' AND email IS NULL';
				}

				const [existing] = await connection.query(selectQuery, queryParams);

				if (existing.length > 0) {
					visitorID = existing[0].visitor_ID;
				} else {
					const [visitorResult] = await connection.query(
						'INSERT INTO VISITOR (name, email) VALUES (?, ?)',
						[cleanName, visitorEmail]
					);
					visitorID = visitorResult.insertId;
				}
			} else if (visitorEmail) {
				const [existing] = await connection.query(
					'SELECT visitor_ID FROM VISITOR WHERE LOWER(email) = LOWER(?) ORDER BY visitor_ID ASC LIMIT 1',
					[visitorEmail]
				);
				if (existing.length > 0) {
					visitorID = existing[0].visitor_ID;
				} else {
					const [visitorResult] = await connection.query(
						'INSERT INTO VISITOR (name, email) VALUES (?, ?)',
						[visitorEmail.split('@')[0], visitorEmail]
					);
					visitorID = visitorResult.insertId;
				}
			}

			const [result] = await connection.query(
				`INSERT INTO TICKET
             (visitor_ID, ticket_type, price, purchase_date, visit_date)
             VALUES (?, ?, ?, CURRENT_DATE, ?)`,
				[
					visitorID,
					ticketType,
					price,
					ticket.visit_date
				]
			);

			await connection.commit();
			ticketID = result.insertId;
		} catch (err) {
			await connection.rollback();
			send(res, 500, { error: err.message });
			return true;
		} finally {
			connection.release();
		}

		send(res, 201, {
			message: 'Ticket purchased successfully',
			ticket_ID: ticketID
		});
		return true;
	} else if (
		(req.url === '/api/user/upcoming-tickets' || req.url.startsWith('/api/user/upcoming-tickets?')) &&
		req.method === 'GET'
	) {
		try {
			const parsedUrl = new URL(req.url, 'http://localhost');
			const email = parsedUrl.searchParams.get('email');

			if (!email || !email.trim()) {
				res.statusCode = 400;
				res.end(JSON.stringify({ error: 'Email query parameter is required.' }));
				return;
			}

			const query = `
        SELECT
          t.ticket_ID,
          t.ticket_type,
          t.price,
          DATE_FORMAT(t.visit_date, '%Y-%m-%d') AS visit_date,
          DATE_FORMAT(t.purchase_date, '%Y-%m-%d') AS purchase_date,
          v.name AS visitor_name
        FROM TICKET t
        JOIN VISITOR v ON t.visitor_ID = v.visitor_ID
        WHERE LOWER(v.email) = LOWER(?)
          AND t.visit_date >= CURRENT_DATE
        ORDER BY t.visit_date ASC, t.ticket_ID ASC
      `;

			const [rows] = await pool.query(query, [email.trim()]);
			res.end(JSON.stringify(rows));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
		}
	} else if (
		(req.url === '/api/user/profile' || req.url.startsWith('/api/user/profile?')) &&
		req.method === 'GET'
	) {
		try {
			const parsedUrl = new URL(req.url, 'http://localhost');
			const email = parsedUrl.searchParams.get('email');

			if (!email || !email.trim()) {
				res.statusCode = 400;
				res.end(JSON.stringify({ error: 'Email query parameter is required.' }));
				return;
			}

			const [rows] = await pool.query(
				'SELECT userID, email, first_name, last_name, role FROM users WHERE LOWER(email) = LOWER(?)',
				[email.trim()]
			);

			if (rows.length === 0) {
				res.statusCode = 404;
				res.end(JSON.stringify({ error: 'User not found.' }));
				return;
			}

			res.end(JSON.stringify(rows[0]));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
		}
	} else if (
		(req.url === '/api/user/orders' || req.url.startsWith('/api/user/orders?')) &&
		req.method === 'GET'
	) {
		try {
			const parsedUrl = new URL(req.url, 'http://localhost');
			const email = parsedUrl.searchParams.get('email');

			if (!email || !email.trim()) {
				res.statusCode = 400;
				res.end(JSON.stringify({ error: 'Email query parameter is required.' }));
				return;
			}

			const query = `
        SELECT
          ct.transaction_ID,
          ct.total,
          ct.payment_method,
          DATE_FORMAT(ct.transaction_date, '%Y-%m-%d %H:%i') AS transaction_date,
          ti.transaction_item_ID,
          ti.item_type,
          ti.quantity,
          ti.price,
          COALESCE(p.name, m.name, t.ticket_type, CONCAT(UPPER(SUBSTRING(ti.item_type, 1, 1)), LOWER(SUBSTRING(ti.item_type, 2)))) AS item_name
        FROM CUST_TRANSACTION ct
        JOIN VISITOR v ON ct.visitor_ID = v.visitor_ID
        JOIN TRANSACTION_ITEM ti ON ct.transaction_ID = ti.transaction_ID
        LEFT JOIN PRODUCT p ON ti.item_ID = p.product_ID AND ti.item_type = 'product'
        LEFT JOIN MENU_ITEM m ON ti.item_ID = m.item_ID AND ti.item_type = 'food'
        LEFT JOIN TICKET t ON ti.item_ID = t.ticket_ID AND ti.item_type = 'ticket'
        WHERE LOWER(v.email) = LOWER(?)
        ORDER BY ct.transaction_date DESC, ct.transaction_ID DESC
      `;

			const [rows] = await pool.query(query, [email.trim()]);

			const ordersMap = new Map();
			for (const row of rows) {
				if (!ordersMap.has(row.transaction_ID)) {
					ordersMap.set(row.transaction_ID, {
						transaction_ID: row.transaction_ID,
						total: row.total,
						payment_method: row.payment_method,
						transaction_date: row.transaction_date,
						items: []
					});
				}
				ordersMap.get(row.transaction_ID).items.push({
					item_ID: row.transaction_item_ID,
					item_type: row.item_type,
					item_name: row.item_name,
					quantity: row.quantity,
					price: row.price
				});
			}

			res.end(JSON.stringify(Array.from(ordersMap.values())));
		} catch (err) {
			res.statusCode = 500;
			res.end(JSON.stringify({ error: `Database error: ${err.message}` }));
		}
	} else if (
		pathname === '/api/register' &&
		req.method === 'POST'
	) {
		let body;
		try {
			body = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return true;
		}

		try {
			const { email, password, first_name, last_name } = body;

			if (!email || !password) {
				send(res, 400, { error: 'Both email and password are required.' });
				return true;
			}

			const firstName = typeof first_name === 'string' && first_name.trim() ? first_name.trim() : null;
			const lastName = typeof last_name === 'string' && last_name.trim() ? last_name.trim() : null;

			const [result] = await pool.query(
				'INSERT INTO users (email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
				[email.trim(), password.trim(), 'visitor', firstName, lastName]
			);

			send(res, 201, {
				message: 'Visitor account created successfully!',
				userID: result.insertId,
				role: 'visitor'
			});
			return true;
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') {
				send(res, 409, {
					error: 'An account with this email already exists. Please log in instead.'
				});
			} else {
				send(res, 500, { error: `Database error: ${err.message}` });
			}
			return true;
		}
	}
	return true;
}

module.exports = handleTickets;
