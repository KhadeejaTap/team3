async function handleAttractions(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, 'http://localhost');
	const pathname = parsedUrl.pathname;

	const isAttractionRoute =
		pathname === '/api/attractions' ||
		/^\/api\/attractions\/\d+$/.test(pathname);

	if (!isAttractionRoute) {
		return false;
	}

	if (
		(req.url === '/api/attractions' || req.url.startsWith('/api/attractions?')) &&
		req.method === 'GET'
	) {
		try {
			const parsedUrl = new URL(req.url, 'http://localhost');
			const upcomingOnly = parsedUrl.searchParams.get('upcoming') === 'true';

			const query = upcomingOnly
				? `SELECT attr_ID, name, location, type, attr_datetime, description
				   FROM ATTRACTION
				   WHERE attr_datetime >= CURRENT_DATE
				   ORDER BY attr_datetime ASC, name ASC`
				: `SELECT attr_ID, name, location, type, attr_datetime, description
				   FROM ATTRACTION
				   ORDER BY name ASC`;

			const [rows] = await pool.query(query);
			res.end(JSON.stringify(rows));
		} catch (err) {
			res.statusCode = 500;
			res.end(
				JSON.stringify({ error: `Database error: ${err.message}` })
			);
		}
		return true;
	}

	if (
		(pathname === '/api/attractions' && req.method === 'POST') ||
		(req.method === 'PUT' && /^\/api\/attractions\/\d+$/.test(pathname))
	) {
		const attractionId = req.method === 'PUT'
			? Number(pathname.match(/^\/api\/attractions\/(\d+)$/)[1])
			: null;
		let attraction;
		try {
			attraction = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return true;
		}

		if (!attraction || typeof attraction !== 'object' || Array.isArray(attraction)) {
			send(res, 400, { error: 'Attraction details are required.' });
			return true;
		}

		const eventDateTime = attraction.attr_datetime || null;

		if (
			typeof attraction.name !== 'string' ||
			!attraction.name.trim() ||
			attraction.name.trim().length > 100 ||
			(attraction.type != null &&
				(typeof attraction.type !== 'string' || attraction.type.length > 30)) ||
			(attraction.location != null &&
				(typeof attraction.location !== 'string' || attraction.location.length > 40)) ||
			(attraction.description != null &&
				(typeof attraction.description !== 'string' || attraction.description.length > 500)) ||
			(attraction.capacity != null &&
				(!Number.isInteger(attraction.capacity) || attraction.capacity < 0))
		) {
			send(res, 400, { error: 'Enter valid attraction details.' });
			return true;
		}

		if (eventDateTime !== null) {
			const match = typeof eventDateTime === 'string'
				? eventDateTime.match(
					/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):([0-5]\d):00$/
				)
				: null;
			const parsedDate = match
				? new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)
				: null;

			if (
				!match ||
				Number(match[4]) > 23 ||
				Number.isNaN(parsedDate?.getTime()) ||
				parsedDate.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`
			) {
				send(res, 400, { error: 'Enter a valid event date and time.' });
				return true;
			}
		}

		const values = [
			attraction.name.trim(),
			attraction.type?.trim() || null,
			attraction.location?.trim() || null,
			eventDateTime,
			attraction.capacity ?? null,
			attraction.description?.trim() || null
		];

		try {
			if (attractionId !== null) {
				if (!Number.isSafeInteger(attractionId) || attractionId <= 0) {
					send(res, 400, { error: 'Invalid attraction ID.' });
					return true;
				}

				const [existing] = await pool.query(
					'SELECT attr_ID FROM ATTRACTION WHERE attr_ID = ?',
					[attractionId]
				);
				if (existing.length === 0) {
					send(res, 404, { error: 'Attraction not found.' });
					return true;
				}

				await pool.query(
					`UPDATE ATTRACTION
					 SET name = ?, type = ?, location = ?, attr_datetime = ?,
					     capacity = ?, description = ?
					 WHERE attr_ID = ?`,
					[...values, attractionId]
				);
				send(res, 200, {
					message: 'Attraction updated successfully',
					attr_ID: attractionId
				});
				return true;
			}

			const [result] = await pool.query(
				`INSERT INTO ATTRACTION
				 (name, type, location, attr_datetime, capacity, description)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				values
			);

			send(res, 201, {
				message: 'Attraction saved successfully',
				attr_ID: result.insertId
			});
			return true;
		} catch (err) {
			send(res, 500, { error: `Database error: ${err.message}` });
			return true;
		}
	}

	if (req.method === 'DELETE' && /^\/api\/attractions\/\d+$/.test(pathname)) {
		const attractionId = Number(pathname.match(/^\/api\/attractions\/(\d+)$/)[1]);

		if (!Number.isSafeInteger(attractionId) || attractionId <= 0) {
			send(res, 400, { error: 'Invalid attraction ID.' });
			return true;
		}

		try {
			const [existing] = await pool.query(
				'SELECT attr_ID FROM ATTRACTION WHERE attr_ID = ?',
				[attractionId]
			);

			if (existing.length === 0) {
				send(res, 404, { error: 'Attraction not found.' });
				return true;
			}

			await pool.query('DELETE FROM STAFFED_AT WHERE attr_ID = ?', [attractionId]);
			const [result] = await pool.query(
				'DELETE FROM ATTRACTION WHERE attr_ID = ?',
				[attractionId]
			);

			if (result.affectedRows === 0) {
				send(res, 404, { error: 'Attraction not found.' });
				return true;
			}

			send(res, 200, {
				message: 'Attraction deleted successfully',
				attr_ID: attractionId
			});
			return true;
		} catch (err) {
			send(res, 500, { error: `Database error: ${err.message}` });
			return true;
		}
	}

	return false;
}

module.exports = handleAttractions;
