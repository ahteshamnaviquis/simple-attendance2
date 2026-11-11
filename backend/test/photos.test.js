// API tests for profile photos of teachers, students and parents. Run with: npm test

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, readFile, tokenFor } = require('./testServer');

const SUPER = 'u0';
const ADMIN = 'u1';
const SARA = 'u2';
const ALI = 'u3';
const PARENT = 'p1';

// The smallest real PNG (1 x 1 pixel).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let baseUrl;

async function api(userId, method, url, body, type) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: {
      ...(body && { 'Content-Type': type ?? 'application/json' }),
      ...(userId && { Authorization: `Bearer ${await tokenFor(userId)}` }),
    },
    body: Buffer.isBuffer(body) ? body : body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const upload = (userId, url, image = PNG, type = 'image/png') => api(userId, 'PUT', url, image, type);

test.before(async () => {
  baseUrl = await startServer({
    users: [
      { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
      { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
      { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
      { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
      { id: 'p1', name: 'Hassan Ali', username: 'hassan', password: 'parent123', role: 'parent' },
    ],
    classes: [{ id: 'c1', name: 'Grade 9', teacherId: 'u2' }],
    students: [{ id: 's1', rollNumber: '1', name: 'Ahmed Hassan', classId: 'c1', guardianName: '', phone: '' }],
    parentStudents: [{ id: 'l1', parentId: 'p1', studentId: 's1' }],
  });
});

test.after(stopServer);

test("a teacher's photo is uploaded, served, replaced and removed", async () => {
  assert.equal((await upload(SARA, `/api/teachers/${ALI}/photo`)).status, 403); // teachers can't
  assert.equal((await upload(SUPER, `/api/teachers/${ALI}/photo`, Buffer.from('not an image'))).status, 400);
  assert.equal((await upload(SUPER, `/api/teachers/${SUPER}/photo`)).status, 404); // not a teacher

  const first = await upload(SUPER, `/api/teachers/${ALI}/photo`);
  assert.equal(first.status, 200);
  assert.equal(first.body.photo.type, 'image/png');
  const key = first.body.photo.key;

  const image = await fetch(`${baseUrl}/api/photos/default/${key}`); // works without login, like an <img>
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.ok(Buffer.from(await image.arrayBuffer()).equals(PNG));
  assert.equal((await fetch(`${baseUrl}/api/photos/other-academy/${key}`)).status, 404);

  const list = await api(ADMIN, 'GET', '/api/teachers');
  assert.equal(list.body.find((t) => t.id === ALI).photo.key, key);

  // Editing the teacher keeps the photo.
  const edited = await api(SUPER, 'PUT', `/api/teachers/${ALI}`, { name: 'Ali R', username: 'ali', password: '' });
  assert.equal(edited.body.photo.key, key);

  const second = await upload(SUPER, `/api/teachers/${ALI}/photo`);
  assert.notEqual(second.body.photo.key, key); // a new address for the new picture
  assert.equal(await readFile(`photo-${key}`), null); // the old one is gone

  const removed = await api(SUPER, 'DELETE', `/api/teachers/${ALI}/photo`);
  assert.equal(removed.status, 200);
  assert.equal(removed.body.photo, undefined);
  assert.equal(await readFile(`photo-${second.body.photo.key}`), null);
});

test("a student's photo: the class teacher and admins may change it, parents see it", async () => {
  assert.equal((await upload(ALI, '/api/students/s1/photo')).status, 403); // not Ali's class
  const res = await upload(SARA, '/api/students/s1/photo', PNG, 'image/png');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Ahmed Hassan');
  assert.ok(res.body.photo.key);

  const children = await api(PARENT, 'GET', '/api/parent/children');
  assert.equal(children.body[0].photo.key, res.body.photo.key);

  assert.equal((await api(ADMIN, 'DELETE', '/api/students/s1/photo')).body.photo, undefined);
});

test("a parent's photo is changed on the Parents page", async () => {
  assert.equal((await upload(SARA, `/api/parents/${PARENT}/photo`)).status, 403);
  const res = await upload(ADMIN, `/api/parents/${PARENT}/photo`);
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Hassan Ali');
  const list = await api(ADMIN, 'GET', '/api/parents');
  assert.equal(list.body.find((p) => p.id === PARENT).photo.key, res.body.photo.key);
  assert.equal(list.body[0].password, undefined);
});
