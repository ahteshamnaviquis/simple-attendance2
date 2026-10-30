// API tests for the super admin and admin accounts. Run with: npm test
//
// Starts the real server on a spare port with a temporary MySQL database (see
// testServer.js) that has no super admin yet, so the server must add the starting one (u0, "superadmin").

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer } = require('./testServer');

const SUPER = 'u0';
const ADMIN = 'u1';
const SARA = 'u2';

let baseUrl;

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
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
  ],
  classes: [],
  students: [],
  attendance: [],
  subjects: [],
  classSubjects: [],
  exams: [],
  marks: [],
};

test.before(async () => {
  baseUrl = await startServer(START_DATA);
});

test.after(stopServer);

test('the server adds the starting super admin, who can log in', async () => {
  const res = await api(null, 'POST', '/api/login', { username: 'superadmin', password: 'super123' });
  assert.equal(res.status, 200);
  assert.equal(res.body.id, SUPER);
  assert.equal(res.body.role, 'superadmin');
});

test('only the super admin manages admins', async () => {
  assert.equal((await api(ADMIN, 'GET', '/api/admins')).status, 403);
  assert.equal((await api(SARA, 'GET', '/api/admins')).status, 403);
  assert.equal((await api(ADMIN, 'POST', '/api/admins', { name: 'X', username: 'x', password: 'p' })).status, 403);

  const list = await api(SUPER, 'GET', '/api/admins');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((a) => a.id), [ADMIN]);
  assert.equal(list.body[0].password, undefined);
});

test('super admin adds, edits and removes an admin', async () => {
  const taken = await api(SUPER, 'POST', '/api/admins', { name: 'Copy', username: 'sara', password: 'p' });
  assert.equal(taken.status, 409);
  assert.equal((await api(SUPER, 'POST', '/api/admins', { name: 'No Pass', username: 'np' })).status, 400);

  const created = await api(SUPER, 'POST', '/api/admins', { name: 'Exam Office', username: 'Exams', password: 'exam123' });
  assert.equal(created.status, 201);
  assert.equal(created.body.role, 'admin');
  assert.equal(created.body.username, 'exams');
  const id = created.body.id;

  // The new admin can do admin work (subjects, classes), but not teachers or exams.
  assert.equal((await api(id, 'POST', '/api/subjects', { name: 'English' })).status, 201);
  assert.equal((await api(id, 'POST', '/api/classes', { name: 'Grade 1' })).status, 201);
  assert.equal((await api(id, 'POST', '/api/teachers', { name: 'Ali', username: 'ali', password: 't' })).status, 403);
  assert.equal((await api(id, 'GET', '/api/exams')).status, 403);

  // Blank password keeps the old one.
  const edited = await api(SUPER, 'PUT', `/api/admins/${id}`, { name: 'Exam Office 2', username: 'exams', password: '' });
  assert.equal(edited.status, 200);
  const login = await api(null, 'POST', '/api/login', { username: 'exams', password: 'exam123' });
  assert.equal(login.body.name, 'Exam Office 2');

  // Teachers and the super admin are not admins here.
  assert.equal((await api(SUPER, 'PUT', `/api/admins/${SARA}`, { name: 'S', username: 'sara' })).status, 404);
  assert.equal((await api(SUPER, 'DELETE', `/api/admins/${SUPER}`)).status, 404);

  assert.equal((await api(SUPER, 'DELETE', `/api/admins/${id}`)).status, 204);
  assert.equal((await api(null, 'POST', '/api/login', { username: 'exams', password: 'exam123' })).status, 401);
});

test('the super admin handles teachers and exams, and leaves the rest to admins', async () => {
  assert.equal((await api(SUPER, 'POST', '/api/teachers', { name: 'Ali', username: 'ali', password: 't' })).status, 201);
  assert.equal((await api(SUPER, 'GET', '/api/exams')).status, 200);
  assert.equal((await api(SUPER, 'POST', '/api/subjects', { name: 'Urdu' })).status, 403);
  assert.equal((await api(SUPER, 'POST', '/api/classes', { name: 'Grade 2' })).status, 403);
  // It can still read classes and subjects, which the exam form needs.
  assert.equal((await api(SUPER, 'GET', '/api/classes')).status, 200);
  assert.equal((await api(SUPER, 'GET', '/api/subjects')).status, 200);
});
