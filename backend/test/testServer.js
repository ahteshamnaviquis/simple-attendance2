// Starts the real server for an API test file, with a temporary MySQL database
// of its own: the tables from sql/schema.sql, filled with the test's starting
// data. The database is removed again when the tests finish, so the real
// database is never touched.
//
// The MySQL server comes from backend/.env or the environment (DB_HOST,
// DB_PORT, DB_USER, DB_PASSWORD, or DATABASE_URL); the user needs permission
// to create and drop databases.

const { spawn } = require('node:child_process');
const path = require('node:path');

// Always use a new database name, even when DATABASE_URL names one.
const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
if (url) {
  const u = new URL(url);
  Object.assign(process.env, {
    DB_HOST: u.hostname,
    DB_PORT: u.port || '3306',
    DB_USER: decodeURIComponent(u.username),
    DB_PASSWORD: decodeURIComponent(u.password),
  });
  delete process.env.DATABASE_URL;
  delete process.env.MYSQL_URL;
}
process.env.DB_NAME = `attendance_test_${process.pid}_${Date.now()}`;

const store = require('../store');

let server;

// startData: { users: [...], classes: [...], ..., settings: {...} } (all optional).
// Returns the server's base URL, such as http://127.0.0.1:23456.
async function startServer(startData) {
  await store.initDatabase(null); // creates the database and empty tables
  await store.importData(startData);

  const port = 20000 + Math.floor(Math.random() * 20000);
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), RAILWAY_ENVIRONMENT: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.on('exit', (code) => reject(new Error(`Server stopped (${code})`)));
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('API running')) resolve();
    });
  });
  return `http://127.0.0.1:${port}`;
}

async function stopServer() {
  server?.kill();
  try {
    await store.dropDatabase();
  } finally {
    await store.closeDatabase();
  }
}

module.exports = {
  startServer,
  stopServer,
  readTable: (name) => store.readData(name), // what is saved now, e.g. readTable('marks')
  readFile: (name) => store.readFile(name), // an uploaded file, or null
};
