// Without BASE_PATH, the API still answers when the host passes its folder on
// (for example /att/api/... on cPanel). Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');

delete process.env.BASE_PATH;
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

test('the API answers under a folder without BASE_PATH', async () => {
  const res = await fetch(`${baseUrl}/att/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: `${P}.admin`, password: 'admin123' }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, 'u1');
});

test('the API still answers at the root', async () => {
  assert.equal((await fetch(`${baseUrl}/api/health`)).status, 200);
});

test('only one folder is removed', async () => {
  assert.equal((await fetch(`${baseUrl}/a/b/api/health`)).status, 404);
});
