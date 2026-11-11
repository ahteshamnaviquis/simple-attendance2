// API tests for logging in: hashed passwords, login tokens, logout, and the
// limit on wrong passwords. Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, readTable, defaultPrefix } = require('./testServer');

let baseUrl;
let P; // the academy's username prefix

async function call(method, url, { token, body, headers = {} } = {}) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const login = (username, password) => call('POST', '/api/login', { body: { username, password } });

test.before(async () => {
  baseUrl = await startServer({
    users: [
      { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
      { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
      { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
    ],
  });
  P = await defaultPrefix();
});

test.after(stopServer);

test('passwords are saved hashed, never as typed', async () => {
  const users = await readTable('users');
  assert.ok(users.length >= 3);
  for (const user of users) {
    assert.match(user.password, /^scrypt\$/);
    assert.ok(!user.password.includes('123'));
  }
  // A password set later is hashed too.
  const admin = (await login(`${P}.superadmin`, 'super123')).body;
  const created = await call('POST', '/api/teachers', {
    token: admin.token,
    body: { name: 'New', username: 'new', password: 'plain-pass' },
  });
  assert.equal(created.status, 201);
  const saved = (await readTable('users')).find((u) => u.id === created.body.id);
  assert.match(saved.password, /^scrypt\$/);
  assert.equal((await login(`${P}.new`, 'plain-pass')).status, 200);
});

test('logging in gives a token; requests need it, and a user id alone does nothing', async () => {
  const res = await login(`${P}.sara`, 'teacher123');
  assert.equal(res.status, 200);
  assert.equal(res.body.id, 'u2');
  assert.equal(res.body.password, undefined);
  assert.ok(res.body.token.length >= 40);

  assert.equal((await call('GET', '/api/classes', { token: res.body.token })).status, 200);
  assert.equal((await call('GET', '/api/classes')).status, 401);
  assert.equal((await call('GET', '/api/classes', { headers: { 'X-User-Id': 'u0' } })).status, 401);
  assert.equal((await call('GET', '/api/classes', { token: 'made-up-token' })).status, 401);
  assert.equal((await login(`${P}.sara`, 'wrong')).status, 401);
});

test('logging out ends that session only', async () => {
  const first = (await login(`${P}.ali`, 'teacher123')).body.token;
  const second = (await login(`${P}.ali`, 'teacher123')).body.token;
  assert.equal((await call('POST', '/api/logout', { token: first })).status, 204);
  assert.equal((await call('GET', '/api/classes', { token: first })).status, 401);
  assert.equal((await call('GET', '/api/classes', { token: second })).status, 200);
});

test("changing a user's password logs out their sessions", async () => {
  const sara = (await login(`${P}.sara`, 'teacher123')).body.token;
  const admin = (await login(`${P}.superadmin`, 'super123')).body.token;
  const changed = await call('PUT', '/api/teachers/u2', {
    token: admin,
    body: { name: 'Sara Khan', username: `${P}.sara`, password: 'new-pass' },
  });
  assert.equal(changed.status, 200);
  assert.equal((await call('GET', '/api/classes', { token: sara })).status, 401);
  assert.equal((await login(`${P}.sara`, 'teacher123')).status, 401);
  assert.equal((await login(`${P}.sara`, 'new-pass')).status, 200);

  // Saving without a new password keeps the sessions.
  const again = (await login(`${P}.sara`, 'new-pass')).body.token;
  await call('PUT', '/api/teachers/u2', { token: admin, body: { name: 'Sara K', username: `${P}.sara`, password: '' } });
  assert.equal((await call('GET', '/api/classes', { token: again })).status, 200);
});

test('too many wrong passwords block that login for a while', async () => {
  for (let i = 0; i < 10; i++) assert.equal((await login(`${P}.ali`, `wrong${i}`)).status, 401);
  const blocked = await login(`${P}.ali`, 'teacher123'); // even the right password
  assert.equal(blocked.status, 429);
  assert.match(blocked.body.error, /Too many wrong passwords/);
  assert.equal((await login(`${P}.superadmin`, 'super123')).status, 200); // other users are not affected
});
