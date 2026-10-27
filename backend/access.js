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
      `SELECT userID, email, role
       FROM users
       WHERE email = ? AND password = ?`,
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
      role: user.role,
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
    pathname === '/api/products' &&
    req.method === 'POST';

  const isMenuWrite =
    pathname === '/api/menu-items' &&
    req.method === 'POST';

  const isParkingSessionRequest =
    pathname === '/api/parking-sessions' ||
    pathname.startsWith('/api/parking-sessions/');

  let allowedRoles = null;

  if (isProductWrite || isMenuWrite) {
    allowedRoles = ['admin', 'manager'];
  } else if (isParkingSessionRequest) {
    allowedRoles = ['admin', 'manager', 'employee'];
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
  }

  return false;
}

module.exports = handleAccess;