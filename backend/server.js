require('dotenv').config();
const http = require('http');
const pool = require('./db');
const PORT = process.env.PORT || 5000;

function send(res, status, data) {
  res.statusCode = status;
  res.end(JSON.stringify(data));
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const getQueries = {
      '/api/products': `
        SELECT p.*, s.name AS shop_name
        FROM PRODUCT AS p
        JOIN GIFT_SHOP AS s ON p.shop_ID = s.shop_ID
        ORDER BY p.product_ID
      `,
      '/api/gift-shops':
        'SELECT shop_ID, name FROM GIFT_SHOP ORDER BY name',
      '/api/employees': 'SELECT * FROM employee_directory',
      '/api/manager': 'SELECT * FROM manager_view',
      '/api/hr': 'SELECT * FROM hr_view'
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

      if (
        !data ||
        !validText(data.name, 100) ||
        !validText(data.category, 50) ||
        !validText(data.color, 50) ||
        !validText(data.design, 100) ||
        !/^\d{1,6}(\.\d{1,2})?$/.test(String(data.price)) ||
        !Number.isInteger(data.quantity_in_stock) ||
        data.quantity_in_stock < 0 ||
        data.quantity_in_stock > 2147483647 ||
        !Number.isInteger(data.shop_ID) ||
        data.shop_ID <= 0
      ) {
        send(res, 400, {
          error: 'Check all fields. Price and stock must be valid, nonnegative numbers.'
        });
        return;
      }

      const [shops] = await pool.execute(
        'SELECT shop_ID FROM GIFT_SHOP WHERE shop_ID = ?',
        [data.shop_ID]
      );

      if (shops.length === 0) {
        send(res, 400, {
          error: 'Select an existing gift shop.'
        });
        return;
      }

      const [result] = await pool.execute(
        `INSERT INTO PRODUCT
         (name, category, price, quantity_in_stock, color, design, shop_ID)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name.trim(),
          data.category.trim(),
          data.price,
          data.quantity_in_stock,
          data.color.trim(),
          data.design.trim(),
          data.shop_ID
        ]
      );

      send(res, 201, {
        product_ID: result.insertId,
        message: 'Product added successfully.'
      });
      return;
    }

    if (req.url === '/api/login' && req.method === 'POST') {
      const data = await readBody(req);

      if (
        !data ||
        typeof data.email !== 'string' ||
        typeof data.password !== 'string'
      ) {
        send(res, 400, {
          error: 'Email and password are required.'
        });
        return;
      }

      const [rows] = await pool.execute(
        'SELECT userID, role FROM users WHERE email = ? AND password = ?',
        [data.email, data.password]
      );

      if (rows.length > 0) {
        send(res, 200, rows[0]);
      } else {
        send(res, 401, {
          error: 'Invalid email or password or user does not exist'
        });
      }
      return;
    }

    send(res, 404, { message: 'Not Found' });
  } catch (err) {
    console.error(err);
    send(res, err.status || 500, {
      error: err.status ? err.message : 'Server error'
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});