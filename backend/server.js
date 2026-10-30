const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const http = require('http');
const pool = require('./db');
const handleFood = require('./food');
const handleParking = require('./parking');
const handleAccess = require('./access');
const { requireRoles } = require('./auth');

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
  res.statusCode = 200;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
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

  try {
    if (await handleAccess(req, res, pool, send, readBody)) {
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
        SELECT p.*, s.name AS shop_name
        FROM PRODUCT AS p
        JOIN GIFT_SHOP AS s ON p.shop_ID = s.shop_ID
        ORDER BY p.product_ID
      `,
      '/api/gift-shops':
        'SELECT shop_ID, name FROM GIFT_SHOP ORDER BY name'
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
          error:
            'Check all fields. Price and stock must be valid, nonnegative numbers.'
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
        query +=
          ' WHERE department_ID = (SELECT department_ID FROM EMPLOYEE WHERE email = ?)';
        params.push(email);
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
      const [rows] = await pool.query('SELECT * FROM hr_view');
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
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

      let query = `
        SELECT 
          d.department_ID,
          d.department_name,
          CONCAT_WS(' ', h.first_name, h.last_name) AS department_head,
          COUNT(e.employee_ID) AS active_headcount,
          COALESCE(SUM(e.salary), 0) AS total_payroll,
          COALESCE(ROUND(AVG(e.salary), 2), 0) AS average_salary,
          COALESCE(MIN(e.salary), 0) AS min_salary,
          COALESCE(MAX(e.salary), 0) AS max_salary,
          CASE d.department_ID
            WHEN 1 THEN 200000
            WHEN 2 THEN 300000
            WHEN 3 THEN 280000
            WHEN 6 THEN 100000
            WHEN 7 THEN 110000
            WHEN 8 THEN 95000
            WHEN 9 THEN 180000
            ELSE 150000
          END AS allocated_budget
        FROM DEPARTMENT d
        LEFT JOIN EMPLOYEE h ON d.head_employee_ID = h.employee_ID
        LEFT JOIN EMPLOYEE e ON d.department_ID = e.department_ID AND e.current = 1
      `;
      const params = [];

      if (email) {
        const [userRole] = await pool.query('SELECT role FROM users WHERE email = ?', [email]);
        const isManager = userRole.length > 0 && userRole[0].role === 'manager';

        if (isManager) {
          query += ' WHERE d.department_ID = (SELECT department_ID FROM EMPLOYEE WHERE email = ?)';
          params.push(email);
        } else if (departmentId && departmentId !== 'all') {
          query += ' WHERE d.department_ID = ?';
          params.push(departmentId);
        }
      } else if (departmentId && departmentId !== 'all') {
        query += ' WHERE d.department_ID = ?';
        params.push(departmentId);
      }

      query += ' GROUP BY d.department_ID, d.department_name, h.first_name, h.last_name';

      const sortColumns = {
        payroll: 'total_payroll DESC',
        headcount: 'active_headcount DESC',
        avg_salary: 'average_salary DESC',
        budget: 'allocated_budget DESC',
        name: 'd.department_name ASC'
      };
      const orderClause = sortColumns[sortBy] || 'total_payroll DESC';
      query += ` ORDER BY ${orderClause}`;

      const [rows] = await pool.query(query, params);
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
    req.url.startsWith('/api/reports/revenue') &&
    req.method === 'GET'
  ) {
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
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
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

      if (email) {
        const [userRole] = await pool.query('SELECT role FROM users WHERE email = ?', [email]);
        const isAdmin = userRole.length > 0 && userRole[0].role === 'admin';

        if (!isAdmin) {
          const [emp] = await pool.query('SELECT department_ID FROM EMPLOYEE WHERE email = ?', [email]);
          const deptId = emp.length > 0 ? emp[0].department_ID : null;

          if (deptId !== 2 && deptId !== 3) {
            res.statusCode = 403;
            res.end(JSON.stringify({ error: 'Access restricted to Zoo Administrators, Animal Care, and Veterinary personnel.' }));
            return;
          }
        }
      }

      let query = `
        SELECT 
          s.species_ID,
          s.common_name,
          s.scientific_name,
          COALESCE(s.endangered_status, 'Unknown') AS endangered_status,
          COUNT(a.animal_ID) AS total_count,
          COALESCE(ROUND(AVG(a.age), 1), 0) AS average_age,
          COUNT(CASE WHEN a.breeding_status = 'Active' THEN 1 END) AS breeding_count
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
      const orderClause = sortColumns[sortBy] || 'total_count DESC';
      query += ` ORDER BY ${orderClause}`;

      const [rows] = await pool.query(query, params);
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
    req.url === '/api/attractions' &&
    req.method === 'GET'
  ) {
    try {
      const [rows] = await pool.query(
        'SELECT attr_ID, name, location, type FROM ATTRACTION ORDER BY name ASC'
      );
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

        try {
          await connection.beginTransaction();

          let visitorID = null;

          if (visitorName != null) {
            const [visitorResult] = await connection.query(
              'INSERT INTO VISITOR (name) VALUES (?)',
              [visitorName.trim()]
            );
            visitorID = visitorResult.insertId;
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
          throw err;
        } finally {
          connection.release();
        }

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Ticket purchased successfully',
            ticket_ID: ticketID
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
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
        const { email, password } = JSON.parse(body);

        if (!email || !password) {
          res.statusCode = 400;
          res.end(
            JSON.stringify({
              error: 'Both email and password are required.'
            })
          );
          return;
        }

        const [result] = await pool.query(
          'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
          [email.trim(), password.trim(), 'visitor']
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
    req.url === '/api/animals' &&
    req.method === 'GET'
  ) {
    try {
      const [rows] = await pool.query('SELECT * FROM ANIMAL');
      res.end(JSON.stringify(rows));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    }
  } else if (
    req.url === '/api/animals' &&
    req.method === 'POST'
  ) {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', async () => {
      try {
        const animal = JSON.parse(body);

        const [result] = await pool.query(
          `INSERT INTO ANIMAL
           (name, species_ID, enclosure_ID, age, gender, weight,
            arrival_date, breeding_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            animal.name || null,
            animal.species_ID,
            animal.enclosure_ID,
            animal.age || null,
            animal.gender || null,
            animal.weight || null,
            animal.arrival_date || null,
            animal.breeding_status || null
          ]
        );

        res.statusCode = 201;
        res.end(
          JSON.stringify({
            message: 'Animal saved successfully',
            animal_ID: result.insertId
          })
        );
      } catch (err) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    });
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
          params.push(data[field]);
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

        if (data.email) {
          const [oldEmp] = await connection.query(
            'SELECT email FROM EMPLOYEE WHERE employee_ID = ?',
            [employeeID]
          );

          if (
            oldEmp.length > 0 &&
            oldEmp[0].email !== data.email.trim()
          ) {
            await connection.query(
              'UPDATE users SET email = ? WHERE email = ?',
              [data.email.trim(), oldEmp[0].email]
            );
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

        res.statusCode = 200;
        res.end(
          JSON.stringify({
            message: `Employee ID ${employeeID} updated successfully.`
          })
        );
      } catch (err) {
        await connection.rollback();

        if (err.code === 'ER_DUP_ENTRY') {
          res.statusCode = 409;
          res.end(
            JSON.stringify({
              error:
                `An account or employee with email '${data.email}' already exists.`
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
        'email',
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

      const connection = await pool.getConnection();

      try {
        await connection.beginTransaction();

        const [empResult] = await connection.query(
          `INSERT INTO EMPLOYEE
           (first_name, minit, last_name, street_address, city,
            state, zip_code, country, email, phone_number,
            department_ID, role, salary, hire_date,
            \`current\`, hours, manager_ID)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
          [
            data.first_name.trim(),
            data.minit ? data.minit.trim() : null,
            data.last_name.trim(),
            data.street_address.trim(),
            data.city.trim(),
            data.state.trim(),
            data.zip_code.trim(),
            data.country.trim(),
            data.email.trim(),
            data.phone_number ? data.phone_number.trim() : null,
            data.department_ID,
            data.role.trim(),
            data.salary,
            data.hire_date,
            data.hours ? data.hours : null,
            data.manager_ID ? data.manager_ID : null
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

        const defaultPassword = `${data.first_name.trim().toLowerCase()}123`;
        const userRole = (data.user_role && ['admin', 'manager', 'employee'].includes(data.user_role))
          ? data.user_role
          : (!data.manager_ID || (data.role && /(lead|director|chief|manager|supervisor)/i.test(data.role))
            ? 'manager'
            : 'employee');

        await connection.query(
          'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
          [data.email.trim(), defaultPassword, userRole]
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
              `Employee ${data.first_name} ${data.last_name} created successfully (ID: ${newEmployeeID}). Login generated: ${data.email.trim()} with password '${defaultPassword}' (${userRole}).`,
            employee_ID: newEmployeeID,
            generatedPassword: defaultPassword
          })
        );
      } catch (err) {
        await connection.rollback();

        if (err.code === 'ER_DUP_ENTRY') {
          res.statusCode = 409;
          res.end(
            JSON.stringify({
              error:
                `An account or employee with email '${data.email}' already exists.`
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
        'SELECT species_ID, common_name FROM SPECIES ORDER BY common_name'
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
    req.url === '/api/donations/history' &&
    req.method === 'GET'
  ) {
    try {
      const allowed = await requireRoles(
        req,
        res,
        pool,
        send,
        ['admin', 'manager', 'employee', 'visitor']
      );

      if (!allowed) return;

      const [rows] = await pool.query(
        `SELECT
           dn.donation_ID,
           dn.amount,
           dn.donation_date,
           dn.purpose,
           ct.payment_method,
           ct.transaction_date
         FROM donor AS d
         JOIN DONATION AS dn ON d.donor_ID = dn.donor_ID
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
            ['admin', 'manager', 'employee', 'visitor']
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
      const allowedMethods = [
        'credit',
        'debit',
        'digital_wallet',
        'paypal'
      ];

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
        Math.round(amount * 100) !== amount * 100 ||
        !allowedMethods.includes(payment_method)
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
           (donor_ID, amount, donation_date, purpose)
           VALUES (?, ?, ?, ?)`,
          [
            donorID,
            amount.toFixed(2),
            donation_date,
            purpose.trim()
          ]
        );

        const donationID = donationResult.insertId;

        const [transactionResult] = await connection.query(
          `INSERT INTO CUST_TRANSACTION
           (visitor_ID, total, payment_method)
           VALUES (NULL, ?, ?)`,
          [amount.toFixed(2), payment_method]
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
            message: 'Donation processed successfully!',
            donor_ID: donorID,
            donation_ID: donationID,
            transaction_ID: transactionID
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
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ message: 'Not Found' }));
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});