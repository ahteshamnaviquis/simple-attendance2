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

  // DATA_DIR can point somewhere else (the tests use a temporary folder).
  DATA_DIR: process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data'),
};
