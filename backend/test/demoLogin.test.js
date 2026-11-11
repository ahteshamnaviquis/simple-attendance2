// API tests for the demo quick login (DEMO_LOGIN in .env).
// Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');

// "dat.sara" -> "sara": the server gives every username its academy's prefix.
const withoutPrefix = (username) => username.replace(/^[a-z]{3}\./, '');

const START_DATA = {
  users: [
    { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
    { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher', disabled: true },
  ],
};

async function call(baseUrl, method, url, body) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

// Each case starts its own server with DEMO_LOGIN set as given. testServer.js
// and the store read the environment when first loaded, so they are loaded
// fresh for each case.
async function withServer(env, fn) {
  const saved = { DEMO_LOGIN: process.env.DEMO_LOGIN, DEMO_LOGIN_USERS: process.env.DEMO_LOGIN_USERS };
  Object.assign(process.env, env);
  for (const file of ['./testServer', '../store', '../config']) delete require.cache[require.resolve(file)];
  const { startServer, stopServer } = require('./testServer');
  try {
    await fn(await startServer(START_DATA));
  } finally {
    await stopServer();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('demo login on: lists active users without passwords and logs in', async () => {
  await withServer({ DEMO_LOGIN: 'true', DEMO_LOGIN_USERS: '' }, async (baseUrl) => {
    const list = await call(baseUrl, 'GET', '/api/demo-login');
    assert.equal(list.status, 200);
    assert.equal(list.body.enabled, true);
    assert.deepEqual(list.body.users.map((u) => withoutPrefix(u.username)), ['superadmin', 'admin', 'sara']);
    assert.ok(list.body.users.every((u) => !('password' in u)));

    const login = await call(baseUrl, 'POST', '/api/demo-login', { userId: 'u1' });
    assert.equal(login.status, 200);
    assert.equal(withoutPrefix(login.body.username), 'admin');
    assert.equal(login.body.password, undefined);

    const disabled = await call(baseUrl, 'POST', '/api/demo-login', { userId: 'u3' });
    assert.equal(disabled.status, 404);
  });
});

test('demo login limited to DEMO_LOGIN_USERS', async () => {
  await withServer({ DEMO_LOGIN: 'true', DEMO_LOGIN_USERS: 'admin, sara' }, async (baseUrl) => {
    const list = await call(baseUrl, 'GET', '/api/demo-login');
    assert.deepEqual(list.body.users.map((u) => withoutPrefix(u.username)), ['admin', 'sara']);
    const other = await call(baseUrl, 'POST', '/api/demo-login', { userId: 'u0' });
    assert.equal(other.status, 404);
  });
});

test('demo login off: no users and passwordless login refused', async () => {
  await withServer({ DEMO_LOGIN: 'false', DEMO_LOGIN_USERS: '' }, async (baseUrl) => {
    const list = await call(baseUrl, 'GET', '/api/demo-login');
    assert.deepEqual(list.body, { enabled: false, users: [] });
    const login = await call(baseUrl, 'POST', '/api/demo-login', { userId: 'u1' });
    assert.equal(login.status, 403);
  });
});
