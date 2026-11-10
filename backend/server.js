const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const pool = require('./db');
const handleFood = require('./food');
const handleParking = require('./parking');
const handleAccess = require('./access');
const handleCheckout = require('./checkout');
const { requireRoles } = require('./auth');
const { sendReceiptEmail, sendDepartmentAlert, getDepartmentHead, autoDispatchAlerts } = require('./mailer');

const PORT = process.env.PORT || 5000;

function send(res, status, data) {
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

function generatePaychecksForPeriod(employeeID, departmentID, salary, startDateStr, endDateStr, asOfDateStr) {
  if (!startDateStr || !salary || Number(salary) <= 0) return [];
  const start = new Date(startDateStr);
  const asOf = asOfDateStr ? new Date(asOfDateStr) : new Date();
  const end = endDateStr ? new Date(endDateStr) : asOf;
  const periods = [];

  if (start > asOf) {
    return periods;
  }

  let curYear = start.getFullYear();
  let curMonth = start.getMonth();

  while (true) {
    const p1Start = new Date(curYear, curMonth, 1);
    const p1End = new Date(curYear, curMonth, 15);
    const p1StartStr = p1Start.toISOString().split('T')[0];
    const p1EndStr = p1End.toISOString().split('T')[0];

    if (p1End >= start && p1Start <= end) {
      periods.push({
        start: p1StartStr,
        end: p1EndStr,
        payDate: p1EndStr,
        status: p1End <= asOf ? 'paid' : 'pending'
      });
    }

    const lastDay = new Date(curYear, curMonth + 1, 0).getDate();
    const p2Start = new Date(curYear, curMonth, 16);
    const p2End = new Date(curYear, curMonth, lastDay);
    const p2StartStr = p2Start.toISOString().split('T')[0];
    const p2EndStr = p2End.toISOString().split('T')[0];

    if (p2End >= start && p2Start <= end) {
      periods.push({
        start: p2StartStr,
        end: p2EndStr,
        payDate: p2EndStr,
        status: p2End <= asOf ? 'paid' : 'pending'
      });
    }

    curMonth++;
    if (curMonth > 11) {
      curMonth = 0;
      curYear++;
    }

    if (new Date(curYear, curMonth, 1) > end) {
      break;
    }
  }

  const gross = Math.round((Number(salary) / 24) * 100) / 100;
  const fedTax = Math.round(gross * 0.12 * 100) / 100;
  const ficaTax = Math.round(gross * 0.0765 * 100) / 100;
  const stateTax = 0.00;
  const benefits = Math.round(gross * 0.035 * 100) / 100;
  const net = Math.round((gross - fedTax - ficaTax - stateTax - benefits) * 100) / 100;

  return periods.map(p => [
    employeeID,
    departmentID,
    p.start,
    p.end,
    p.payDate,
    gross,
    fedTax,
    ficaTax,
    stateTax,
    benefits,
    net,
    'direct_deposit',
    p.status
  ]);
}


const animalUploadDirectory = path.join(__dirname, 'uploads', 'animals');
const MAX_ANIMAL_IMAGE_SIZE = 5 * 1024 * 1024;

const ENCLOSURE_ALERT_DEPARTMENT_ID = 2;
const ENCLOSURE_ALERT_THRESHOLD = 0.75;

async function checkEnclosureCapacityAlert(enclosureID) {
  if (!enclosureID) return;

  try {
    const [[enclosure]] = await pool.query(
      `SELECT e.enclosure_ID, e.name, e.capacity, COUNT(a.animal_ID) AS animal_count
       FROM ENCLOSURE e
       LEFT JOIN ANIMAL a ON a.enclosure_ID = e.enclosure_ID
       AND NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
       WHERE e.enclosure_ID = ?
       GROUP BY e.enclosure_ID, e.name, e.capacity`,
      [Number(enclosureID)]
    );

    if (!enclosure || !Number(enclosure.capacity)) return;

    const occupancy = Number(enclosure.animal_count) / Number(enclosure.capacity);
    const isOverThreshold = occupancy >= ENCLOSURE_ALERT_THRESHOLD;

    const [[state]] = await pool.query(
      'SELECT is_over_threshold FROM ENCLOSURE_CAPACITY_ALERT_STATE WHERE enclosure_ID = ?',
      [Number(enclosureID)]
    );

    const wasOverThreshold = state ? Boolean(state.is_over_threshold) : false;

    if (isOverThreshold && !wasOverThreshold) {
      const percentage = (occupancy * 100).toFixed(1);

      const result = await sendDepartmentAlert({
        pool,
        departmentID: ENCLOSURE_ALERT_DEPARTMENT_ID,
        subject: `ENCLOSURE CAPACITY WARNING: ${enclosure.name}`,
        body: `Enclosure '${enclosure.name}' has reached ${percentage}% capacity. Current animal count: ${enclosure.animal_count}. Maximum capacity: ${enclosure.capacity}. Please review the enclosure's occupancy.`,
        referenceID: Number(enclosureID)
      });

      if (!result || !result.success) {
        console.warn('[ENCLOSURE CAPACITY ALERT] Alert was not logged:', result?.error || 'Unknown mailer response');
      }
    }

    await pool.query(
      `INSERT INTO ENCLOSURE_CAPACITY_ALERT_STATE (enclosure_ID, is_over_threshold, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON DUPLICATE KEY UPDATE
         is_over_threshold = VALUES(is_over_threshold),
         updated_at = CURRENT_TIMESTAMP`,
      [Number(enclosureID), isOverThreshold ? 1 : 0]
    );
  } catch (err) {
    console.error('[ENCLOSURE CAPACITY ALERT ERROR]', err);
  }
}

async function checkEnclosureCapacityAlertForRemoval(animalID) {
  try {
    const [[row]] = await pool.query('SELECT enclosure_ID FROM ANIMAL WHERE animal_ID = ?', [animalID]);
    if (row?.enclosure_ID) await checkEnclosureCapacityAlert(row.enclosure_ID);
  } catch (err) {
    console.error('[ENCLOSURE CAPACITY ALERT ERROR]', err);
  }
}

async function readMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error('Invalid image upload request.');
  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_ANIMAL_IMAGE_SIZE + 1024 * 1024) {
      const error = new Error('The upload is too large. Maximum image size is 5 MB.');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks);
  const fields = {};
  let image = null;
  let position = 0;

  while (position < body.length) {
    const boundaryStart = body.indexOf(boundary, position);
    if (boundaryStart === -1) break;
    let partStart = boundaryStart + boundary.length;
    if (body.subarray(partStart, partStart + 2).toString() === '--') break;
    if (body.subarray(partStart, partStart + 2).toString() === '\r\n') partStart += 2;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), partStart);
    if (headerEnd === -1) break;
    const headers = body.subarray(partStart, headerEnd).toString('utf8');
    const nextBoundary = body.indexOf(boundary, headerEnd + 4);
    if (nextBoundary === -1) break;
    let dataEnd = nextBoundary;
    if (body.subarray(dataEnd - 2, dataEnd).toString() === '\r\n') dataEnd -= 2;
    const data = body.subarray(headerEnd + 4, dataEnd);
    const disposition = headers.match(/content-disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
    if (disposition) {
      const fieldName = disposition[1];
      const filename = disposition[2];
      if (filename !== undefined && filename !== '') {
        const mimeMatch = headers.match(/content-type:\s*([^\r\n]+)/i);
        image = { buffer: data, mimeType: mimeMatch ? mimeMatch[1].trim().toLowerCase() : '' };
      } else {
        fields[fieldName] = data.toString('utf8');
      }
    }
    position = nextBoundary;
  }

  if (image) {
    const extensions = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };
    const extension = extensions[image.mimeType];
    if (!extension) throw new Error('Please upload a JPG, PNG, or WEBP image.');
    if (image.buffer.length > MAX_ANIMAL_IMAGE_SIZE) {
      const error = new Error('The upload is too large. Maximum image size is 5 MB.');
      error.status = 413;
      throw error;
    }
    const filename = `${crypto.randomUUID()}${extension}`;
    await fs.promises.mkdir(animalUploadDirectory, { recursive: true });
    await fs.promises.writeFile(path.join(animalUploadDirectory, filename), image.buffer, { flag: 'wx' });
    image.url = `/uploads/animals/${filename}`;
  }

  return { fields, image };
}

