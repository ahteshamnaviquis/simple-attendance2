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
  // Several addresses can be listed, separated by commas.
  FRONTEND_URLS: (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, '')),

  // Railway (which sets RAILWAY_ENVIRONMENT) needs 0.0.0.0 to reach the app.
  // Locally 127.0.0.1 keeps the API private to this computer.
  HOST: process.env.RAILWAY_ENVIRONMENT ? '0.0.0.0' : '127.0.0.1',

  // The MySQL database. The server creates the database and its tables if they
  // don't exist yet (the user needs permission for that).
  DB: databaseSettings(),
};

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
