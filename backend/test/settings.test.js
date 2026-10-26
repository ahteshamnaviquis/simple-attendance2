// API tests for the theme and admin permissions (settings.json). Run with: npm test
//
// Starts the real server on a spare port with a temporary data folder that has
// no settings.json yet, so the server must create it with the defaults.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUPER = 'u0';
const ADMIN = 'u1';
const SARA = 'u2';

let server;
let baseUrl;
let dataDir;

async function api(userId, method, url, body) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId && { 'X-User-Id': userId }) },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const START_DATA = {
  users: [
    { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
  ],
  classes: [{ id: 'c1', name: 'Grade 1', teacherId: 'u2' }],
  students: [],
  attendance: [],
  subjects: [],
  classSubjects: [],
  exams: [],
  marks: [],
};

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-test-'));
  for (const [name, data] of Object.entries(START_DATA)) {
    fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data));
  }
  const port = 20000 + Math.floor(Math.random() * 20000);
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, RAILWAY_ENVIRONMENT: '' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    server.on('exit', (code) => reject(new Error(`Server stopped (${code})`)));
    server.stdout.on('data', (chunk) => {
      if (String(chunk).includes('API running')) resolve();
    });
  });
});

test.after(() => {
  server.kill();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

let current;
const withTheme = (changes) => ({ ...current, theme: { ...current.theme, ...changes } });
const withPermissions = (changes) => ({ ...current, adminPermissions: { ...current.adminPermissions, ...changes } });
const save = (user, settings) => api(user, 'PUT', '/api/settings', settings);

test('anyone can read the settings; they start with the defaults', async () => {
  const res = await api(null, 'GET', '/api/settings');
  assert.equal(res.status, 200);
  assert.equal(res.body.theme.schoolName, 'Daily Attendance');
  assert.deepEqual(res.body.adminPermissions, {
    students: true,
    classes: true,
    subjects: true,
    teachers: false,
    exams: false,
  });
  current = res.body;
});

test('only the super admin saves settings', async () => {
  assert.equal((await save(null, current)).status, 401);
  assert.equal((await save(ADMIN, current)).status, 403);
  assert.equal((await save(SARA, current)).status, 403);
  assert.equal((await save(SUPER, current)).status, 200);
});

test('bad settings are rejected and nothing is saved', async () => {
  const bad = [
    withTheme({ schoolName: '  ' }),
    withTheme({ schoolName: 'x'.repeat(41) }),
    withTheme({ accentColor: 'blue' }),
    withTheme({ accentColor: '#ffee88' }), // too light for white text
    withTheme({ sidebarColor: '#f5f6f8' }),
    withTheme({ font: 'Comic Sans MS' }),
    withTheme({ corners: 'wavy' }),
    withPermissions({ exams: 'yes' }),
    { theme: current.theme },
  ];
  for (const settings of bad) {
    const res = await save(SUPER, settings);
    assert.equal(res.status, 400, JSON.stringify(settings));
    assert.ok(res.body.error);
  }
  assert.deepEqual((await api(null, 'GET', '/api/settings')).body, current);
});

test('the super admin changes the theme', async () => {
  const res = await save(SUPER, withTheme({ schoolName: ' Bright Future Academy ', accentColor: '#0B6E4F', font: 'Poppins', corners: 'round' }));
  assert.equal(res.status, 200);
  assert.equal(res.body.theme.schoolName, 'Bright Future Academy');
  assert.equal(res.body.theme.accentColor, '#0b6e4f');
  current = (await api(null, 'GET', '/api/settings')).body;
  assert.equal(current.theme.font, 'Poppins');
});

test('admin permissions decide what admins may manage', async () => {
  // Defaults: students yes, teachers and exams no.
  const student = { rollNumber: '1', name: 'Ahmed', classId: 'c1' };
  assert.equal((await api(ADMIN, 'POST', '/api/students', student)).status, 201);
  assert.equal((await api(ADMIN, 'POST', '/api/teachers', { name: 'A', username: 'a', password: 'p' })).status, 403);
  assert.equal((await api(ADMIN, 'GET', '/api/exams')).status, 403);

  // Hand teachers and exams to admins, take students away.
  await save(SUPER, withPermissions({ teachers: true, exams: true, students: false }));
  assert.equal((await api(ADMIN, 'POST', '/api/teachers', { name: 'A', username: 'a', password: 'p' })).status, 201);
  assert.equal((await api(ADMIN, 'GET', '/api/exams')).status, 200);
  assert.equal((await api(ADMIN, 'POST', '/api/students', { ...student, rollNumber: '2' })).status, 403);
  assert.equal((await api(ADMIN, 'GET', '/api/students')).body.length, 1); // can still read them
  // Teachers still manage their own class's students.
  assert.equal((await api(SARA, 'POST', '/api/students', { ...student, rollNumber: '2' })).status, 201);

  // Classes and subjects off too.
  await save(SUPER, withPermissions({ classes: false, subjects: false }));
  assert.equal((await api(ADMIN, 'POST', '/api/classes', { name: 'Grade 2' })).status, 403);
  assert.equal((await api(ADMIN, 'POST', '/api/subjects', { name: 'Urdu' })).status, 403);

  // The super admin keeps teachers and exams whatever admins are allowed.
  await save(SUPER, withPermissions({ teachers: false, exams: false }));
  assert.equal((await api(SUPER, 'POST', '/api/teachers', { name: 'B', username: 'b', password: 'p' })).status, 201);
  assert.equal((await api(SUPER, 'GET', '/api/exams')).status, 200);
});

test('logo options are checked', async () => {
  for (const changes of [
    { logoSize: 'huge' },
    { logoShape: 'star' },
    { logoBackground: 'pink' },
    { showSchoolName: 'no' },
  ]) {
    assert.equal((await save(SUPER, withTheme(changes))).status, 400, JSON.stringify(changes));
  }
  const res = await save(SUPER, withTheme({ logoSize: 'large', logoShape: 'circle', logoBackground: 'white', showSchoolName: false }));
  assert.equal(res.status, 200);
  assert.equal(res.body.theme.logoShape, 'circle');
  current = res.body;
});

// A real 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

async function uploadLogo(userId, type, body) {
  const response = await fetch(`${baseUrl}/api/settings/logo`, {
    method: 'PUT',
    headers: { 'Content-Type': type, ...(userId && { 'X-User-Id': userId }) },
    body,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

test('only the super admin uploads a logo, and only a real image', async () => {
  assert.equal((await api(null, 'GET', '/api/settings/logo')).status, 404);
  assert.equal((await uploadLogo(ADMIN, 'image/png', PNG)).status, 403);
  assert.equal((await uploadLogo(SUPER, 'image/svg+xml', '<svg/>')).status, 400);
  assert.equal((await uploadLogo(SUPER, 'text/plain', 'hello')).status, 400);
  assert.equal((await uploadLogo(SUPER, 'image/png', Buffer.from('not really a png'))).status, 400);
  assert.equal((await uploadLogo(SUPER, 'image/jpeg', PNG)).status, 400); // type and content disagree
  const tooBig = Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]);
  assert.equal((await uploadLogo(SUPER, 'image/png', tooBig)).status, 413);
  assert.equal((await api(null, 'GET', '/api/settings')).body.theme.logo, null);
});

test('the uploaded logo is served, kept when settings are saved, and can be removed', async () => {
  const res = await uploadLogo(SUPER, 'image/png', PNG);
  assert.equal(res.status, 200);
  assert.equal(res.body.theme.logo.type, 'image/png');
  const version = res.body.theme.logo.version;

  const image = await fetch(`${baseUrl}/api/settings/logo`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(PNG));

  // Saving the form (which has no logo in it) keeps the logo.
  const saved = await save(SUPER, withTheme({ schoolName: 'Logo School' }));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.theme.logo.version, version);

  assert.equal((await api(ADMIN, 'DELETE', '/api/settings/logo')).status, 403);
  const removed = await api(SUPER, 'DELETE', '/api/settings/logo');
  assert.equal(removed.status, 200);
  assert.equal(removed.body.theme.logo, null);
  assert.equal((await api(null, 'GET', '/api/settings/logo')).status, 404);
  assert.ok(!fs.existsSync(path.join(dataDir, 'logo')));
});
