async function handleParking(req, res, pool, send, readBody) {
  if (req.url === '/api/parking-lots' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT l.lot_ID, l.name, l.location, l.capacity, l.parking_rate,
        COUNT(s.session_ID) AS occupied_spaces
      FROM PARKING_LOT AS l
      LEFT JOIN PARKING_SESSION AS s
        ON l.lot_ID = s.lot_ID AND s.exit_time IS NULL
      GROUP BY l.lot_ID
      ORDER BY l.name
    `);

    send(res, 200, rows);
    return true;
  }

  if (req.url === '/api/parking-sessions' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT s.session_ID, s.lot_ID, s.license_plate, s.entry_time,
        s.exit_time, l.name AS lot_name
      FROM PARKING_SESSION AS s
      JOIN PARKING_LOT AS l ON s.lot_ID = l.lot_ID
      ORDER BY s.entry_time DESC, s.session_ID DESC
    `);

    send(res, 200, rows);
    return true;
  }

  if (req.url === '/api/parking-sessions' && req.method === 'POST') {
    const data = await readBody(req);

    if (
      !data ||
      typeof data.license_plate !== 'string' ||
      data.license_plate.trim().length === 0 ||
      data.license_plate.trim().length > 20 ||
      !Number.isInteger(data.lot_ID) ||
      data.lot_ID <= 0
    ) {
      send(res, 400, {
        error: 'Enter a license plate and select a parking lot.'
      });
      return true;
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [lots] = await connection.execute(
        'SELECT lot_ID, capacity FROM PARKING_LOT WHERE lot_ID = ? FOR UPDATE',
        [data.lot_ID]
      );

      if (lots.length === 0) {
        await connection.rollback();
        send(res, 400, { error: 'Select an existing parking lot.' });
        return true;
      }

      const [sessions] = await connection.execute(
        `SELECT COUNT(*) AS occupied_spaces
         FROM PARKING_SESSION
         WHERE lot_ID = ? AND exit_time IS NULL`,
        [data.lot_ID]
      );

      if (
        lots[0].capacity !== null &&
        Number(sessions[0].occupied_spaces) >= lots[0].capacity
      ) {
        await connection.rollback();
        send(res, 409, { error: 'This parking lot is full.' });
        return true;
      }

      const [result] = await connection.execute(
        `INSERT INTO PARKING_SESSION (lot_ID, license_plate, entry_time)
         VALUES (?, ?, NOW())`,
        [data.lot_ID, data.license_plate.trim()]
      );

      await connection.commit();
      send(res, 201, {
        session_ID: result.insertId,
        message: 'Parking arrival recorded.'
      });
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  const exitMatch = req.url.match(/^\/api\/parking-sessions\/(\d+)\/exit$/);

  if (exitMatch && req.method === 'POST') {
    const [result] = await pool.execute(
      `UPDATE PARKING_SESSION
       SET exit_time = NOW()
       WHERE session_ID = ? AND exit_time IS NULL`,
      [Number(exitMatch[1])]
    );

    if (result.affectedRows === 0) {
      send(res, 404, {
        error: 'Active parking session was not found.'
      });
      return true;
    }

    send(res, 200, { message: 'Parking departure recorded.' });
    return true;
  }

  return false;
}

module.exports = handleParking;
