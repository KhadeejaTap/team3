const { randomBytes } = require('crypto');

const sessions = new Map();
const SESSION_DURATION = 8 * 60 * 60 * 1000;

function getToken(req) {
  const header = req.headers.authorization;

  if (typeof header !== 'string') return null;

  const match = header.match(/^Bearer ([a-f0-9]{64})$/);
  return match ? match[1] : null;
}

function createSession(userID) {
  const token = randomBytes(32).toString('hex');

  sessions.set(token, {
    userID,
    expiresAt: Date.now() + SESSION_DURATION
  });

  return token;
}

function endSession(req) {
  const token = getToken(req);

  if (token) {
    sessions.delete(token);
  }
}

async function requireRoles(req, res, pool, send, allowedRoles) {
  const token = getToken(req);
  const session = token ? sessions.get(token) : null;

  if (!session || session.expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(token);
    }

    send(res, 401, {
      error: 'Please log in again to continue.'
    });
    return false;
  }

  const [users] = await pool.execute(
    'SELECT userID, email, role FROM users WHERE userID = ?',
    [session.userID]
  );

  if (users.length === 0) {
    sessions.delete(token);

    send(res, 401, {
      error: 'This account no longer exists. Please log in again.'
    });
    return false;
  }

  const user = users[0];

  if (!allowedRoles.includes(user.role)) {
    send(res, 403, {
      error: 'Your role does not have permission for this action.'
    });
    return false;
  }

  req.user = user;
  return true;
}

const cleanup = setInterval(() => {
  const now = Date.now();

  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}, 60 * 1000);

cleanup.unref();

module.exports = {
  createSession,
  endSession,
  requireRoles
};