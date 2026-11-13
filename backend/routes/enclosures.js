const { requireRoles } = require("../auth");

async function handleEnclosures(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isEnclosureRoute =
		pathname === "/api/enclosures" ||
		pathname.startsWith("/api/enclosures/");

	if (!isEnclosureRoute) {
		return false;
	}

	if (
		req.method === 'GET' &&
    	pathname === '/api/enclosures'
	) {
		try {
			const allowed = await requireRoles(req, res, pool, send, ['admin', 'manager', 'employee']);
			if (!allowed) return;

			const [rows] = await pool.query(`
        SELECT
          e.enclosure_ID,
          e.name,
          e.location,
          e.capacity,
          e.indoor_outdoor,
          e.size,
          e.department_ID,
          e.condition_status,
          e.temperature,
          e.amenities,
          e.notes,
          COUNT(a.animal_ID) AS animal_count,
          CASE
            WHEN e.capacity > 0
              THEN ROUND(COUNT(a.animal_ID) / e.capacity * 100, 1)
            ELSE NULL
          END AS occupancy_percent,
          CASE
            WHEN e.capacity > 0
              AND COUNT(a.animal_ID) / e.capacity > 0.75
              THEN 1
            ELSE 0
          END AS crowding_flag
        FROM ENCLOSURE e
        LEFT JOIN ANIMAL a ON a.enclosure_ID = e.enclosure_ID
        GROUP BY
          e.enclosure_ID, e.name, e.location, e.capacity,
          e.indoor_outdoor, e.size, e.department_ID,
          e.condition_status, e.temperature, e.amenities, e.notes
        ORDER BY e.name
      `);

			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading enclosures:', err);
			send(res, 500, { error: 'Could not load enclosure details.' });
			return;
		}
	} else if (
		req.method === 'PUT' &&
		/^\/api\/enclosures\/\d+$/.test(req.url)
	) {
		try {
			const allowed = await requireRoles(req, res, pool, send, ['admin', 'manager', 'employee']);
			if (!allowed) return;

			const enclosureID = Number(req.url.split('/')[3]);
			const data = await readBody(req);

			const capacity = Number(data.capacity);
			const temperature =
				data.temperature === '' || data.temperature == null
					? null
					: Number(data.temperature);

			if (
				!data ||
				typeof data.name !== 'string' ||
				!data.name.trim() ||
				!Number.isInteger(capacity) ||
				capacity < 1 ||
				(temperature !== null && !Number.isFinite(temperature)) ||
				!['Good', 'Fair', 'Poor', 'Under Maintenance'].includes(data.condition_status) ||
				typeof data.amenities !== 'string' ||
				typeof data.notes !== 'string'
			) {
				send(res, 400, { error: 'Enter a name, valid capacity, valid temperature, condition, amenities, and notes.' });
				return;
			}

			const [result] = await pool.execute(
				`UPDATE ENCLOSURE
         SET name = ?, capacity = ?, condition_status = ?,
             temperature = ?, amenities = ?, notes = ?
         WHERE enclosure_ID = ?`,
				[
					data.name.trim(),
					capacity,
					data.condition_status,
					temperature,
					data.amenities.trim() || null,
					data.notes.trim() || null,
					enclosureID
				]
			);

			if (result.affectedRows === 0) {
				send(res, 404, { error: 'Enclosure not found.' });
				return;
			}

			send(res, 200, { message: 'Enclosure details updated successfully.' });
			return;
		} catch (err) {
			console.error('Error updating enclosure:', err);
			send(res, 500, { error: 'Could not update enclosure details.' });
			return;
		}
	} else if (
		req.method === 'GET' &&
		/^\/api\/enclosures\/\d+\/costs$/.test(req.url)
	) {
		try {
			const allowed = await requireRoles(req, res, pool, send, ['admin', 'manager', 'employee']);
			if (!allowed) return;

			const enclosureID = Number(req.url.split('/')[3]);
			const [rows] = await pool.query(
				`SELECT cost_ID, enclosure_ID, cost_category, description, amount, cost_date
         FROM ENCLOSURE_COST
         WHERE enclosure_ID = ?
         ORDER BY cost_date DESC, cost_ID DESC`,
				[enclosureID]
			);

			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading enclosure costs:', err);
			send(res, 500, { error: 'Could not load enclosure cost report.' });
			return;
		}
	} else if (
		req.method === 'GET' &&
		/^\/api\/enclosures\/\d+\/maintenance$/.test(req.url)
	) {
		try {
			const allowed = await requireRoles(req, res, pool, send, ['admin', 'manager', 'employee']);
			if (!allowed) return;

			const enclosureID = Number(req.url.split('/')[3]);
			const [rows] = await pool.query(
				`SELECT maintenance_ID, enclosure_ID, maintenance_date,
                maintenance_type, description, status, notes
         FROM ENCLOSURE_MAINTENANCE
         WHERE enclosure_ID = ?
         ORDER BY maintenance_date DESC, maintenance_ID DESC`,
				[enclosureID]
			);

			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading enclosure maintenance:', err);
			send(res, 500, { error: 'Could not load maintenance history.' });
			return;
		}
	} else if (
		req.method === 'POST' &&
		/^\/api\/enclosures\/\d+\/maintenance$/.test(req.url)
	) {
		try {
			const allowed = await requireRoles(req, res, pool, send, ['admin', 'manager', 'employee']);
			if (!allowed) return;

			const enclosureID = Number(req.url.split('/')[3]);
			const data = await readBody(req);
			const validDate =
				typeof data.maintenance_date === 'string' &&
				/^\d{4}-\d{2}-\d{2}$/.test(data.maintenance_date) &&
				!Number.isNaN(Date.parse(data.maintenance_date));

			if (
				!data ||
				!validDate ||
				typeof data.maintenance_type !== 'string' ||
				!data.maintenance_type.trim() ||
				typeof data.description !== 'string' ||
				!data.description.trim() ||
				!['Scheduled', 'In Progress', 'Completed', 'Needs Attention'].includes(data.status)
			) {
				send(res, 400, { error: 'Enter a valid date, maintenance type, description, and status.' });
				return;
			}

			const [enclosures] = await pool.query(
				'SELECT enclosure_ID FROM ENCLOSURE WHERE enclosure_ID = ?',
				[enclosureID]
			);

			if (enclosures.length === 0) {
				send(res, 404, { error: 'Enclosure not found.' });
				return;
			}

			const [result] = await pool.execute(
				`INSERT INTO ENCLOSURE_MAINTENANCE
         (enclosure_ID, maintenance_date, maintenance_type,
          description, status, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
				[
					enclosureID,
					data.maintenance_date,
					data.maintenance_type.trim(),
					data.description.trim(),
					data.status,
					typeof data.notes === 'string' ? data.notes.trim() || null : null
				]
			);

			send(res, 201, {
				message: 'Maintenance record added successfully.',
				maintenance_ID: result.insertId
			});
			return;
		} catch (err) {
			console.error('Error saving enclosure maintenance:', err);
			send(res, 500, { error: 'Could not save the maintenance record.' });
			return;
		}

	}
	return true;
}

module.exports = handleEnclosures;
