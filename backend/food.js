function validText(value, maxLength) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= maxLength
  );
}

function validPrice(value) {
  return /^\d{1,6}(\.\d{1,2})?$/.test(String(value));
}

function validTime(value) {
  return (
    typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value)
  );
}

function validId(value) {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
}

function itemValues(data) {
  return (
    data &&
    validText(data.name, 100) &&
    validText(data.category, 50) &&
    validPrice(data.price) &&
    Number.isInteger(data.stall_ID) &&
    data.stall_ID > 0
  );
}

function stallValues(data) {
  return (
    data &&
    validText(data.name, 100) &&
    validText(data.location, 100) &&
    validTime(data.opening_time) &&
    validTime(data.closing_time)
  );
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64;
const MAX_IMAGE_REQUEST_BYTES = MAX_IMAGE_DATA_URL_LENGTH + 32;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isValidImage(buffer, mimeType) {
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 &&
      buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === 'image/png') {
    return buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
  }

  if (mimeType === 'image/webp') {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  }

  if (mimeType === 'image/gif') {
    const signature = buffer.toString('ascii', 0, 6);
    return signature === 'GIF87a' || signature === 'GIF89a';
  }

  return false;
}

async function handleFood(req, res, pool, send, readBody) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const stallImageMatch = pathname.match(
    /^\/api\/food-stalls\/(\d+)\/image$/
  );

  if (stallImageMatch && !validId(stallImageMatch[1])) {
    send(res, 400, { error: 'Invalid food stall ID.' });
    return true;
  }

  if (stallImageMatch && req.method === 'GET') {
    const [rows] = await pool.execute(
      'SELECT image_data, image_mime FROM FOOD_STALL WHERE stall_ID = ?',
      [Number(stallImageMatch[1])]
    );

    if (rows.length === 0) {
      send(res, 404, { error: 'Food stall not found.' });
      return true;
    }

    if (!rows[0].image_data) {
      send(res, 404, { error: 'No image is set for this food stall.' });
      return true;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', rows[0].image_mime);
    res.setHeader('Cache-Control', 'no-store');
    res.end(rows[0].image_data);
    return true;
  }

  if (stallImageMatch && req.method === 'PUT') {
    const stallId = Number(stallImageMatch[1]);
    const data = await readBody(req, MAX_IMAGE_REQUEST_BYTES);

    if (
      !data ||
      typeof data.image !== 'string' ||
      data.image.length > MAX_IMAGE_DATA_URL_LENGTH
    ) {
      send(res, 400, { error: 'Choose an image no larger than 10 MB.' });
      return true;
    }

    const match = data.image.match(
      /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/
    );

    if (!match || !IMAGE_TYPES.has(match[1])) {
      send(res, 400, { error: 'Upload a JPEG, PNG, WebP, or GIF image.' });
      return true;
    }

    const imageBuffer = Buffer.from(match[2], 'base64');
    if (
      imageBuffer.length === 0 ||
      imageBuffer.length > MAX_IMAGE_BYTES ||
      imageBuffer.toString('base64') !== match[2] ||
      !isValidImage(imageBuffer, match[1])
    ) {
      send(res, 400, { error: 'The selected file is not a valid supported image no larger than 10 MB.' });
      return true;
    }

    let result;
    try {
      [result] = await pool.execute(
        `UPDATE FOOD_STALL
         SET image_data = ?, image_mime = ?
         WHERE stall_ID = ?`,
        [imageBuffer, match[1], stallId]
      );
    } catch (error) {
      if (
        error.code === 'ER_BAD_FIELD_ERROR' &&
        /image_data|image_mime/i.test(error.message)
      ) {
        const migrationError = new Error(
          'Food stall image storage is not configured. Apply migrations/food_stall_images.sql to the database.'
        );
        migrationError.status = 503;
        throw migrationError;
      }

      throw error;
    }

    if (result.affectedRows === 0) {
      const [rows] = await pool.execute(
        'SELECT stall_ID FROM FOOD_STALL WHERE stall_ID = ?',
        [stallId]
      );
      if (rows.length === 0) {
        send(res, 404, { error: 'Food stall not found.' });
        return true;
      }
    }

    send(res, 200, { message: 'Food stall image saved successfully.' });
    return true;
  }

  if (stallImageMatch && req.method === 'DELETE') {
    const stallId = Number(stallImageMatch[1]);
    const [rows] = await pool.execute(
      'SELECT stall_ID FROM FOOD_STALL WHERE stall_ID = ?',
      [stallId]
    );

    if (rows.length === 0) {
      send(res, 404, { error: 'Food stall not found.' });
      return true;
    }

    await pool.execute(
      'UPDATE FOOD_STALL SET image_data = NULL, image_mime = NULL WHERE stall_ID = ?',
      [stallId]
    );
    send(res, 200, { message: 'Food stall image removed successfully.' });
    return true;
  }

  if (pathname === '/api/food-stalls' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT stall_ID, name, location, opening_time, closing_time
      FROM FOOD_STALL
      ORDER BY name
    `);

    send(res, 200, rows);
    return true;
  }

  if (pathname === '/api/menu-items' && req.method === 'GET') {
    const [rows] = await pool.query(`
      SELECT m.*, s.name AS stall_name
      FROM MENU_ITEM AS m
      JOIN FOOD_STALL AS s ON m.stall_ID = s.stall_ID
      ORDER BY m.item_ID
    `);

    send(res, 200, rows);
    return true;
  }

  const stallMatch = pathname.match(/^\/api\/food-stalls\/(\d+)$/);
  const itemMatch = pathname.match(/^\/api\/menu-items\/(\d+)$/);
  const isStallCollection =
    pathname === '/api/food-stalls' && req.method === 'POST';
  const isItemCollection =
    pathname === '/api/menu-items' && req.method === 'POST';

  if (
    (stallMatch && !validId(stallMatch[1])) ||
    (itemMatch && !validId(itemMatch[1]))
  ) {
    send(res, 400, { error: 'Invalid food stall or menu item ID.' });
    return true;
  }

  if (isStallCollection) {
    const data = await readBody(req);

    if (!stallValues(data)) {
      send(res, 400, {
        error: 'Enter a name, location, and valid opening and closing times.'
      });
      return true;
    }

    const [result] = await pool.execute(
      `INSERT INTO FOOD_STALL
       (name, location, opening_time, closing_time, department_ID)
       VALUES (?, ?, ?, ?, 3)`,
      [
        data.name.trim(),
        data.location.trim(),
        data.opening_time,
        data.closing_time
      ]
    );

    send(res, 201, {
      stall_ID: result.insertId,
      message: 'Food stall added successfully.'
    });
    return true;
  }

  if (isItemCollection) {
    const data = await readBody(req);

    if (!itemValues(data)) {
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

  if (stallMatch && req.method === 'PUT') {
    const stallId = Number(stallMatch[1]);
    const data = await readBody(req);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      send(res, 400, { error: 'Food stall details are required.' });
      return true;
    }

    const fields = [];
    const params = [];
    const stallFields = {
      name: value => validText(value, 100),
      location: value => validText(value, 100),
      opening_time: validTime,
      closing_time: validTime
    };

    for (const [field, validate] of Object.entries(stallFields)) {
      if (data[field] !== undefined) {
        if (!validate(data[field])) {
          send(res, 400, { error: `Invalid food stall ${field}.` });
          return true;
        }

        fields.push(`${field} = ?`);
        params.push(
          field === 'name' || field === 'location'
            ? data[field].trim()
            : data[field]
        );
      }
    }

    if (fields.length === 0) {
      send(res, 400, { error: 'Provide at least one food stall field to update.' });
      return true;
    }

    const [existing] = await pool.execute(
      'SELECT stall_ID FROM FOOD_STALL WHERE stall_ID = ?',
      [stallId]
    );

    if (existing.length === 0) {
      send(res, 404, { error: 'Food stall not found.' });
      return true;
    }

    await pool.execute(
      `UPDATE FOOD_STALL SET ${fields.join(', ')} WHERE stall_ID = ?`,
      [...params, stallId]
    );

    send(res, 200, { message: 'Food stall updated successfully.' });
    return true;
  }

  if (itemMatch && req.method === 'PUT') {
    const itemId = Number(itemMatch[1]);
    const data = await readBody(req);

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      send(res, 400, { error: 'Menu item details are required.' });
      return true;
    }

    const fields = [];
    const params = [];

    for (const [field, maxLength] of [['name', 100], ['category', 50]]) {
      if (data[field] !== undefined) {
        if (!validText(data[field], maxLength)) {
          send(res, 400, { error: `${field} must be a non-empty string.` });
          return true;
        }

        fields.push(`${field} = ?`);
        params.push(data[field].trim());
      }
    }

    if (data.price !== undefined) {
      if (!validPrice(data.price)) {
        send(res, 400, { error: 'Price must be a valid non-negative amount.' });
        return true;
      }

      fields.push('price = ?');
      params.push(data.price);
    }

    if (data.stall_ID !== undefined) {
      if (!Number.isInteger(data.stall_ID) || data.stall_ID <= 0) {
        send(res, 400, { error: 'Select an existing food stall.' });
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

      fields.push('stall_ID = ?');
      params.push(data.stall_ID);
    }

    if (fields.length === 0) {
      send(res, 400, { error: 'Provide at least one menu item field to update.' });
      return true;
    }

    const [existing] = await pool.execute(
      'SELECT item_ID FROM MENU_ITEM WHERE item_ID = ?',
      [itemId]
    );

    if (existing.length === 0) {
      send(res, 404, { error: 'Menu item not found.' });
      return true;
    }

    await pool.execute(
      `UPDATE MENU_ITEM SET ${fields.join(', ')} WHERE item_ID = ?`,
      [...params, itemId]
    );

    send(res, 200, { message: 'Menu item updated successfully.' });
    return true;
  }

  if (
    (stallMatch && req.method === 'DELETE') ||
    (itemMatch && req.method === 'DELETE')
  ) {
    const isStall = Boolean(stallMatch);
    const id = Number((stallMatch || itemMatch)[1]);

    if (isStall) {
      const [items] = await pool.execute(
        'SELECT item_ID FROM MENU_ITEM WHERE stall_ID = ? LIMIT 1',
        [id]
      );

      if (items.length > 0) {
        send(res, 409, {
          error: "Remove this stall's menu items before removing the stall."
        });
        return true;
      }
    }

    const [result] = await pool.execute(
      isStall
        ? 'DELETE FROM FOOD_STALL WHERE stall_ID = ?'
        : 'DELETE FROM MENU_ITEM WHERE item_ID = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      send(res, 404, {
        error: isStall ? 'Food stall not found.' : 'Menu item not found.'
      });
      return true;
    }

    send(res, 200, {
      message: isStall
        ? 'Food stall removed successfully.'
        : 'Menu item removed successfully.'
    });
    return true;
  }

  if (
    (stallImageMatch && ['POST', 'PATCH'].includes(req.method)) ||
    (stallMatch && ['POST', 'PATCH'].includes(req.method)) ||
    (itemMatch && ['POST', 'PATCH'].includes(req.method))
  ) {
    send(res, 405, { error: 'Method not allowed.' });
    return true;
  }

  if (
    (pathname.match(/^\/api\/food-stalls\/\d+\/image$/) &&
      ['POST', 'PATCH'].includes(req.method)) ||
    (pathname === '/api/food-stalls' && ['PUT', 'DELETE', 'PATCH'].includes(req.method)) ||
    (pathname === '/api/menu-items' && ['PUT', 'DELETE', 'PATCH'].includes(req.method))
  ) {
    send(res, 405, { error: 'Method not allowed.' });
    return true;
  }

  return false;
}

module.exports = handleFood;
