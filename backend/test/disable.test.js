// API tests for disabling and removing teachers and examinations (super admin).
// Run with: npm test
//
// Starts the real server on a spare port with a temporary data folder.

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SUPER = 'u0';
const ADMIN = 'u1';
const SARA = 'u2';
const ALI = 'u3';

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

function readFile(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
}

const exam = (id, name) => ({
  id,
  name,
  classId: 'c1',
  className: 'Grade 9',
  date: '2026-10-01',
  remarks: '',
  subjects: [{ subjectId: 's1', subjectName: 'Maths', maxMarks: 100, passMarks: 33 }],
  status: 'open',
  createdBy: 'Super Admin',
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedBy: 'Super Admin',
  updatedAt: '2026-10-01T00:00:00.000Z',
});

const START_DATA = {
  users: [
    { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
    { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
  ],
  classes: [{ id: 'c1', name: 'Grade 9', teacherId: 'u2' }],
  students: [{ id: 'st1', rollNumber: '1', name: 'Ahmed', classId: 'c1', guardianName: '', phone: '' }],
  attendance: [],
  subjects: [{ id: 's1', name: 'Maths' }],
  classSubjects: [{ id: 'cs1', classId: 'c1', subjectId: 's1', teacherId: 'u2' }],
  exams: [exam('e1', 'Mid term'), exam('e2', 'Final')],
  marks: [
    { id: 'm1', examId: 'e2', subjectId: 's1', studentId: 'st1', obtained: 70, absent: false, remarks: '' },
  ],
};

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disable-test-'));
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

test('only the super admin disables and removes teachers', async () => {
  assert.equal((await api(ADMIN, 'POST', `/api/teachers/${SARA}/disable`)).status, 403);
  assert.equal((await api(SARA, 'POST', `/api/teachers/${ALI}/disable`)).status, 403);
  assert.equal((await api(ADMIN, 'DELETE', `/api/teachers/${ALI}`)).status, 403);
  // Admins and the super admin are not teachers here.
  assert.equal((await api(SUPER, 'POST', `/api/teachers/${ADMIN}/disable`)).status, 404);
  assert.equal((await api(SUPER, 'DELETE', `/api/teachers/${SUPER}`)).status, 404);
});

test('a disabled teacher cannot log in or use the API until enabled', async () => {
  const disabled = await api(SUPER, 'POST', `/api/teachers/${SARA}/disable`);
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.disabled, true);
  assert.equal(disabled.body.password, undefined);

  const login = await api(null, 'POST', '/api/login', { username: 'sara', password: 'teacher123' });
  assert.equal(login.status, 403);
  assert.match(login.body.error, /disabled/);
  assert.equal((await api(SARA, 'GET', '/api/classes')).status, 401);

  // Classes stay assigned while disabled.
  assert.equal(readFile('classes')[0].teacherId, SARA);

  assert.equal((await api(SUPER, 'POST', `/api/teachers/${SARA}/enable`)).status, 200);
  assert.equal((await api(null, 'POST', '/api/login', { username: 'sara', password: 'teacher123' })).status, 200);
  assert.equal((await api(SARA, 'GET', '/api/classes')).status, 200);
});

test('a disabled exam is hidden from its teacher until enabled', async () => {
  assert.equal((await api(ADMIN, 'POST', '/api/exams/e1/disable')).status, 403);

  const disabled = await api(SUPER, 'POST', '/api/exams/e1/disable');
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.disabled, true);

  const mine = await api(SARA, 'GET', '/api/exams/my-subjects');
  assert.deepEqual(mine.body.map((r) => r.examId), ['e2']);
  assert.equal((await api(SARA, 'GET', '/api/exams/e1')).status, 403);
  assert.equal((await api(SARA, 'GET', '/api/exams/e1/marks?subjectId=s1')).status, 403);
  // The super admin still sees it.
  const all = await api(SUPER, 'GET', '/api/exams');
  assert.equal(all.body.find((e) => e.id === 'e1').disabled, true);

  assert.equal((await api(SUPER, 'POST', '/api/exams/e1/enable')).status, 200);
  assert.equal((await api(SARA, 'GET', '/api/exams/e1')).status, 200);
});

test('the super admin removes an exam that has marks, with its marks', async () => {
  assert.equal((await api(SARA, 'DELETE', '/api/exams/e2')).status, 403);
  assert.equal((await api(SUPER, 'DELETE', '/api/exams/e2')).status, 200);
  assert.deepEqual(readFile('exams').map((e) => e.id), ['e1']);
  assert.equal(readFile('marks').length, 0);
});

test('removing a teacher unassigns their classes and subjects', async () => {
  assert.equal((await api(SUPER, 'DELETE', `/api/teachers/${SARA}`)).status, 204);
  assert.equal((await api(null, 'POST', '/api/login', { username: 'sara', password: 'teacher123' })).status, 401);
  assert.equal(readFile('classes')[0].teacherId, null);
  assert.equal(readFile('classSubjects')[0].teacherId, null);
  assert.ok(readFile('users').some((u) => u.id === ALI));
});
