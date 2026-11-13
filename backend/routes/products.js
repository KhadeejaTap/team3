async function handleProducts(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isProductRoute =
		pathname === "/api/products" ||
		/^\/api\/products\/\d+$/.test(pathname) ||
		pathname === "/api/alerts/low-stock" ||
		pathname.startsWith("/api/alerts/low-stock/") ||
		pathname === "/api/alerts/upcoming-events";

	if (!isProductRoute) {
		return false;
	}

	try {
		const getQueries = {
			'/api/products': `
        SELECT p.*
        FROM product AS p
        ORDER BY p.product_ID
      `
		};

		if (
			req.method === 'GET' &&
			Object.hasOwn(getQueries, req.url)
		) {
			const [rows] = await pool.query(getQueries[req.url]);
			send(res, 200, rows);
			return true;
		}

		if (req.url === '/api/products' && req.method === 'POST') {
			const data = await readBody(req);

			const validText = (value, max) =>
				typeof value === 'string' &&
				value.trim().length > 0 &&
				value.trim().length <= max;

			const price = Number(data.price);
			const costPrice = data.cost_price !== undefined ? Number(data.cost_price) : 0.00;
			const stock = data.quantity_in_stock !== undefined ? parseInt(data.quantity_in_stock, 10) : 0;
			const reorderLevel = data.reorder_level !== undefined ? parseInt(data.reorder_level, 10) : 5;

			if (
				!data ||
				!validText(data.name, 100) ||
				!validText(data.category, 50) ||
				isNaN(price) || price < 0 ||
				isNaN(costPrice) || costPrice < 0 ||
				isNaN(stock) || stock < 0 ||
				isNaN(reorderLevel) || reorderLevel < 0
			) {
				send(res, 400, {
					error:
						'Check all fields. Name, category, price (>= 0), cost price (>= 0), and stock (>= 0) must be valid.'
				});
				return;
			}

			const [result] = await pool.execute(
				`INSERT INTO product
         (sku, name, category, color, cost_price, price, quantity_in_stock, reorder_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					data.sku && typeof data.sku === 'string' ? data.sku.trim() : null,
					data.name.trim(),
					data.category.trim(),
					data.color && typeof data.color === 'string' ? data.color.trim() : null,
					costPrice,
					price,
					stock,
					reorderLevel
				]
			);

			send(res, 201, {
				product_ID: result.insertId,
				message: 'Product added successfully.'
			});
			return;
		}

		const putProductMatch = req.url.match(/^\/api\/products\/(\d+)$/);
		if (putProductMatch && req.method === 'PUT') {
			const productId = parseInt(putProductMatch[1], 10);
			const data = await readBody(req);

			if (!data || typeof data !== 'object') {
				send(res, 400, { error: 'Request body required.' });
				return;
			}

			const fields = [];
			const params = [];

			if (data.name !== undefined) {
				if (typeof data.name !== 'string' || !data.name.trim()) {
					send(res, 400, { error: 'Name must be a non-empty string.' });
					return;
				}
				fields.push('name = ?');
				params.push(data.name.trim());
			}

			if (data.category !== undefined) {
				if (typeof data.category !== 'string' || !data.category.trim()) {
					send(res, 400, { error: 'Category must be a non-empty string.' });
					return;
				}
				fields.push('category = ?');
				params.push(data.category.trim());
			}

			if (data.color !== undefined) {
				fields.push('color = ?');
				params.push(data.color && typeof data.color === 'string' ? data.color.trim() : null);
			}

			if (data.sku !== undefined) {
				fields.push('sku = ?');
				params.push(data.sku && typeof data.sku === 'string' ? data.sku.trim() : null);
			}

			if (data.price !== undefined) {
				const p = Number(data.price);
				if (isNaN(p) || p < 0) {
					send(res, 400, { error: 'Price must be a non-negative number.' });
					return;
				}
				fields.push('price = ?');
				params.push(p);
			}

			if (data.cost_price !== undefined) {
				const cp = Number(data.cost_price);
				if (isNaN(cp) || cp < 0) {
					send(res, 400, { error: 'Cost price must be a non-negative number.' });
					return;
				}
				fields.push('cost_price = ?');
				params.push(cp);
			}

			if (data.quantity_in_stock !== undefined) {
				const qty = parseInt(data.quantity_in_stock, 10);
				if (isNaN(qty) || qty < 0) {
					send(res, 400, { error: 'Quantity in stock must be a non-negative integer.' });
					return;
				}
				fields.push('quantity_in_stock = ?');
				params.push(qty);
			}

			if (data.reorder_level !== undefined) {
				const rl = parseInt(data.reorder_level, 10);
				if (isNaN(rl) || rl < 0) {
					send(res, 400, { error: 'Reorder level must be a non-negative integer.' });
					return;
				}
				fields.push('reorder_level = ?');
				params.push(rl);
			}

			if (fields.length === 0) {
				send(res, 400, { error: 'No valid fields provided for update.' });
				return;
			}

			params.push(productId);
			const [updateResult] = await pool.execute(
				`UPDATE product SET ${fields.join(', ')} WHERE product_ID = ?`,
				params
			);

			if (updateResult.affectedRows === 0) {
				send(res, 404, { error: 'Product not found.' });
				return;
			}

			send(res, 200, { message: 'Product updated successfully.' });
			return;
		}

		const delProductMatch = req.url.match(/^\/api\/products\/(\d+)$/);
		if (delProductMatch && req.method === 'DELETE') {
			const productId = parseInt(delProductMatch[1], 10);

			try {
				const [delResult] = await pool.execute(
					'DELETE FROM product WHERE product_ID = ?',
					[productId]
				);

				if (delResult.affectedRows === 0) {
					send(res, 404, { error: 'Product not found.' });
					return;
				}

				send(res, 200, { message: 'Product deleted successfully.' });
				return;
			} catch (delErr) {
				if (delErr.code === 'ER_ROW_IS_REFERENCED_2') {
					send(res, 409, { error: 'Cannot delete product because existing customer transactions reference it.' });
					return;
				}
				throw delErr;
			}
		}

	} catch (err) {
		console.error(err);
		send(res, err.status || 500, {
			error: err.status ? err.message : "Server error"
		});
		return true;
	}

	if (req.url.startsWith('/api/alerts/low-stock') && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
        SELECT
          a.alert_ID,
          a.product_ID,
          p.sku,
          p.name AS product_name,
          p.category,
          p.quantity_in_stock AS current_stock,
          p.reorder_level,
          a.stock_at_alert,
          a.status,
          a.created_at,
          CASE
            WHEN p.quantity_in_stock > p.reorder_level THEN 'Restocked'
            ELSE 'Low'
          END AS stock_condition
        FROM low_stock_alert a
        JOIN product p ON a.product_ID = p.product_ID
        ORDER BY a.created_at DESC
      `);
			send(res, 200, rows);
		} catch (err) {
			send(res, 500, { error: err.message });
		}
	} else if (req.url === '/api/alerts/upcoming-events' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
        SELECT
          a.attr_ID,
          a.name,
          a.type,
          a.location,
          a.attr_datetime,
          a.capacity,
          GROUP_CONCAT(CONCAT(e.first_name, ' ', e.last_name) ORDER BY e.last_name SEPARATOR ', ') AS staffed_employees,
          COUNT(sa.employee_ID) AS staff_count
        FROM ATTRACTION a
        LEFT JOIN STAFFED_AT sa ON a.attr_ID = sa.attr_ID
        LEFT JOIN EMPLOYEE e ON sa.employee_ID = e.employee_ID AND e.current = 1
        WHERE a.attr_datetime BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
        GROUP BY a.attr_ID, a.name, a.type, a.location, a.attr_datetime, a.capacity
        ORDER BY a.attr_datetime ASC
      `);
			send(res, 200, rows);
		} catch (err) {
			send(res, 500, { error: err.message });
		}
	} else if (req.url.startsWith('/api/alerts/low-stock/') && (req.method === 'PATCH' || req.method === 'PUT')) {
		try {
			const parts = req.url.split('/');
			const alertID = parts[4];
			const body = await readBody(req);
			const validStatuses = ['unaddressed', 'order placed', 'dismissed'];

			if (!body.status || !validStatuses.includes(body.status)) {
				send(res, 400, { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
				return;
			}

			const [result] = await pool.query(
				'UPDATE low_stock_alert SET status = ? WHERE alert_ID = ?',
				[body.status, alertID]
			);

			if (result.affectedRows === 0) {
				send(res, 404, { error: `Alert ID ${alertID} not found.` });
				return;
			}

			send(res, 200, { message: `Alert status updated to '${body.status}'.`, status: body.status });
		} catch (err) {
			send(res, 500, { error: err.message });
		}

	}
	return true;
}

module.exports = handleProducts;
