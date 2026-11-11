// API tests for serving the API under a path (BASE_PATH) and for CORS. Run with: npm test
//
// Starts the real server with BASE_PATH=/att and a temporary MySQL database (see testServer.js).

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BASE_PATH = '/att/';
process.env.FRONTEND_URL = 'https://school.example.com/att';
const { startServer, stopServer, defaultPrefix } = require('./testServer');

let baseUrl;
let P; // the academy's username prefix: logins are "<P>.sara"

test.before(async () => {
  baseUrl = await startServer({
    users: [{ id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' }],
  });
  P = await defaultPrefix();
});

test.after(stopServer);

test('the API answers under the base path', async () => {
  const res = await fetch(`${baseUrl}/att/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `${P}.admin`, password: 'admin123' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, 'u1');
});

test('the API still answers without the base path', async () => {
  const res = await fetch(`${baseUrl}/api/health`);
  assert.equal(res.status, 200);
});

test('a path that only starts with the same letters is not changed', async () => {
  const res = await fetch(`${baseUrl}/attx/api/health`);
  assert.equal(res.status, 404);
});

test('a frontend address with a path still matches the browser origin', async () => {
  const res = await fetch(`${baseUrl}/att/api/health`, { headers: { Origin: 'https://school.example.com' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://school.example.com');
});
