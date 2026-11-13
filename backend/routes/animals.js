
async function handleAnimals(req, res, pool, send, readBody) {
	const parsedUrl = new URL(req.url, "http://localhost");
	const pathname = parsedUrl.pathname;

	const isAnimalRoute =
		pathname === "/api/reports/species" ||
		pathname === "/api/medical-records/animals" ||
		pathname === "/api/medical-records" ||
		pathname === "/api/breeding-program" ||
		pathname === "/api/public/animals" ||
		pathname === "/api/animals" ||
		/^\/api\/animals\/\d+$/.test(pathname) ||
		/^\/api\/animals\/\d+\/remove$/.test(pathname) ||
		pathname === "/api/public/feeding-schedule" ||
		pathname === "/api/medical-costs" ||
		pathname === "/api/reports/medical-costs" ||
		pathname === "/api/species";

	if (!isAnimalRoute) {
		return false;
	}

	if (pathname === '/api/reports/species' && req.method === 'GET') {
		try {
			const email = parsedUrl.searchParams.get('email');
			const statusFilter = parsedUrl.searchParams.get('status');
			const sortBy = parsedUrl.searchParams.get('sort_by') || 'population_desc';

			if (!email) {
				send(res, 401, { error: 'Authentication required. Please log in to view the species report.' });
				return;
			}

			const [emp] = await pool.query('SELECT department_ID FROM EMPLOYEE WHERE email = ?', [email]);
			const deptId = emp.length > 0 ? emp[0].department_ID : null;

			if (deptId !== 2 && deptId !== 1) {
				send(res, 403, { error: 'Access restricted to Animal Operations and Zoo Leadership personnel.' });
				return;
			}

			let query = `
				SELECT
					s.species_ID,
					s.common_name,
					s.scientific_name,
					COALESCE(s.endangered_status, 'Unknown') AS endangered_status,
					COUNT(a.animal_ID) AS total_count,
					COALESCE(ROUND(AVG(a.age), 1), 0) AS average_age,
					COUNT(CASE WHEN a.breeding_status = 'Breeding' THEN 1 END) AS breeding_count
				FROM SPECIES s
				LEFT JOIN ANIMAL a ON s.species_ID = a.species_ID
			`;
			const params = [];

			if (statusFilter && statusFilter !== 'all') {
				query += ' WHERE s.endangered_status = ?';
				params.push(statusFilter);
			}

			query += ' GROUP BY s.species_ID, s.common_name, s.scientific_name, s.endangered_status';

			const sortColumns = {
				population_desc: 'total_count DESC',
				population_asc: 'total_count ASC',
				avg_age: 'average_age DESC',
				name: 's.common_name ASC'
			};

			query += ` ORDER BY ${sortColumns[sortBy] || 'total_count DESC'}`;

			const [rows] = await pool.query(query, params);
			send(res, 200, rows);
		} catch (err) {
			console.error('Error generating species report:', err);
			send(res, 500, { error: err.message });
		}
	} else if (req.url === '/api/medical-records/animals' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
				SELECT a.animal_ID, a.name, a.age, a.gender, s.common_name,
					(SELECT mr.follow_up FROM MEDICAL_RECORD mr
					 WHERE mr.animal_ID = a.animal_ID
					 ORDER BY mr.record_ID DESC LIMIT 1) AS next_appointment
				FROM ANIMAL a
				LEFT JOIN SPECIES s ON s.species_ID = a.species_ID
				ORDER BY a.name
			`);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading animals for medical records:', err);
			send(res, 500, { error: 'Could not load animals for medical records.' });
			return;
		}
	} else if (req.url.startsWith('/api/medical-records?') && req.method === 'GET') {
		const animalID = Number(parsedUrl.searchParams.get('animal_ID'));

		if (!Number.isInteger(animalID) || animalID <= 0) {
			send(res, 400, { error: 'A valid animal ID is required.' });
			return;
		}

		try {
			const [rows] = await pool.query(
				`SELECT record_ID, animal_ID, date, diagnosis, treatment, notes,
					vet_ID, follow_up, is_sick
				 FROM MEDICAL_RECORD
				 WHERE animal_ID = ?
				 ORDER BY date DESC, record_ID DESC`,
				[animalID]
			);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading medical history:', err);
			send(res, 500, { error: 'Could not load medical history.' });
			return;
		}
	} else if (req.url === '/api/medical-records' && req.method === 'POST') {
		let record;
		try {
			record = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return;
		}

		const animalID = Number(record?.animal_ID);

		if (!Number.isInteger(animalID) || animalID <= 0 ||
			!record?.diagnosis?.trim() || !record?.treatment?.trim()) {
			send(res, 400, { error: 'Select an animal and enter a diagnosis and treatment.' });
			return;
		}

		const isSick = record.is_sick === true;
		let followUp = null;

		if (!isSick && record.follow_up) {
			const value = String(record.follow_up).replace('T', ' ');

			if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(value)) {
				send(res, 400, { error: 'Enter a valid follow-up date and time.' });
				return;
			}

			followUp = value.length === 16 ? `${value}:00` : value;
		}

		try {
			const [animalRows] = await pool.query(
				'SELECT animal_ID FROM ANIMAL WHERE animal_ID = ?',
				[animalID]
			);

			if (animalRows.length === 0) {
				send(res, 404, { error: 'Animal not found.' });
				return;
			}

			const [result] = await pool.execute(
				`INSERT INTO MEDICAL_RECORD
					(animal_ID, date, diagnosis, treatment, notes, vet_ID, follow_up, is_sick)
				 VALUES (?, CURDATE(), ?, ?, ?, ?,
					CASE WHEN ? = 1
						THEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 9 HOUR
						ELSE ? END, ?)`,
				[
					animalID,
					record.diagnosis.trim(),
					record.treatment.trim(),
					record.notes?.trim() || null,
					record.vet_ID ? Number(record.vet_ID) : null,
					isSick ? 1 : 0,
					followUp,
					isSick ? 1 : 0
				]
			);

			send(res, 201, {
				message: isSick
					? 'Medical record saved. Follow-up scheduled for tomorrow at 9:00 AM.'
					: 'Medical record saved successfully.',
				record_ID: result.insertId
			});
			return;
		} catch (err) {
			console.error('Error saving medical record:', err);
			send(res, 500, { error: 'Could not save medical record. Check that the MEDICAL_RECORD columns and foreign keys match the schema.' });
			return;
		}
	} else if (pathname === '/api/medical-costs' && req.method === 'GET') {
		const recordID = Number(parsedUrl.searchParams.get('record_ID'));

		if (!Number.isInteger(recordID) || recordID <= 0) {
			send(res, 400, { error: 'A valid medical record ID is required.' });
			return;
		}

		try {
			const [rows] = await pool.query(
				`SELECT medical_cost_ID, record_ID, cost_category, description,
					amount, cost_date
				 FROM MEDICAL_COST
				 WHERE record_ID = ?
				 ORDER BY cost_date DESC, medical_cost_ID DESC`,
				[recordID]
			);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading medical costs:', err);
			send(res, 500, { error: 'Could not load medical costs.' });
			return;
		}
	} else if (pathname === '/api/medical-costs' && req.method === 'POST') {
		let cost;

		try {
			cost = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return;
		}

		const recordID = Number(cost?.record_ID);
		const category = typeof cost?.cost_category === 'string' ? cost.cost_category.trim() : '';
		const description = typeof cost?.description === 'string' ? cost.description.trim() : '';
		const amount = Number(cost?.amount);
		const costDate = cost?.cost_date || null;

		if (
			!Number.isInteger(recordID) || recordID <= 0 ||
			!category || category.length > 100 ||
			description.length > 255 ||
			!Number.isFinite(amount) || amount <= 0 ||
			(costDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(costDate)))
		) {
			send(res, 400, {
				error: 'Provide a valid record ID, cost category, optional description, positive amount, and valid cost date.'
			});
			return;
		}

		try {
			const [recordRows] = await pool.query(
				'SELECT record_ID FROM MEDICAL_RECORD WHERE record_ID = ?',
				[recordID]
			);

			if (recordRows.length === 0) {
				send(res, 404, { error: 'Medical record not found.' });
				return;
			}

			const [result] = await pool.execute(
				`INSERT INTO MEDICAL_COST
					(record_ID, cost_category, description, amount, cost_date)
				 VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_DATE))`,
				[recordID, category, description || null, amount, costDate]
			);

			send(res, 201, {
				message: 'Medical cost saved successfully.',
				medical_cost_ID: result.insertId
			});
			return;
		} catch (err) {
			console.error('Error saving medical cost:', err);
			send(res, 500, { error: 'Could not save medical cost.' });
			return;
		}
	} else if (pathname === '/api/reports/medical-costs' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
				SELECT
					mc.medical_cost_ID,
					mc.record_ID,
					mc.cost_category,
					mc.description,
					mc.amount,
					mc.cost_date,
					mr.animal_ID,
					a.name AS animal_name,
					s.common_name AS species_name,
					mr.diagnosis,
					mr.treatment
				FROM MEDICAL_COST mc
				JOIN MEDICAL_RECORD mr ON mc.record_ID = mr.record_ID
				JOIN ANIMAL a ON mr.animal_ID = a.animal_ID
				LEFT JOIN SPECIES s ON a.species_ID = s.species_ID
				ORDER BY mc.cost_date DESC, mc.medical_cost_ID DESC
			`);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error loading medical cost report:', err);
			send(res, 500, { error: 'Could not load medical cost report.' });
			return;
		}
	} else if (pathname === '/api/breeding-program' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
				SELECT
					a.animal_ID,
					a.name,
					s.common_name,
					a.age,
					a.gender,
					e.name AS enclosure_name,
					a.breeding_status
				FROM ANIMAL a
				JOIN SPECIES s ON a.species_ID = s.species_ID
				JOIN ENCLOSURE e ON a.enclosure_ID = e.enclosure_ID
				WHERE a.breeding_status = 'Breeding'
					AND NOT EXISTS (
						SELECT 1 FROM ANIMAL_REMOVAL ar
						WHERE ar.animal_ID = a.animal_ID
					)
				ORDER BY s.common_name, a.name
			`);
			send(res, 200, rows);
		} catch (err) {
			console.error('Error loading breeding program:', err);
			send(res, 500, { error: err.message });
		}
	} else if (pathname === '/api/public/feeding-schedule' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
				SELECT
					s.schedule_ID,
					s.enclosure_ID,
					e.name AS enclosure_name,
					s.feeding_time
				FROM ENCLOSURE_FEEDING_SCHEDULE s
				JOIN ENCLOSURE e ON s.enclosure_ID = e.enclosure_ID
				ORDER BY e.enclosure_ID ASC, s.feeding_time ASC
			`);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error fetching public feeding schedule:', err);
			send(res, 500, { error: 'Could not load the feeding schedule.' });
			return;
		}
	} else if (pathname === '/api/public/animals' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(
				`SELECT
					a.animal_ID,
					a.name,
					a.age,
					a.arrival_date,
					a.gender,
					COALESCE(s.endangered_status, 'Unknown') AS endangered_status,
					a.weight,
					a.weight_unit,
					a.image_url
				FROM ANIMAL a
				LEFT JOIN SPECIES s ON a.species_ID = s.species_ID
				WHERE NOT EXISTS (
					SELECT 1 FROM ANIMAL_REMOVAL ar
					WHERE ar.animal_ID = a.animal_ID
				)
				ORDER BY a.name`
			);
			send(res, 200, rows);
		} catch (err) {
			console.error('Error fetching public animal directory:', err);
			send(res, 500, { error: 'Could not load the animal directory.' });
			return;
		}
	} else if (pathname === '/api/animals' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(`
				SELECT a.*, s.common_name, s.endangered_status
				FROM ANIMAL a
				LEFT JOIN SPECIES s ON a.species_ID = s.species_ID
				WHERE NOT EXISTS (
					SELECT 1 FROM ANIMAL_REMOVAL ar
					WHERE ar.animal_ID = a.animal_ID
				)
				ORDER BY a.name
			`);
			send(res, 200, rows);
		} catch (err) {
			console.error('Error fetching animals:', err);
			send(res, 500, { error: 'Could not load animals.' });
			return;
		}
	} else if (req.url === '/api/animals' && req.method === 'POST') {
		let animal;

		try {
			animal = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return;
		}

		const validAnimal = animal &&
			typeof animal.name === 'string' &&
			animal.name.trim() !== '' &&
			Number.isInteger(Number(animal.species_ID)) &&
			Number(animal.species_ID) > 0 &&
			Number.isInteger(Number(animal.enclosure_ID)) &&
			Number(animal.enclosure_ID) > 0 &&
			(animal.age === '' || animal.age == null ||
				(Number.isFinite(Number(animal.age)) && Number(animal.age) >= 0)) &&
			(animal.weight === '' || animal.weight == null ||
				(Number.isFinite(Number(animal.weight)) && Number(animal.weight) >= 0)) &&
			['lbs', 'oz', 'kg', 'g'].includes(animal.weight_unit) &&
			['Breeding', 'Not Breeding'].includes(animal.breeding_status);

		if (!validAnimal) {
			send(res, 400, { error: 'Please provide valid animal details, including weight unit and breeding status.' });
			return;
		}

		try {
			const [result] = await pool.execute(
				`INSERT INTO ANIMAL
					(name, species_ID, enclosure_ID, age, gender, weight, weight_unit,
					 arrival_date, breeding_status)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[
					animal.name.trim(),
					Number(animal.species_ID),
					Number(animal.enclosure_ID),
					animal.age === '' || animal.age == null ? null : Number(animal.age),
					animal.gender || null,
					animal.weight === '' || animal.weight == null ? null : Number(animal.weight),
					animal.weight_unit,
					animal.arrival_date || null,
					animal.breeding_status
				]
			);

			send(res, 201, {
				message: 'Animal saved successfully.',
				animal_ID: result.insertId
			});
			return;
		} catch (err) {
			console.error('Error saving animal:', err);
			send(res, 500, { error: 'Could not save animal. Check that the selected species and enclosure exist and that the ANIMAL table has a weight_unit column.' });
			return;
		}
	} else if (req.method === 'POST' && /^\/api\/animals\/\d+\/remove$/.test(pathname)) {
		const animalID = Number(pathname.split('/')[3]);

		try {
			const data = await readBody(req);
			const allowedReasons = ['Death', 'Relocation', 'Transfer', 'Reintroduction', 'Other'];

			if (!data || !allowedReasons.includes(data.reason)) {
				send(res, 400, { error: 'Select a valid reason for removing the animal.' });
				return;
			}

			if (data.reason === 'Death' && (typeof data.death_reason !== 'string' || !data.death_reason.trim())) {
				send(res, 400, { error: 'A cause or description of death is required.' });
				return;
			}

			const [[animal]] = await pool.query(
				'SELECT animal_ID, name FROM ANIMAL WHERE animal_ID = ?',
				[animalID]
			);

			if (!animal) {
				send(res, 404, { error: 'Animal not found.' });
				return;
			}

			let medicalRecordID = null;

			if (data.medical_record_ID !== null && data.medical_record_ID !== undefined && data.medical_record_ID !== '') {
				medicalRecordID = Number(data.medical_record_ID);

				if (!Number.isInteger(medicalRecordID) || medicalRecordID <= 0) {
					send(res, 400, { error: 'Enter a valid medical record ID.' });
					return;
				}

				const [records] = await pool.query(
					'SELECT record_ID FROM MEDICAL_RECORD WHERE record_ID = ? AND animal_ID = ?',
					[medicalRecordID, animalID]
				);

				if (records.length === 0) {
					send(res, 400, { error: 'The selected medical record does not belong to this animal.' });
					return;
				}
			}

			await pool.execute(
				`INSERT INTO ANIMAL_REMOVAL
					(animal_ID, animal_name, removal_reason, death_reason, medical_record_ID)
				 VALUES (?, ?, ?, ?, ?)`,
				[
					animalID,
					animal.name,
					data.reason,
					data.reason === 'Death' ? data.death_reason.trim() : null,
					medicalRecordID
				]
			);

			send(res, 200, {
				success: true,
				message: `${animal.name} was removed from active animal records. Historical medical records were preserved.`
			});
			return;
		} catch (err) {
			if (err.code === 'ER_DUP_ENTRY') {
				send(res, 409, { error: 'This animal has already been removed from active records.' });
				return;
			}

			console.error('Error removing animal:', err);
			send(res, 500, { error: 'Could not remove animal from active records.' });
			return;
		}
	} else if (req.method === 'PUT' && /^\/api\/animals\/\d+$/.test(pathname)) {
		const animalID = Number(pathname.split('/')[3]);
		let animal;

		try {
			animal = await readBody(req);
		} catch (err) {
			send(res, err.status || 400, { error: err.message });
			return;
		}

		const validAnimal = animal &&
			typeof animal.name === 'string' &&
			animal.name.trim() !== '' &&
			Number.isInteger(Number(animal.species_ID)) &&
			Number(animal.species_ID) > 0 &&
			Number.isInteger(Number(animal.enclosure_ID)) &&
			Number(animal.enclosure_ID) > 0 &&
			(animal.age === '' || animal.age == null ||
				(Number.isFinite(Number(animal.age)) && Number(animal.age) >= 0)) &&
			(animal.weight === '' || animal.weight == null ||
				(Number.isFinite(Number(animal.weight)) && Number(animal.weight) >= 0)) &&
			['lbs', 'oz', 'kg', 'g'].includes(animal.weight_unit) &&
			['Breeding', 'Not Breeding'].includes(animal.breeding_status);

		if (!validAnimal) {
			send(res, 400, { error: 'Please provide valid animal details, including weight unit and breeding status.' });
			return;
		}

		try {
			const [existing] = await pool.execute(
				'SELECT animal_ID FROM ANIMAL WHERE animal_ID = ?',
				[animalID]
			);

			if (existing.length === 0) {
				send(res, 404, { error: 'Animal not found.' });
				return;
			}

			await pool.execute(
				`UPDATE ANIMAL
				 SET name = ?, species_ID = ?, enclosure_ID = ?, age = ?, gender = ?,
					 weight = ?, weight_unit = ?, arrival_date = ?, breeding_status = ?
				 WHERE animal_ID = ?`,
				[
					animal.name.trim(),
					Number(animal.species_ID),
					Number(animal.enclosure_ID),
					animal.age === '' || animal.age == null ? null : Number(animal.age),
					animal.gender || null,
					animal.weight === '' || animal.weight == null ? null : Number(animal.weight),
					animal.weight_unit,
					animal.arrival_date || null,
					animal.breeding_status,
					animalID
				]
			);

			send(res, 200, {
				message: 'Animal record updated successfully.',
				animal_ID: animalID
			});
			return;
		} catch (err) {
			console.error('Error updating animal:', err);
			send(res, 500, { error: 'Could not update animal. Check that the selected species and enclosure exist and that the ANIMAL table has a weight_unit column.' });
			return;
		}
	} else if (req.url === '/api/species' && req.method === 'GET') {
		try {
			const [rows] = await pool.query(
				'SELECT species_ID, common_name, scientific_name, enclosure_ID FROM SPECIES ORDER BY common_name'
			);
			send(res, 200, rows);
			return;
		} catch (err) {
			console.error('Error fetching species:', err);
			send(res, 500, { error: 'Failed to fetch species.' });
			return;
		}
	} else if (req.url === '/api/species' && req.method === 'POST') {
		try {
			const data = await readBody(req);

			if (!data.common_name || !data.scientific_name) {
				send(res, 400, { error: 'Common name and scientific name are required.' });
				return;
			}

			const [result] = await pool.query(
				`INSERT INTO SPECIES
					(common_name, scientific_name, endangered_status, enclosure_ID)
				 VALUES (?, ?, ?, ?)`,
				[
					data.common_name.trim(),
					data.scientific_name.trim(),
					data.endangered_status || null,
					data.enclosure_ID || null
				]
			);

			send(res, 201, {
				message: 'Species added successfully.',
				species_ID: result.insertId
			});
			return;
		} catch (error) {
			console.error('Error adding species:', error);
			send(res, 500, { error: 'Failed to add species.' });
			return;
		}
	}

	return true;
}

module.exports = handleAnimals;
