const {
  createSession,
  endSession,
  requireRoles
} = require('./auth');

async function handleAccess(req, res, pool, send, readBody) {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/api/login' && req.method === 'POST') {
    const data = await readBody(req);

    if (
      !data ||
      typeof data.email !== 'string' ||
      typeof data.password !== 'string' ||
      !data.email.trim() ||
      !data.password
    ) {
      send(res, 400, {
        error: 'Email and password are required.'
      });
      return true;
    }

    const [users] = await pool.execute(
      `SELECT u.userID, u.email, u.role, u.first_name, u.last_name, e.department_ID,
              (e.employee_ID IS NOT NULL AND e.employee_ID = d.head_employee_ID) AS is_dept_head
       FROM users u
       LEFT JOIN employee e ON u.email = e.email
       LEFT JOIN department d ON e.department_ID = d.department_ID
       WHERE u.email = ? AND u.password = ?`,
      [data.email.trim(), data.password]
    );

    if (users.length === 0) {
      send(res, 401, {
        error: 'Invalid email or password.'
      });
      return true;
    }

    const user = users[0];
    const token = createSession(user.userID);

    res.setHeader('Cache-Control', 'no-store');

    send(res, 200, {
      userID: user.userID,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      role: user.role,
      department_ID: user.department_ID ? Number(user.department_ID) : null,
      is_dept_head: Boolean(user.is_dept_head),
      token
    });
    return true;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    endSession(req);

    send(res, 200, {
      message: 'Logged out successfully.'
    });
    return true;
  }

  const isProductWrite =
    (pathname === '/api/products' || pathname.startsWith('/api/products/')) &&
    ['POST', 'PUT', 'DELETE'].includes(req.method);

  const isFoodWrite =
    (pathname === '/api/food-stalls' ||
      /^\/api\/food-stalls\/\d+$/.test(pathname) ||
      /^\/api\/food-stalls\/\d+\/image$/.test(pathname) ||
      pathname === '/api/menu-items' ||
      /^\/api\/menu-items\/\d+$/.test(pathname)) &&
    ['POST', 'PUT', 'DELETE'].includes(req.method);

  let allowedRoles = null;

  if (isProductWrite || isFoodWrite) {
    allowedRoles = ['manager'];
  }

  if (allowedRoles) {
    res.setHeader('Cache-Control', 'no-store');

    const allowed = await requireRoles(
      req,
      res,
      pool,
      send,
      allowedRoles
    );

    if (!allowed) {
      return true;
    }

    if (isFoodWrite && req.user.role === 'manager') {
      const [employees] = await pool.execute(
        'SELECT department_ID FROM employee WHERE email = ?',
        [req.user.email]
      );

      if (
        employees.length === 0 ||
        Number(employees[0].department_ID) !== 3
      ) {
        send(res, 403, {
          error: 'Food stall and menu management is limited to Commercial Operations managers.'
        });
        return true;
      }
    }
  }

  return false;
}

module.exports = handleAccess;