async function readBody(req) {
  let body = '';

  for await (const chunk of req) {
    body += chunk;

    if (Buffer.byteLength(body) > 16384) {
      const error = new Error('Request is too large.');
      error.status = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error('Invalid JSON.');
    error.status = 400;
    throw error;
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Accept'
  );

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const uploadMatch = req.method === 'GET' && req.url.match(/^\/uploads\/animals\/([a-f0-9-]+\.(?:jpg|png|webp))$/i);
  if (uploadMatch) {
    try {
      const filePath = path.join(animalUploadDirectory, path.basename(uploadMatch[1]));
      const image = await fs.promises.readFile(filePath);
      const extension = path.extname(filePath).toLowerCase();
      res.statusCode = 200;
      res.setHeader('Content-Type', extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.end(image);
    } catch {
      res.statusCode = 404;
      res.end('Image not found.');
    }
    return;
  }

  try {
    if (await handleAccess(req, res, pool, send, readBody)) {
      return;
    }
        if (await handleCheckout(req, res, pool, send, readBody)) {
      return;
    }
    if (await handleFood(req, res, pool, send, readBody)) {
      return;
    }

    if (await handleParking(req, res, pool, send, readBody)) {
      return;
    }

    const getQueries = {
      '/api/products': `
        SELECT p.*
        FROM product AS p
        ORDER BY p.product_ID
      `,
      '/api/gift-shops':
        'SELECT shop_ID, name, location FROM gift_shop ORDER BY name'
    };

    if (
      req.method === 'GET' &&
      Object.hasOwn(getQueries, req.url)
    ) {
      const [rows] = await pool.query(getQueries[req.url]);
      send(res, 200, rows);
      return;
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
      error: err.status ? err.message : 'Server error'
    });
    return;
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
  } else if (req.url.startsWith('/api/alerts/low-stock') && req.method === 'GET') {
    try {
      await autoDispatchAlerts(pool);
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
          END AS stock_condition,
          (SELECT el.sent_at FROM EMAIL_LOG el WHERE el.reference_type = 'low_stock' AND el.reference_ID = a.alert_ID ORDER BY el.sent_at DESC LIMIT 1) AS auto_emailed_at
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
      await autoDispatchAlerts(pool);
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
  } else if (req.url === '/api/alerts/notify-head' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { department_ID, subject, message, reference_ID, reference_type } = body;

      if (!department_ID || !subject || !message || reference_ID === undefined) {
        send(res, 400, { error: 'department_ID, subject, message, and reference_ID are required.' });
        return;
      }

      const refType = reference_type || (subject.toLowerCase().includes('event') ? 'event' : 'low_stock');

      const result = await sendDepartmentAlert({
        pool,
        departmentID: Number(department_ID),
        referenceType: refType,
        subject,
        body: message,
        referenceID: Number(reference_ID)
      });

      if (!result.success) {
        send(res, 404, result);
        return;
      }

      send(res, 200, {
        success: true,
        message: `Alert successfully emailed to department head (${result.recipient}).`,
        email_ID: result.email_ID,
        recipient: result.recipient
      });
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  } else if (req.url.startsWith('/api/email-logs') && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const email = parsedUrl.searchParams.get('email');
      const type = parsedUrl.searchParams.get('type');
      const refType = parsedUrl.searchParams.get('reference_type');
      let query = 'SELECT * FROM EMAIL_LOG';
      const params = [];
      const conditions = [];

      if (email && email.trim()) {
        conditions.push('LOWER(recipient_email) = LOWER(?)');
        params.push(email.trim());
      }
      if (type && type.trim()) {
        conditions.push('email_type = ?');
        params.push(type.trim());
      }
      if (refType && refType.trim()) {
        conditions.push('reference_type = ?');
        params.push(refType.trim());
      }
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      query += ' ORDER BY sent_at DESC LIMIT 50';

      const [rows] = await pool.query(query, params);
      send(res, 200, rows);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  } else if (req.url === '/api/department/set-head' && req.method === 'POST') {
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
    req.url.startsWith('/api/reports/payroll') &&
    req.method === 'GET'
  ) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const departmentId = parsedUrl.searchParams.get('department_id');
      const sortBy = parsedUrl.searchParams.get('sort_by') || 'payroll';
      const email = parsedUrl.searchParams.get('email');
      const viewMode = parsedUrl.searchParams.get('view_mode') || 'department';
      const timeFrame = parsedUrl.searchParams.get('time_frame') || 'all';
      let startDate = parsedUrl.searchParams.get('start_date');
      let endDate = parsedUrl.searchParams.get('end_date');
      const minSalary = parsedUrl.searchParams.get('min_salary');
      const maxSalary = parsedUrl.searchParams.get('max_salary');
      const empType = parsedUrl.searchParams.get('employment_type') || 'all';

      if (timeFrame === 'ytd') {
        startDate = '2026-01-01';
        endDate = '2026-11-10';
      }

      let scopedDeptId = null;
      if (email) {
        const [userRole] = await pool.query(
          `SELECT u.role, e.department_ID 
           FROM users u 
           LEFT JOIN employee e ON u.email = e.email 
           WHERE u.email = ?`,
          [email]
        );
        const isManager = userRole.length > 0 && userRole[0].role === 'manager';
        const isFinHR = userRole.length > 0 && userRole[0].department_ID === 1;

        if (isManager && !isFinHR && userRole[0].department_ID) {
          scopedDeptId = userRole[0].department_ID;
        }
      }

      const effectiveDeptId = scopedDeptId || (departmentId && departmentId !== 'all' ? departmentId : null);

      if (viewMode === 'employee') {
        let empQuery = `
          SELECT 
            e.employee_ID,
            CONCAT_WS(' ', e.first_name, e.last_name) AS name,
            e.first_name,
            e.last_name,
            e.email,
            d.department_ID,
            d.department_name,
            e.role,
            COALESCE(e.hours, 40) AS hours,
            CASE WHEN COALESCE(e.hours, 40) >= 35 THEN 'Full-Time' ELSE 'Part-Time' END AS employment_type,
            e.salary AS annual_salary,
            ROUND(e.salary / NULLIF(COALESCE(e.hours, 40) * 52, 0), 2) AS hourly_equivalent,
            DATE_FORMAT(e.hire_date, '%Y-%m-%d') AS hire_date,
            ROUND(TIMESTAMPDIFF(MONTH, e.hire_date, CURDATE()) / 12, 1) AS tenure_years,
            COALESCE(p.total_career_gross, 0) AS career_gross,
            COALESCE(p.total_career_net, 0) AS career_net,
            COALESCE(p.total_career_taxes, 0) AS career_taxes,
            COALESCE(p.total_career_benefits, 0) AS career_benefits,
            COALESCE(p.total_checks_count, 0) AS total_checks_count,
            DATE_FORMAT(p.first_pay_date, '%Y-%m-%d') AS first_pay_date,
            DATE_FORMAT(p.latest_pay_date, '%Y-%m-%d') AS latest_pay_date,
            COALESCE(pr.period_gross, 0) AS period_gross,
            COALESCE(pr.period_net, 0) AS period_net,
            COALESCE(pr.period_taxes, 0) AS period_taxes,
            COALESCE(pr.period_checks_count, 0) AS period_checks_count
          FROM EMPLOYEE e
          JOIN DEPARTMENT d ON e.department_ID = d.department_ID
          LEFT JOIN (
            SELECT 
              employee_ID,
              SUM(gross_pay) AS total_career_gross,
              SUM(net_pay) AS total_career_net,
              SUM(federal_tax + fica_tax + state_tax) AS total_career_taxes,
              SUM(benefits_deduction) AS total_career_benefits,
              COUNT(paycheck_ID) AS total_checks_count,
              MIN(payment_date) AS first_pay_date,
              MAX(payment_date) AS latest_pay_date
            FROM PAYCHECK
            GROUP BY employee_ID
          ) p ON e.employee_ID = p.employee_ID
          LEFT JOIN (
            SELECT 
              employee_ID,
              SUM(gross_pay) AS period_gross,
              SUM(net_pay) AS period_net,
              SUM(federal_tax + fica_tax + state_tax) AS period_taxes,
              COUNT(paycheck_ID) AS period_checks_count
            FROM PAYCHECK
            WHERE 1=1
              ${startDate ? 'AND payment_date >= ?' : ''}
              ${endDate ? 'AND payment_date <= ?' : ''}
            GROUP BY employee_ID
          ) pr ON e.employee_ID = pr.employee_ID
          WHERE e.current = 1
        `;
        const empParams = [];
        if (startDate) empParams.push(startDate);
        if (endDate) empParams.push(endDate);

        if (effectiveDeptId) {
          empQuery += ' AND e.department_ID = ?';
          empParams.push(effectiveDeptId);
        }
        if (minSalary) {
          empQuery += ' AND e.salary >= ?';
          empParams.push(Number(minSalary));
        }
        if (maxSalary) {
          empQuery += ' AND e.salary <= ?';
          empParams.push(Number(maxSalary));
        }
        if (empType === 'full_time') {
          empQuery += ' AND COALESCE(e.hours, 40) >= 35';
        } else if (empType === 'part_time') {
          empQuery += ' AND COALESCE(e.hours, 40) < 35';
        }

        const empSortColumns = {
          payroll: 'e.salary DESC',
          career_gross: 'career_gross DESC',
          period_gross: 'period_gross DESC',
          checks: 'total_checks_count DESC',
          tenure: 'tenure_years DESC',
          name: 'e.last_name ASC, e.first_name ASC',
          dept: 'd.department_name ASC'
        };
        const empOrderClause = empSortColumns[sortBy] || 'career_gross DESC';
        empQuery += ` ORDER BY ${empOrderClause}`;

        const [rows] = await pool.query(empQuery, empParams);
        res.end(JSON.stringify(rows));
        return;
      }

      // Default: 'department' summary view
      let deptQuery = `
        SELECT 
          d.department_ID,
          d.department_name,
          CONCAT_WS(' ', h.first_name, h.last_name) AS department_head,
          COUNT(DISTINCT e.employee_ID) AS active_headcount,
          SUM(CASE WHEN COALESCE(e.hours, 40) >= 35 THEN 1 ELSE 0 END) AS full_time_count,
          SUM(CASE WHEN COALESCE(e.hours, 40) < 35 THEN 1 ELSE 0 END) AS part_time_count,
          COALESCE(SUM(e.salary), 0) AS total_payroll,
          COALESCE(ROUND(AVG(e.salary), 2), 0) AS average_salary,
          COALESCE(MIN(e.salary), 0) AS min_salary,
          COALESCE(MAX(e.salary), 0) AS max_salary,
          COALESCE(ROUND(SUM(e.salary) / NULLIF(SUM(COALESCE(e.hours, 40) * 52), 0), 2), 0) AS effective_avg_hourly_rate,
          COALESCE(ROUND(AVG(TIMESTAMPDIFF(MONTH, e.hire_date, CURDATE()) / 12), 1), 0) AS avg_tenure_years,
          CASE d.department_ID
            WHEN 1 THEN 200000
            WHEN 2 THEN 580000
            WHEN 3 THEN 210000
            WHEN 4 THEN 180000
            ELSE 150000
          END AS allocated_budget,
          COALESCE(p.total_disbursed_gross, 0) AS total_disbursed_gross,
          COALESCE(p.total_disbursed_net, 0) AS total_disbursed_net,
          COALESCE(p.total_taxes_withheld, 0) AS total_taxes_withheld,
          COALESCE(p.total_benefits_deducted, 0) AS total_benefits_deducted,
          COALESCE(p.paychecks_count, 0) AS paychecks_count
        FROM DEPARTMENT d
        LEFT JOIN EMPLOYEE h ON d.head_employee_ID = h.employee_ID
        LEFT JOIN EMPLOYEE e ON d.department_ID = e.department_ID AND e.current = 1
      `;
      const deptParams = [];

      const filterConditions = [];
      if (minSalary) {
        filterConditions.push('e.salary >= ?');
        deptParams.push(Number(minSalary));
      }
      if (maxSalary) {
        filterConditions.push('e.salary <= ?');
        deptParams.push(Number(maxSalary));
      }
      if (empType === 'full_time') {
        filterConditions.push('COALESCE(e.hours, 40) >= 35');
      } else if (empType === 'part_time') {
        filterConditions.push('COALESCE(e.hours, 40) < 35');
      }

      if (filterConditions.length > 0) {
        deptQuery += ' AND ' + filterConditions.join(' AND ');
      }

      deptQuery += `
        LEFT JOIN (
          SELECT 
            department_ID,
            SUM(gross_pay) AS total_disbursed_gross,
            SUM(net_pay) AS total_disbursed_net,
            SUM(federal_tax + fica_tax + state_tax) AS total_taxes_withheld,
            SUM(benefits_deduction) AS total_benefits_deducted,
            COUNT(paycheck_ID) AS paychecks_count
          FROM PAYCHECK
          WHERE 1=1
            ${startDate ? 'AND payment_date >= ?' : ''}
            ${endDate ? 'AND payment_date <= ?' : ''}
          GROUP BY department_ID
        ) p ON d.department_ID = p.department_ID
      `;
      if (startDate) deptParams.push(startDate);
      if (endDate) deptParams.push(endDate);

      if (effectiveDeptId) {
        deptQuery += ' WHERE d.department_ID = ?';
        deptParams.push(effectiveDeptId);
      }

      deptQuery += ' GROUP BY d.department_ID, d.department_name, h.first_name, h.last_name, p.total_disbursed_gross, p.total_disbursed_net, p.total_taxes_withheld, p.total_benefits_deducted, p.paychecks_count';

      const sortColumns = {
        payroll: 'total_payroll DESC',
        disbursed: 'total_disbursed_gross DESC',
        headcount: 'active_headcount DESC',
        avg_salary: 'average_salary DESC',
        budget: 'allocated_budget DESC',
        name: 'd.department_name ASC'
      };
      const orderClause = sortColumns[sortBy] || 'total_payroll DESC';
      deptQuery += ` ORDER BY ${orderClause}`;

      const [rows] = await pool.query(deptQuery, deptParams);
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
    req.url.match(/^\/api\/employees\/(\d+)\/paychecks/) &&
    req.method === 'GET'
  ) {
    try {
      const match = req.url.match(/^\/api\/employees\/(\d+)\/paychecks/);
      const empId = Number(match[1]);
      const [rows] = await pool.query(
        `SELECT 
          paycheck_ID,
          employee_ID,
          department_ID,
          DATE_FORMAT(pay_period_start, '%Y-%m-%d') AS pay_period_start,
          DATE_FORMAT(pay_period_end, '%Y-%m-%d') AS pay_period_end,
          DATE_FORMAT(payment_date, '%Y-%m-%d') AS payment_date,
          gross_pay,
          federal_tax,
          fica_tax,
          ROUND(gross_pay * 0.062, 2) AS social_security,
          ROUND(gross_pay * 0.0145, 2) AS medicare,
          state_tax,
          benefits_deduction,
          net_pay,
          payment_method,
          status
        FROM PAYCHECK
        WHERE employee_ID = ?
        ORDER BY payment_date DESC`,
        [empId]
      );
      send(res, 200, rows);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  } else if (
    req.url.startsWith('/api/reports/revenue') &&
    req.method === 'GET'
  ) {
    // TODO / UPCOMING REVENUE & COST STREAMS TO INTEGRATE:
    // 1. Retail Sales:
    //    SELECT 'Retail' AS stream_category, p.name AS stream_name, COUNT(*) AS transaction_count,
    //           SUM(ti.price * ti.quantity) AS total_revenue, AVG(ti.price * ti.quantity) AS avg_amount,
    //           MIN(ti.price * ti.quantity) AS min_amount, MAX(ti.price * ti.quantity) AS max_amount
    //    FROM transaction_item ti JOIN product p ON ti.item_ID = p.product_ID WHERE ti.item_type = 'product' GROUP BY p.name
    // 2. Food Concessions:
    //    SELECT 'Food Services' AS stream_category, mi.name AS stream_name, COUNT(*) AS transaction_count,
    //           SUM(ti.price * ti.quantity) AS total_revenue, ... FROM transaction_item ti JOIN menu_item mi ...
    // 3. Parking Passes:
    //    SELECT 'Parking' AS stream_category, pl.name AS stream_name, COUNT(*) AS transaction_count,
    //           SUM(pl.parking_rate) AS total_revenue, ... FROM parking_session ps JOIN parking_lot pl ...
    // 4. Operational Cost Deductions (for Net Operating Margin):
    //    - Wholesale COGS: SUM(p.cost_price * ti.quantity)
    //    - Zoo Payroll: SELECT SUM(salary) FROM employee WHERE current = 1
    //    - Enclosure Ops: SELECT SUM(amount) FROM enclosure_cost
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const streamType = parsedUrl.searchParams.get('stream_type') || 'all';
      const sortBy = parsedUrl.searchParams.get('sort_by') || 'revenue';

      let query = '';

      if (streamType === 'tickets') {
        query = `
          SELECT
            'Admissions' AS stream_category,
            ticket_type AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(price), 0) AS total_revenue,
            COALESCE(ROUND(AVG(price), 2), 0) AS avg_amount,
            COALESCE(MIN(price), 0) AS min_amount,
            COALESCE(MAX(price), 0) AS max_amount
          FROM TICKET
          GROUP BY ticket_type
        `;
      } else if (streamType === 'donations') {
        query = `
          SELECT
            'Fundraising' AS stream_category,
            purpose AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(amount), 0) AS total_revenue,
            COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
            COALESCE(MIN(amount), 0) AS min_amount,
            COALESCE(MAX(amount), 0) AS max_amount
          FROM DONATION
          GROUP BY purpose
        `;
      } else if (streamType === 'retail') {
        query = `
          SELECT
            'Retail Merchandise' AS stream_category,
            COALESCE(p.name, CONCAT('Product #', ti.item_ID)) AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(ti.price * ti.quantity), 0) AS total_revenue,
            COALESCE(ROUND(AVG(ti.price * ti.quantity), 2), 0) AS avg_amount,
            COALESCE(MIN(ti.price * ti.quantity), 0) AS min_amount,
            COALESCE(MAX(ti.price * ti.quantity), 0) AS max_amount
          FROM transaction_item ti
          LEFT JOIN product p ON ti.item_ID = p.product_ID
          WHERE ti.item_type = 'product'
          GROUP BY p.product_ID, p.name, ti.item_ID
        `;
      } else if (streamType === 'expenses') {
        query = `
          SELECT
            'Habitat Operations' AS stream_category,
            cost_category AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(amount), 0) AS total_revenue,
            COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
            COALESCE(MIN(amount), 0) AS min_amount,
            COALESCE(MAX(amount), 0) AS max_amount
          FROM ENCLOSURE_COST
          GROUP BY cost_category
        `;
      } else if (streamType === 'medical_expenses') {
        query = `
          SELECT
            'Animal Healthcare' AS stream_category,
            cost_category AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(amount), 0) AS total_revenue,
            COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
            COALESCE(MIN(amount), 0) AS min_amount,
            COALESCE(MAX(amount), 0) AS max_amount
          FROM MEDICAL_COST
          GROUP BY cost_category
        `;
      } else if (streamType === 'food_expenses') {
        query = `
          SELECT
            'Food Costs' AS stream_category,
            CONCAT(fi.food_name, ' - ', COALESCE(fi.supplier, 'Unspecified Supplier')) AS stream_name,
            COUNT(*) AS transaction_count,
            COALESCE(SUM(fc.amount), 0) AS total_revenue,
            COALESCE(ROUND(AVG(fc.amount), 2), 0) AS avg_amount,
            COALESCE(MIN(fc.amount), 0) AS min_amount,
            COALESCE(MAX(fc.amount), 0) AS max_amount
          FROM FOOD_COST fc
          JOIN FEED_ITEM fi ON fc.food_ID = fi.food_ID
          GROUP BY fi.food_ID, fi.food_name, fi.supplier
        `;
      } else {
        query = `
          SELECT * FROM (
            SELECT
              'Admissions' AS stream_category,
              ticket_type AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(price), 0) AS total_revenue,
              COALESCE(ROUND(AVG(price), 2), 0) AS avg_amount,
              COALESCE(MIN(price), 0) AS min_amount,
              COALESCE(MAX(price), 0) AS max_amount
            FROM TICKET
            GROUP BY ticket_type

            UNION ALL

            SELECT
              'Fundraising' AS stream_category,
              purpose AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(amount), 0) AS total_revenue,
              COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
              COALESCE(MIN(amount), 0) AS min_amount,
              COALESCE(MAX(amount), 0) AS max_amount
            FROM DONATION
            GROUP BY purpose

            UNION ALL

            SELECT
              'Retail Merchandise' AS stream_category,
              COALESCE(p.name, CONCAT('Product #', ti.item_ID)) AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(ti.price * ti.quantity), 0) AS total_revenue,
              COALESCE(ROUND(AVG(ti.price * ti.quantity), 2), 0) AS avg_amount,
              COALESCE(MIN(ti.price * ti.quantity), 0) AS min_amount,
              COALESCE(MAX(ti.price * ti.quantity), 0) AS max_amount
            FROM transaction_item ti
            LEFT JOIN product p ON ti.item_ID = p.product_ID
            WHERE ti.item_type = 'product'
            GROUP BY p.product_ID, p.name, ti.item_ID

            UNION ALL

            SELECT
              'Habitat Operations' AS stream_category,
              cost_category AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(amount), 0) AS total_revenue,
              COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
              COALESCE(MIN(amount), 0) AS min_amount,
              COALESCE(MAX(amount), 0) AS max_amount
            FROM ENCLOSURE_COST
            GROUP BY cost_category

            UNION ALL

            SELECT
              'Animal Healthcare' AS stream_category,
              cost_category AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(amount), 0) AS total_revenue,
              COALESCE(ROUND(AVG(amount), 2), 0) AS avg_amount,
              COALESCE(MIN(amount), 0) AS min_amount,
              COALESCE(MAX(amount), 0) AS max_amount
            FROM MEDICAL_COST
            GROUP BY cost_category

            UNION ALL

            SELECT
              'Food Costs' AS stream_category,
              CONCAT(fi.food_name, ' - ', COALESCE(fi.supplier, 'Unspecified Supplier')) AS stream_name,
              COUNT(*) AS transaction_count,
              COALESCE(SUM(fc.amount), 0) AS total_revenue,
              COALESCE(ROUND(AVG(fc.amount), 2), 0) AS avg_amount,
              COALESCE(MIN(fc.amount), 0) AS min_amount,
              COALESCE(MAX(fc.amount), 0) AS max_amount
            FROM FOOD_COST fc
            JOIN FEED_ITEM fi ON fc.food_ID = fi.food_ID
            GROUP BY fi.food_ID, fi.food_name, fi.supplier
          ) AS streams
        `;
      }

      const sortColumns = {
        revenue: 'total_revenue DESC',
        count: 'transaction_count DESC',
        avg: 'avg_amount DESC',
        name: 'stream_name ASC'
      };
      const orderClause = sortColumns[sortBy] || 'total_revenue DESC';
      query += ` ORDER BY ${orderClause}`;

      const [rows] = await pool.query(query);
      send(res, 200, rows);
      return;
    } catch (err) {
      console.error('Error fetching revenue report:', err);
      send(res, 500, { error: 'Could not load revenue report.' });
      return;
    }
  } else if (
    req.url === '/api/reports/financial-summary' &&
    req.method === 'GET'
  ) {
    try {
      const [[tickets]] = await pool.query(
        'SELECT COALESCE(SUM(price), 0) AS total FROM TICKET'
      );
      const [[donations]] = await pool.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM DONATION'
      );
      const [[retail]] = await pool.query(
        "SELECT COALESCE(SUM(price * quantity), 0) AS total FROM TRANSACTION_ITEM WHERE item_type = 'product'"
      );
      const [categories] = await pool.query(`
        SELECT cost_category, COALESCE(SUM(amount), 0) AS total
        FROM ENCLOSURE_COST
        GROUP BY cost_category
        ORDER BY total DESC
      `);
      const [medicalCategories] = await pool.query(`
        SELECT cost_category, COALESCE(SUM(amount), 0) AS total
        FROM MEDICAL_COST
        GROUP BY cost_category
        ORDER BY total DESC
      `);
      const [foodCategories] = await pool.query(`
        SELECT fi.food_category AS cost_category, COALESCE(SUM(fc.amount), 0) AS total
        FROM FOOD_COST fc
        JOIN FEED_ITEM fi ON fc.food_ID = fi.food_ID
        GROUP BY fi.food_category
        ORDER BY total DESC
      `);

      const admissionsTotal = Number(tickets.total || 0);
      const donationsTotal = Number(donations.total || 0);
      const retailTotal = Number(retail.total || 0);
      const grossRevenue = admissionsTotal + donationsTotal + retailTotal;

      const enclosureCostsTotal = categories.reduce(
        (sum, category) => sum + Number(category.total || 0), 0
      );
      const medicalCostsTotal = medicalCategories.reduce(
        (sum, category) => sum + Number(category.total || 0), 0
      );
      const foodCostsTotal = foodCategories.reduce(
        (sum, category) => sum + Number(category.total || 0), 0
      );
      const totalExpenses = enclosureCostsTotal + medicalCostsTotal + foodCostsTotal;
      const netBalance = grossRevenue - totalExpenses;

      send(res, 200, {
        gross_revenue: grossRevenue.toFixed(2),
        admissions_total: admissionsTotal.toFixed(2),
        donations_total: donationsTotal.toFixed(2),
        retail_total: retailTotal.toFixed(2),
        enclosure_costs_total: enclosureCostsTotal.toFixed(2),
        enclosure_categories: categories.map(category => ({
          category: category.cost_category,
          amount: Number(category.total || 0).toFixed(2)
        })),
        medical_costs_total: medicalCostsTotal.toFixed(2),
        medical_categories: medicalCategories.map(category => ({
          category: category.cost_category,
          amount: Number(category.total || 0).toFixed(2)
        })),
        food_costs_total: foodCostsTotal.toFixed(2),
        food_categories: foodCategories.map(category => ({
          category: category.cost_category || 'Uncategorized',
          amount: Number(category.total || 0).toFixed(2)
        })),
        total_expenses: totalExpenses.toFixed(2),
        net_balance: netBalance.toFixed(2)
      });
      return;
    } catch (err) {
      console.error('Error fetching financial summary:', err);
      send(res, 500, { error: 'Could not calculate financial summary.' });
      return;
    }
    } else if (
    req.url.startsWith('/api/reports/species') &&
    req.method === 'GET'
  ) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const email = parsedUrl.searchParams.get('email');
      const statusFilter = parsedUrl.searchParams.get('status');
      const sortBy = parsedUrl.searchParams.get('sort_by') || 'population_desc';

      if (!email) {
        res.statusCode = 401;
        res.end(JSON.stringify({ error: 'Authentication required. Please log in to view the species report.' }));
        return;
      }

      const [emp] = await pool.query('SELECT department_ID FROM EMPLOYEE WHERE email = ?', [email]);
      const deptId = emp.length > 0 ? emp[0].department_ID : null;

      if (deptId !== 2 && deptId !== 1) {
        res.statusCode = 403;
        res.end(JSON.stringify({ error: 'Access restricted to Animal Operations and Zoo Leadership personnel.' }));
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
          AND NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
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
      const orderClause = sortColumns[sortBy] || 'total_count DESC';
      query += ` ORDER BY ${orderClause}`;

      const [rows] = await pool.query(query, params);
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
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
  } else if (
    req.url === '/api/attractions' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const attraction = JSON.parse(body);

        const [result] = await pool.query(
          `INSERT INTO ATTRACTION
           (name, type, location, attr_datetime, capacity, description)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            attraction.name || null,
            attraction.type || null,
            attraction.location || null,
            attraction.attr_datetime || null,
            attraction.capacity ?? null,
            attraction.description || null
          ]
        );

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Attraction saved successfully',
            attr_ID: result.insertId
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else if (
    req.url === '/api/tickets' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        let ticket;

        try {
          ticket = JSON.parse(body);
        } catch {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Request body must be valid JSON.'
            })
          );
          return;
        }

        if (
          !ticket ||
          typeof ticket !== 'object' ||
          Array.isArray(ticket)
        ) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Request body must contain ticket details.'
            })
          );
          return;
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
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error:
                'Choose a valid ticket type, enter a valid visit date, and provide an optional visitor name.'
            })
          );
          return;
        }

        const connection = await pool.getConnection();
        let ticketID;
        let transactionID;
        let total;

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
          ticketID = result.insertId;
          total = (price * 1.0825).toFixed(2);
          const [transaction] = await connection.query(
            `INSERT INTO CUST_TRANSACTION
             (visitor_ID, total, payment_method, transaction_date)
             VALUES (?, ?, 'credit', CURRENT_DATE)`,
            [visitorID, total]
          );
          await connection.query(
            `INSERT INTO TRANSACTION_ITEM
             (transaction_ID, item_type, item_ID, quantity, price)
             VALUES (?, 'ticket', ?, 1, ?)`,
            [transaction.insertId, ticketID, price]
          );

          await connection.commit();
          transactionID = transaction.insertId;
        } catch (err) {
          await connection.rollback();
          throw err;
        } finally {
          connection.release();
        }

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Ticket purchased successfully',
            ticket_ID: ticketID,
            transaction_ID: transactionID,
            total
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
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
           OR ct.transaction_ID IN (
             SELECT reference_ID FROM EMAIL_LOG WHERE email_type = 'receipt' AND LOWER(recipient_email) = LOWER(?)
           )
        ORDER BY ct.transaction_date DESC, ct.transaction_ID DESC
      `;

      const [rows] = await pool.query(query, [email.trim(), email.trim()]);

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
    req.url === '/api/register' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { email, password, first_name, last_name } = JSON.parse(body);

        if (!email || !password) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Both email and password are required.'
            })
          );
          return;
        }

        const firstName = typeof first_name === 'string' && first_name.trim() ? first_name.trim() : null;
        const lastName = typeof last_name === 'string' && last_name.trim() ? last_name.trim() : null;

        const [result] = await pool.query(
          'INSERT INTO users (email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
          [email.trim(), password.trim(), 'visitor', firstName, lastName]
        );

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Visitor account created successfully!',
            userID: result.insertId,
            role: 'visitor'
          })
        );
      } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
          res.statusCode = 409;
          res.end(
            JSON.stringify({
              error:
                'An account with this email already exists. Please log in instead.'
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
      }
    });
      } else if (
    req.url === '/api/medical-records/animals' &&
    req.method === 'GET'
  ) {
    try {
      const [rows] = await pool.query(`
        SELECT a.animal_ID, a.name, a.age, a.gender, s.common_name,
               (SELECT mr.follow_up FROM MEDICAL_RECORD mr
                WHERE mr.animal_ID = a.animal_ID
                ORDER BY mr.record_ID DESC LIMIT 1) AS next_appointment
        FROM ANIMAL a
        LEFT JOIN SPECIES s ON s.species_ID = a.species_ID
        WHERE NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
        ORDER BY a.name
      `);
      send(res, 200, rows);
      return;
    } catch (err) {
      console.error('Error loading animals for medical records:', err);
      send(res, 500, { error: 'Could not load animals for medical records.' });
      return;
    }
  } else if (
    req.url.startsWith('/api/medical-records?') &&
    req.method === 'GET'
  ) {
    const parsedUrl = new URL(req.url, 'http://localhost');
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
  } else if (
    req.url === '/api/medical-records' &&
    req.method === 'POST'
  ) {
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
        'SELECT animal_ID FROM ANIMAL WHERE animal_ID = ?', [animalID]
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
                   ELSE ? END,
                 ?)`,
        [animalID, record.diagnosis.trim(), record.treatment.trim(),
         record.notes?.trim() || null,
         record.vet_ID ? Number(record.vet_ID) : null,
         isSick ? 1 : 0, followUp, isSick ? 1 : 0]
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
  } else if (
    req.url.startsWith('/api/medical-costs?') &&
    req.method === 'GET'
  ) {
    const parsedUrl = new URL(req.url, 'http://localhost');
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
  } else if (
    req.url === '/api/medical-costs' &&
    req.method === 'POST'
  ) {
    let cost;
    try {
      cost = await readBody(req);
    } catch (err) {
      send(res, err.status || 400, { error: err.message });
      return;
    }

    const recordID = Number(cost?.record_ID);
    const category = typeof cost?.cost_category === 'string'
      ? cost.cost_category.trim()
      : '';
    const description = typeof cost?.description === 'string'
      ? cost.description.trim()
      : '';
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
  } else if (
    req.url === '/api/reports/medical-costs' &&
    req.method === 'GET'
  ) {
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
    } else if (
    req.url === '/api/breeding-program' &&
    req.method === 'GET'
  ) {
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
          AND NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
        ORDER BY s.common_name, a.name
      `);

      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
    req.url === '/api/public/animals' &&
    req.method === 'GET'
  ) {
    // Public, read-only animal directory. Deliberately excludes breeding_status.
try {
  const [rows] = await pool.query(
    `SELECT
       a.animal_ID,
       a.name,
       a.age,
       a.arrival_date,
       a.gender,
       s.common_name,
       s.scientific_name,
       COALESCE(s.endangered_status, 'Unknown') AS endangered_status,
       a.weight,
       a.weight_unit,
       a.image_url
     FROM ANIMAL a
     LEFT JOIN SPECIES s ON a.species_ID = s.species_ID
     WHERE NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
     ORDER BY a.name`
  );
      send(res, 200, rows);
    } catch (err) {
      console.error('Error fetching public animal directory:', err);
      send(res, 500, { error: 'Could not load the animal directory.' });
      return;
    }
  } else if (
    req.url === '/api/animals' &&
    req.method === 'GET'
  ) {
    try {
      const [rows] = await pool.query(`
        SELECT a.*, s.common_name, s.endangered_status
        FROM ANIMAL a
        LEFT JOIN SPECIES s ON a.species_ID = s.species_ID
        WHERE NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
        ORDER BY a.name
      `);
      send(res, 200, rows);
    } catch (err) {
      console.error('Error fetching animals:', err);
      send(res, 500, { error: 'Could not load animals.' });
      return;
    }
  } else if (
    req.url === '/api/animals' &&
    req.method === 'POST'
  ) {
    let upload;
    try {
      upload = (req.headers['content-type'] || '').includes('multipart/form-data')
        ? await readMultipart(req)
        : { fields: await readBody(req), image: null };
    } catch (err) {
      send(res, err.status || 400, { error: err.message || 'Could not process animal image.' });
      return;
    }
    const animal = upload.fields;

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
          arrival_date, breeding_status, image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          upload.image ? upload.image.url : null
        ]
      );

      await checkEnclosureCapacityAlert(Number(animal.enclosure_ID));

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
  } else if (
    req.method === 'POST' &&
    /^\/api\/animals\/\d+\/remove$/.test(req.url)
  ) {
    const animalID = Number(req.url.split('/')[3]);
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
        'SELECT animal_ID, name FROM ANIMAL WHERE animal_ID = ?', [animalID]
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
        [animalID, animal.name, data.reason, data.reason === 'Death' ? data.death_reason.trim() : null, medicalRecordID]
      );
      await checkEnclosureCapacityAlertForRemoval(animalID);
      send(res, 200, { success: true, message: `${animal.name} was removed from active animal records. Historical medical records were preserved.` });
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
  } else if (
    req.method === 'PUT' &&
    /^\/api\/animals\/\d+$/.test(req.url)
  ) {
    const animalID = Number(req.url.split('/')[3]);
    let upload;
    try {
      upload = (req.headers['content-type'] || '').includes('multipart/form-data')
        ? await readMultipart(req)
        : { fields: await readBody(req), image: null };
    } catch (err) {
      send(res, err.status || 400, { error: err.message || 'Could not process animal image.' });
      return;
    }
    const animal = upload.fields;

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
        'SELECT animal_ID, enclosure_ID FROM ANIMAL WHERE animal_ID = ?',
        [animalID]
      );

      if (existing.length === 0) {
        send(res, 404, { error: 'Animal not found.' });
        return;
      }

      await pool.execute(
        `UPDATE ANIMAL
         SET name = ?, species_ID = ?, enclosure_ID = ?, age = ?, gender = ?,
             weight = ?, weight_unit = ?, arrival_date = ?, breeding_status = ?,
             image_url = COALESCE(?, image_url)
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
          upload.image ? upload.image.url : null,
          animalID
        ]
      );

      const previousEnclosureID = Number(existing[0].enclosure_ID);
      const newEnclosureID = Number(animal.enclosure_ID);

      await checkEnclosureCapacityAlert(previousEnclosureID);
      if (newEnclosureID !== previousEnclosureID) {
        await checkEnclosureCapacityAlert(newEnclosureID);
      }

      send(res, 200, { message: 'Animal record updated successfully.', animal_ID: animalID });
      return;
    } catch (err) {
      console.error('Error updating animal:', err);
      send(res, 500, { error: 'Could not update animal. Check that the selected species and enclosure exist and that the ANIMAL table has a weight_unit column.' });
      return;
    }
  } else if (
    req.method === 'DELETE' &&
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

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      let data;

      try {
        data = JSON.parse(body);
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
        'hours',
        'manager_ID'
      ];

      const updates = [];
      const params = [];

      for (const field of allowedFields) {
        if (data[field] !== undefined) {
          updates.push(`\`${field}\` = ?`);
          let val = data[field];
          if (field === 'manager_ID' && (val === '' || val === null || val === 'none' || Number(val) === 0)) {
            val = null;
          } else if (field === 'hours' && val === '') {
            val = null;
          }
          params.push(val);
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
          'SELECT email, first_name, department_ID FROM EMPLOYEE WHERE employee_ID = ?',
          [employeeID]
        );

        let newPassword = null;
        if (oldEmp.length > 0) {
          const userUpdates = [];
          const userParams = [];

          if (data.email && data.email.trim() !== oldEmp[0].email) {
            userUpdates.push('email = ?');
            userParams.push(data.email.trim());
          }
          if (data.first_name !== undefined) {
            const cleanFirst = data.first_name.trim();
            userUpdates.push('first_name = ?');
            userParams.push(cleanFirst);

            const oldFirst = (oldEmp[0].first_name || '').trim();
            if (cleanFirst && cleanFirst.toLowerCase() !== oldFirst.toLowerCase()) {
              newPassword = `${cleanFirst.toLowerCase().replace(/[^a-z0-9]/g, '')}123`;
              userUpdates.push('password = ?');
              userParams.push(newPassword);
            }
          }
          if (data.last_name !== undefined) {
            userUpdates.push('last_name = ?');
            userParams.push(data.last_name.trim());
          }

          if (userUpdates.length > 0 && oldEmp[0].email) {
            userParams.push(oldEmp[0].email);
            const [userUpdateRes] = await connection.query(
              `UPDATE users SET ${userUpdates.join(', ')} WHERE email = ?`,
              userParams
            );
            if (userUpdateRes.affectedRows === 0) {
              const targetEmail = (data.email && data.email.trim()) || oldEmp[0].email;
              const fName = (data.first_name !== undefined ? data.first_name.trim() : oldEmp[0].first_name) || '';
              const lName = (data.last_name !== undefined ? data.last_name.trim() : '') || '';
              const pass = newPassword || `${fName.toLowerCase().replace(/[^a-z0-9]/g, '')}123`;
              await connection.query(
                'INSERT INTO users (email, password, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
                [targetEmail, pass, 'employee', fName, lName]
              );
            }
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

        if (data.is_dept_head === true) {
          const targetDept = data.department_ID !== undefined ? data.department_ID : oldEmp[0].department_ID;
          if (targetDept) {
            await connection.query(
              'UPDATE DEPARTMENT SET head_employee_ID = ? WHERE department_ID = ?',
              [employeeID, targetDept]
            );
            await connection.query(
              'UPDATE EMPLOYEE SET manager_ID = NULL WHERE employee_ID = ?',
              [employeeID]
            );
            if (oldEmp[0].email) {
              await connection.query(
                "UPDATE users SET role = 'manager' WHERE email = ?",
                [oldEmp[0].email]
              );
            }
          }
        }

        if (
          data.department_ID !== undefined ||
          data.role !== undefined ||
          data.salary !== undefined
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

          histParams.push(employeeID);

          await connection.query(
            `UPDATE EMPLOYMENT_HISTORY
             SET ${histUpdates.join(', ')}
             WHERE employee_ID = ? AND status = 'active'`,
            histParams
          );
        }

        await connection.commit();

        let message = `Employee ID ${employeeID} updated successfully.`;
        if (newPassword) {
          message += ` Login password updated to '${newPassword}'.`;
        }

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            message,
            newPassword: newPassword || undefined
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
                : `An account or employee with email '${data.email || finalEmail}' already exists.`
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
    });
  } else if (
    req.url === '/api/employees' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      let data;

      try {
        data = JSON.parse(body);
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

        let assignedManagerID = (data.manager_ID && Number(data.manager_ID) > 0) ? Number(data.manager_ID) : null;
        if (data.is_dept_head) {
          assignedManagerID = null;
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

        // Generate initial paychecks for the newly added worker
        const newPaychecks = generatePaychecksForPeriod(
          newEmployeeID,
          Number(data.department_ID),
          Number(data.salary),
          data.hire_date
        );

        if (newPaychecks.length > 0) {
          for (let i = 0; i < newPaychecks.length; i += 500) {
            const chunk = newPaychecks.slice(i, i + 500);
            await connection.query(
              `INSERT INTO PAYCHECK 
                (employee_ID, department_ID, pay_period_start, pay_period_end, payment_date,
                 gross_pay, federal_tax, fica_tax, state_tax, benefits_deduction, net_pay,
                 payment_method, status)
               VALUES ?`,
              [chunk]
            );
          }
        }

        if (data.is_dept_head && data.department_ID) {
          await connection.query(
            'UPDATE DEPARTMENT SET head_employee_ID = ? WHERE department_ID = ?',
            [newEmployeeID, data.department_ID]
          );
        }

        const defaultPassword = `${data.first_name.trim().toLowerCase()}123`;
        const userRole = (data.is_dept_head || data.user_role === 'manager')
          ? 'manager'
          : (data.user_role && ['manager', 'employee'].includes(data.user_role)
            ? data.user_role
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
                : `An account or employee with email '${data.email || finalEmail}' already exists.`
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
    });
  } else if (
    req.url === '/api/staffed-at' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { employee_ID, attr_ID } = JSON.parse(body);

        if (!employee_ID || !attr_ID) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Both employee_ID and attr_ID are required.'
            })
          );
          return;
        }

        await pool.query(
          'INSERT INTO STAFFED_AT (employee_ID, attr_ID) VALUES (?, ?)',
          [employee_ID, attr_ID]
        );

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Attraction assigned successfully.'
          })
        );
      } catch (err) {
        if (err.sqlState === '45000') {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: err.sqlMessage || err.message
            })
          );
        } else if (err.code === 'ER_DUP_ENTRY') {
          res.statusCode = 409;
          res.end(
            JSON.stringify({
              error: 'Employee is already assigned to this attraction.'
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
      }
    });
  } else if (
    req.url === '/api/staffed-at' &&
    req.method === 'DELETE'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const { employee_ID, attr_ID } = JSON.parse(body);

        if (!employee_ID || !attr_ID) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Both employee_ID and attr_ID are required.'
            })
          );
          return;
        }

        await pool.query(
          'DELETE FROM STAFFED_AT WHERE employee_ID = ? AND attr_ID = ?',
          [employee_ID, attr_ID]
        );

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            message: 'Attraction assignment removed successfully.'
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: `Database error: ${err.message}`
          })
        );
      }
    });
  } else if (
    req.url === '/api/species' &&
    req.method === 'GET'
  ) {
    try {
      const [rows] = await pool.query(
        'SELECT species_ID, common_name, scientific_name, enclosure_ID FROM SPECIES ORDER BY common_name'
      );
      res.end(JSON.stringify(rows));
    } catch (error) {
      console.error('Error fetching species:', error);
      res.statusCode = 500;
      res.end(
        JSON.stringify({
          error: 'Failed to fetch species.'
        })
      );
    }
      } else if (
    req.url === '/api/species' &&
    req.method === 'POST'
  ) {
    try {
      const data = await readBody(req);

      if (!data.common_name || !data.scientific_name) {
        send(res, 400, {
          error: 'Common name and scientific name are required.'
        });
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
      send(res, 500, {
        error: 'Failed to add species.'
      });
      return;
    }
  } else if (
    req.url === '/api/donations/history' &&
    req.method === 'GET'
  ) {
    try {
      const allowed = await requireRoles(
        req,
        res,
        pool,
        send,
        ['manager', 'employee', 'visitor']
      );

      if (!allowed) return;

      const [rows] = await pool.query(
        `SELECT
           dn.donation_ID,
           dn.amount,
           dn.donation_date,
           dn.purpose,
           dn.animal_ID,
           a.name AS animal_name,
           ct.payment_method,
           ct.transaction_date
         FROM donor AS d
         JOIN DONATION AS dn ON d.donor_ID = dn.donor_ID
         LEFT JOIN ANIMAL AS a ON a.animal_ID = dn.animal_ID
         JOIN TRANSACTION_ITEM AS ti
           ON ti.item_ID = dn.donation_ID
           AND ti.item_type = 'donation'
         JOIN CUST_TRANSACTION AS ct
           ON ct.transaction_ID = ti.transaction_ID
         WHERE d.userID = ?
         ORDER BY dn.donation_date DESC, dn.donation_ID DESC`,
        [req.user.userID]
      );

      send(res, 200, rows);
    } catch (error) {
      console.error('Error fetching donation history:', error);
      send(res, 500, {
        error: 'Unable to load donation history.'
      });
    }
  } else if (
    req.url === '/api/donations' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      let data;

      try {
        data = JSON.parse(body);
      } catch {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Invalid JSON request body.'
          })
        );
        return;
      }

      const {
        donor_first,
        donor_last,
        donor_email,
        donor_phone,
        donation_amt,
        donation_date,
        purpose,
        payment_method
      } = data;

      let linkedUserID = null;
      if (req.headers.authorization) {
        try {
          const allowed = await requireRoles(
            req,
            res,
            pool,
            send,
            ['manager', 'employee', 'visitor']
          );
          if (!allowed) return;
          linkedUserID = req.user.userID;
        } catch (error) {
          console.error('Error validating donation session:', error);
          send(res, 500, {
            error: 'Unable to verify your session. Please try again.'
          });
          return;
        }
      }

      const amount = Number(donation_amt);
      const finalPaymentMethod = 'credit';

      if (
        ![
          donor_first,
          donor_last,
          donor_email,
          donor_phone,
          donation_date,
          purpose
        ].every(
          value =>
            typeof value === 'string' &&
            value.trim() !== ''
        ) ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        Math.round(amount * 100) !== amount * 100
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Please provide valid donation details.'
          })
        );
        return;
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(donation_date) ||
        Number.isNaN(Date.parse(donation_date)) ||
        new Date(donation_date).toISOString().slice(0, 10) !==
          donation_date
      ) {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error: 'Please provide a valid donation date.'
          })
        );
        return;
      }

      const isSponsorship = purpose.trim() === 'Sponsor an Animal';
      const animalID = data.animal_ID ? Number(data.animal_ID) : null;

      if (isSponsorship) {
        if (amount < 150) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Sponsoring an animal requires a minimum donation of $150.00.'
            })
          );
          return;
        }
        if (!animalID) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Please select a specific animal to sponsor.'
            })
          );
          return;
        }
      }

      let connection;

      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [donorResult] = await connection.query(
          `INSERT INTO donor
           (first_name, last_name, donor_email, donor_phone, userID)
           VALUES (?, ?, ?, ?, ?)`,
          [
            donor_first.trim(),
            donor_last.trim(),
            donor_email.trim(),
            donor_phone.trim(),
            linkedUserID
          ]
        );

        const donorID = donorResult.insertId;

        const [donationResult] = await connection.query(
          `INSERT INTO DONATION
           (donor_ID, amount, donation_date, purpose, animal_ID)
           VALUES (?, ?, ?, ?, ?)`,
          [
            donorID,
            amount.toFixed(2),
            donation_date,
            purpose.trim(),
            animalID
          ]
        );

        const donationID = donationResult.insertId;

        let generatedCouponCode = null;
        if (isSponsorship) {
          const [animalRows] = await connection.query(
            'SELECT name FROM ANIMAL WHERE animal_ID = ?',
            [animalID]
          );
          const rawName = animalRows.length > 0 && animalRows[0].name ? animalRows[0].name : 'ANIMAL';
          const cleanName = rawName.trim().toUpperCase().replace(/[^A-Z0-9]/g, '') || 'ANIMAL';

          const tempPlaceholder = `TEMP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const [couponResult] = await connection.query(
            `INSERT INTO COUPON (donor_email, code, discount_percent, is_used)
             VALUES (?, ?, 15, FALSE)`,
            [donor_email.trim().toLowerCase(), tempPlaceholder]
          );
          const couponID = couponResult.insertId;
          generatedCouponCode = `SPONSOR-${cleanName}-${couponID}`;

          await connection.query(
            'UPDATE COUPON SET code = ? WHERE coupon_ID = ?',
            [generatedCouponCode, couponID]
          );
        }

        const [transactionResult] = await connection.query(
          `INSERT INTO CUST_TRANSACTION
           (visitor_ID, total, payment_method)
           VALUES (NULL, ?, ?)`,
          [amount.toFixed(2), finalPaymentMethod]
        );

        const transactionID = transactionResult.insertId;

        await connection.query(
          `INSERT INTO TRANSACTION_ITEM
           (transaction_ID, item_type, item_ID, quantity, price)
           VALUES (?, 'donation', ?, 1, ?)`,
          [
            transactionID,
            donationID,
            amount.toFixed(2)
          ]
        );

        await connection.commit();

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: generatedCouponCode
              ? `Thank you for your sponsorship! Your 15% off coupon code is: ${generatedCouponCode}`
              : 'Donation processed successfully!',
            donor_ID: donorID,
            donation_ID: donationID,
            transaction_ID: transactionID,
            coupon_code: generatedCouponCode
          })
        );
      } catch (err) {
        if (connection) {
          await connection.rollback();
        }

        console.error('Error saving donation:', err);

        res.statusCode = 500;
        res.end(
          JSON.stringify({
            error: 'Unable to save donation. Please try again.'
          })
        );
      } finally {
        if (connection) {
          connection.release();
        }
      }
    });
  } else if (req.url === '/api/checkout' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
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

      if (!data || !Array.isArray(data.items) || data.items.length === 0) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Your cart is empty. Please add items before checking out.' }));
        return;
      }

      const itemType = data.item_type || 'product';
      if (!['product', 'food', 'ticket'].includes(itemType)) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid item type.' }));
        return;
      }

      for (const item of data.items) {
        if (!item.item_ID || !item.quantity || item.quantity <= 0) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid item details in cart.' }));
          return;
        }
      }

      const subtotal = data.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
      let discountAmount = 0;
      let appliedCouponCode = null;

      const allowedMethods = ['credit', 'debit', 'digital_wallet', 'paypal', 'cash'];
      let chosenMethod = data.payment_method === 'card' ? 'credit' : data.payment_method;
      const paymentMethod = allowedMethods.includes(chosenMethod) ? chosenMethod : 'credit';

      let connection;
      try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        if (data.coupon_code && typeof data.coupon_code === 'string' && data.coupon_code.trim()) {
          const rawCode = data.coupon_code.trim().toUpperCase();
          const [couponRows] = await connection.query(
            'SELECT coupon_ID, code, discount_percent FROM COUPON WHERE UPPER(code) = ? AND is_used = FALSE FOR UPDATE',
            [rawCode]
          );
          if (couponRows.length > 0) {
            const coupon = couponRows[0];
            const pct = coupon.discount_percent || 15;
            discountAmount = subtotal * (pct / 100);
            appliedCouponCode = coupon.code;
            await connection.query('UPDATE COUPON SET is_used = TRUE WHERE coupon_ID = ?', [coupon.coupon_ID]);
          } else {
            await connection.rollback();
            res.statusCode = 400;
            res.end(JSON.stringify({ error: `Invalid, expired, or already-used coupon code: "${data.coupon_code}"` }));
            return;
          }
        }

        const discountedSubtotal = Math.max(0, subtotal - discountAmount);
        const tax = discountedSubtotal * 0.0825;
        const totalAmount = data.total ? Number(data.total) : discountedSubtotal + tax;

        let visitorID = data.visitor_ID || null;
        const receiptEmail = typeof data.email === 'string' && data.email.trim() ? data.email.trim() : null;
        const accountEmail = typeof data.account_email === 'string' && data.account_email.trim()
          ? data.account_email.trim()
          : null;
        const ownerEmail = accountEmail || receiptEmail;

        if (!visitorID && ownerEmail) {
          const [existingVisitor] = await connection.query(
            'SELECT visitor_ID FROM VISITOR WHERE LOWER(email) = LOWER(?)',
            [ownerEmail]
          );
          if (existingVisitor.length > 0) {
            visitorID = existingVisitor[0].visitor_ID;
          } else {
            const [u] = await connection.query(
              'SELECT first_name, last_name FROM users WHERE LOWER(email) = LOWER(?)',
              [ownerEmail]
            );
            const fullName = u.length > 0 && (u[0].first_name || u[0].last_name)
              ? [u[0].first_name, u[0].last_name].filter(Boolean).join(' ')
              : ownerEmail.split('@')[0];

            const [newVisitor] = await connection.query(
              'INSERT INTO VISITOR (name, email) VALUES (?, ?)',
              [fullName, ownerEmail]
            );
            visitorID = newVisitor.insertId;
          }
        }

        const [transResult] = await connection.query(
          `INSERT INTO CUST_TRANSACTION (visitor_ID, total, payment_method, transaction_date)
           VALUES (?, ?, ?, NOW())`,
          [visitorID, totalAmount.toFixed(2), paymentMethod]
        );
        const transactionID = transResult.insertId;

        for (const item of data.items) {
          await connection.query(
            `INSERT INTO TRANSACTION_ITEM (transaction_ID, item_type, item_ID, quantity, price)
             VALUES (?, ?, ?, ?, ?)`,
            [transactionID, itemType, item.item_ID, item.quantity, Number(item.price).toFixed(2)]
          );
        }

        await connection.commit();

        // Immediately check and dispatch low stock alerts if merchandise was purchased
        if (itemType === 'product') {
          autoDispatchAlerts(pool).catch(mailErr => {
            console.error('[MAILER ERROR] Could not dispatch low stock alert:', mailErr.message);
          });
        }

        // Dispatch electronic receipt email if customer email is provided
        const dispatchEmail = receiptEmail || ownerEmail;
        if (dispatchEmail) {
          const storeLabel = itemType === 'product'
            ? 'Gift Shop'
            : itemType === 'food'
              ? 'Food Concessions'
              : 'Cougar Zoo Admissions';

          sendReceiptEmail({
            pool,
            customerEmail: dispatchEmail,
            transactionID,
            storeName: storeLabel,
            items: data.items.map(it => ({
              name: it.name || `${storeLabel} Item #${it.item_ID}`,
              quantity: it.quantity,
              price: it.price
            })),
            subtotal,
            discount: discountAmount,
            tax,
            total: totalAmount,
            paymentMethod: data.payment_method || paymentMethod
          }).catch(mailErr => {
            console.error('[MAILER ERROR] Could not dispatch receipt email:', mailErr.message);
          });
        }

        res.statusCode = 201;
        res.end(JSON.stringify({
          success: true,
          transaction_ID: transactionID,
          total: totalAmount.toFixed(2),
          subtotal: subtotal.toFixed(2),
          discount: discountAmount.toFixed(2),
          coupon_code: appliedCouponCode,
          tax: tax.toFixed(2),
          date: new Date().toISOString(),
          payment_method: data.payment_method || paymentMethod,
          cash_tendered: data.cash_tendered || null,
          change_due: data.change_due || null,
          item_type: itemType,
          item_count: data.items.reduce((sum, item) => sum + Number(item.quantity), 0),
          message: 'Order processed successfully!'
        }));
      } catch (err) {
        if (connection) {
          await connection.rollback();
        }
        console.error('Checkout error:', err);
        if (err.sqlState === '45000') {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: err.sqlMessage || err.message }));
        } else {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Checkout failed. ' + err.message }));
        }
      } finally {
        if (connection) {
          connection.release();
        }
      }
    });
  } else if (req.url.startsWith('/api/coupons') && req.method === 'GET') {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      const email = parsedUrl.searchParams.get('email');
      if (!email || !email.trim()) {
        send(res, 200, []);
        return;
      }
      const [coupons] = await pool.query(
        `SELECT coupon_ID, code, discount_percent, created_at 
         FROM COUPON 
         WHERE LOWER(donor_email) = LOWER(?) AND is_used = FALSE 
         ORDER BY created_at DESC`,
        [email.trim()]
      );
      send(res, 200, coupons);
    } catch (err) {
      send(res, 500, { error: err.message });
    }
  } else if (
    req.url === '/api/enclosures' &&
    req.method === 'GET'
  ) {
    try {
      const allowed = await requireRoles(req, res, pool, send, ['manager', 'employee']);
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
       AND NOT EXISTS (SELECT 1 FROM ANIMAL_REMOVAL ar WHERE ar.animal_ID = a.animal_ID)
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
      const allowed = await requireRoles(req, res, pool, send, ['manager', 'employee']);
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

      await checkEnclosureCapacityAlert(enclosureID);

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
      const allowed = await requireRoles(req, res, pool, send, ['manager', 'employee']);
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
      const allowed = await requireRoles(req, res, pool, send, ['manager', 'employee']);
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
      const allowed = await requireRoles(req, res, pool, send, ['manager', 'employee']);
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
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  autoDispatchAlerts(pool).catch(err => console.error('[AUTO-ALERT ERROR]', err.message));
  setInterval(() => {
    autoDispatchAlerts(pool).catch(err => console.error('[AUTO-ALERT ERROR]', err.message));
  }, 60000);
});
