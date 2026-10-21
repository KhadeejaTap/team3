async function handleFood(req, res, pool, send, readBody) {
  if (req.url === '/api/food-stalls' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT stall_ID, name, location, opening_time, closing_time
      FROM FOOD_STALL
      ORDER BY name
    `);

    send(res, 200, rows);
    return true;
  }

  if (req.url === '/api/menu-items' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT m.*, s.name AS stall_name
      FROM MENU_ITEM AS m
      JOIN FOOD_STALL AS s ON m.stall_ID = s.stall_ID
      ORDER BY m.item_ID
    `);

    send(res, 200, rows);
    return true;
  }

  if (req.url === '/api/menu-items' && req.method === 'POST') {
    const data = await readBody(req);

    const validText = (value, max) =>
      typeof value === 'string' &&
      value.trim().length > 0 &&
      value.trim().length <= max;

    if (
      !data ||
      !validText(data.name, 100) ||
      !validText(data.category, 50) ||
      !/^\d{1,6}(\.\d{1,2})?$/.test(String(data.price)) ||
      !Number.isInteger(data.stall_ID) ||
      data.stall_ID <= 0
    ) {
      send(res, 400, {
        error: 'Enter a name, category, valid price, and food stall.'
      });
      return true;
    }

    const [stalls] = await pool.execute(
      'SELECT stall_ID FROM FOOD_STALL WHERE stall_ID = ?',
      [data.stall_ID]
    );

    if (stalls.length === 0) {
      send(res, 400, { error: 'Select an existing food stall.' });
      return true;
    }

    const [result] = await pool.execute(
      `INSERT INTO MENU_ITEM (name, price, category, stall_ID)
       VALUES (?, ?, ?, ?)`,
      [
        data.name.trim(),
        data.price,
        data.category.trim(),
        data.stall_ID
      ]
    );

    send(res, 201, {
      item_ID: result.insertId,
      message: 'Menu item added successfully.'
    });
    return true;
  }

  return false;
}

module.exports = handleFood;