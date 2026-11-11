// Backend settings, read from backend/.env (real environment variables win).

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  process.loadEnvFile(envFile); // built into Node.js 20.12+
}

module.exports = {
  PORT: Number(process.env.PORT) || 5050,

  // The website allowed to call this API from the browser (CORS).
  // Several addresses can be listed, separated by commas. Only the scheme and
  // host count (the browser sends no path), so https://example.com/att works too.
  FRONTEND_URLS: (process.env.FRONTEND_URL || 'http://localhost:5174,https://zatechnologz.com')
    .split(',')
    .map((url) => originOf(url.trim())),

  // The path the API is served under when the host doesn't remove it, for
  // example "/att" for https://example.com/att/api/... (empty = none).
  BASE_PATH: (process.env.BASE_PATH || '').trim().replace(/\/+$/, ''),

  // Railway (which sets RAILWAY_ENVIRONMENT) needs 0.0.0.0 to reach the app.
  // Locally 127.0.0.1 keeps the API private to this computer.
  HOST: process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1',

  // Demo quick login: the login page shows a button for each user, so nobody
  // has to type a username and password. DEMO_LOGIN=true turns it on; leave it
  // out (or set false) to turn it off. DEMO_LOGIN_USERS (optional) limits the
  // buttons to these usernames, separated by commas.
  DEMO_LOGIN: /^(true|1|yes|on)$/i.test(String(process.env.DEMO_LOGIN || '').trim()),
  DEMO_LOGIN_USERS: String(process.env.DEMO_LOGIN_USERS || '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean),

  // The platform owner (the "super super admin"), who adds academies and their
  // super admins. The account is made on the first start when there is none;
  // after that these values are not used (change the password in the database).
  OWNER: {
    name: (process.env.OWNER_NAME || 'Platform Owner').trim(),
    username: (process.env.OWNER_USERNAME || 'owner').trim().toLowerCase(),
    password: process.env.OWNER_PASSWORD || 'owner123',
  },

  // The MySQL database. The server creates the database and its tables if they
  // don't exist yet (the user needs permission for that).
  DB: databaseSettings(),
};

// "https://example.com/att/" -> "https://example.com"
function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/$/, '');
  }
}

// DATABASE_URL (or MYSQL_URL, which Railway's MySQL sets), for example
// mysql://user:password@host:3306/attendance, wins over the separate DB_* values.
function databaseSettings() {
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.slice(1) || 'attendance',
    };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'attendance',
  };
}
