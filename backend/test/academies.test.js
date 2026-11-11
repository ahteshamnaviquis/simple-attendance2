// API tests for several academies and the platform owner. Run with: npm test
//
// The start data is the first academy ("default"). The server adds the
// platform owner ("owner" / "owner123"), who adds a second academy here; the
// two academies must never see or change each other's data.

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

async function login(username, password) {
  return api(null, 'POST', '/api/login', { username, password });
}

const START_DATA = {
  users: [
    { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
  ],
  classes: [{ id: 'c1', name: 'Grade 9', teacherId: 'u2' }],
  students: [{ id: 's1', rollNumber: '1', name: 'Ahmed Hassan', classId: 'c1', guardianName: '', phone: '' }],
  subjects: [{ id: 'sub1', name: 'English' }],
  settings: {
    theme: { schoolName: 'First School' },
    adminPermissions: { students: true, classes: true, subjects: true, teachers: false, exams: false, parents: true },
  },
};

let owner; // the platform owner's id
let second; // the second academy
let secondSuper; // its super admin's id

test.before(async () => {
  baseUrl = await startServer(START_DATA);
});

test.after(stopServer);

test('the server adds the platform owner, who logs in and sees the first academy', async () => {
  const res = await login('owner', 'owner123');
  assert.equal(res.status, 200);
  assert.equal(res.body.role, 'owner');
  assert.equal(res.body.password, undefined);
  owner = res.body.id;

  const list = await api(owner, 'GET', '/api/platform/academies');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, 'default');
  assert.equal(list.body[0].name, 'First School'); // named after its school name
  assert.equal(list.body[0].prefix, 'fsc'); // a username prefix from its name
  assert.deepEqual(list.body[0].counts, { admins: 1, teachers: 1, parents: 0, classes: 1, students: 1 });
  assert.deepEqual(list.body[0].superAdmins.map((u) => u.username), ['fsc.superadmin']);
});

test('only the platform owner may use the platform pages, and they see no academy data', async () => {
  for (const user of [null, SUPER, ADMIN, SARA]) {
    const res = await api(user, 'GET', '/api/platform/academies');
    assert.equal(res.status, user ? 403 : 401);
  }
  assert.equal((await api(owner, 'GET', '/api/teachers')).status, 403);
  assert.equal((await api(owner, 'GET', '/api/students')).status, 403);
});

test('the owner adds an academy with its super admin and username prefix', async () => {
  const usedPrefix = await api(owner, 'POST', '/api/platform/academies', {
    name: 'Second School',
    prefix: 'FSC',
    superAdmin: { name: 'Bushra', username: 'bushra', password: 'x' },
  });
  assert.equal(usedPrefix.status, 409);
  assert.match(usedPrefix.body.error, /FSC is already used by First School/);
  for (const prefix of ['ab', 'abcd', 'a1c']) {
    const bad = await api(owner, 'POST', '/api/platform/academies', {
      name: 'Second School',
      prefix,
      superAdmin: { name: 'Bushra', username: 'bushra', password: 'x' },
    });
    assert.equal(bad.status, 400, prefix);
  }

  const missing = await api(owner, 'POST', '/api/platform/academies', { name: 'Second School', superAdmin: {} });
  assert.equal(missing.status, 400);

  const res = await api(owner, 'POST', '/api/platform/academies', {
    name: 'Second School',
    superAdmin: { name: 'Bushra Iqbal', username: 'bushra', password: 'pass1' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.prefix, 'ssc'); // left out: made from the name
  assert.equal(res.body.superAdmins[0].username, 'ssc.bushra');
  second = res.body;
  secondSuper = res.body.superAdmins[0].id;

  const again = await api(owner, 'POST', '/api/platform/academies', {
    name: 'second school',
    superAdmin: { name: 'X', username: 'someone', password: 'x' },
  });
  assert.equal(again.status, 409); // the same name

  assert.equal((await login('bushra', 'pass1')).status, 401); // the prefix is part of the username
  const me = await login('ssc.bushra', 'pass1');
  assert.equal(me.status, 200);
  assert.equal(me.body.role, 'superadmin');
  assert.equal(me.body.academyId, second.id);
});

test("a new academy starts empty, with its own settings", async () => {
  for (const url of ['/api/teachers', '/api/classes', '/api/students', '/api/subjects', '/api/admins', '/api/attendance']) {
    const res = await api(secondSuper, 'GET', url);
    assert.equal(res.status, 200, url);
    assert.deepEqual(res.body, [], url);
  }
  const settings = await api(secondSuper, 'GET', '/api/settings');
  assert.equal(settings.body.theme.schoolName, 'Second School');
  assert.equal(settings.body.academyId, second.id);

  const first = await api(SUPER, 'GET', '/api/settings');
  assert.equal(first.body.theme.schoolName, 'First School');

  // Before login: the academy asked for, otherwise the first one.
  assert.equal((await api(null, 'GET', `/api/settings?academy=${second.id}`)).body.theme.schoolName, 'Second School');
  assert.equal((await api(null, 'GET', '/api/settings')).body.theme.schoolName, 'First School');
});

test("what an academy's super admin adds belongs to that academy only", async () => {
  const teacher = await api(secondSuper, 'POST', '/api/teachers', { name: 'Tariq', username: 'tariq', password: 't1' });
  assert.equal(teacher.status, 201);
  const admin = await api(secondSuper, 'POST', '/api/admins', { name: 'Office', username: 'office2', password: 'o' });
  assert.equal(admin.status, 201);
  // Classes and subjects are the admins' (with the default permissions).
  const cls = await api(admin.body.id, 'POST', '/api/classes', { name: 'Grade 9', teacherId: teacher.body.id });
  assert.equal(cls.status, 201); // the same class name as the first academy's is fine
  const subject = await api(admin.body.id, 'POST', '/api/subjects', { name: 'English' });
  assert.equal(subject.status, 201); // so is the same subject name

  // Every username made here starts with the academy's prefix, typed or not.
  assert.equal(teacher.body.username, 'ssc.tariq');
  assert.equal(admin.body.username, 'ssc.office2');
  const typed = await api(secondSuper, 'PUT', `/api/teachers/${teacher.body.id}`, { name: 'Tariq', username: 'ssc.tariq.k' });
  assert.equal(typed.body.username, 'ssc.tariq.k'); // not doubled
  const clash = await api(secondSuper, 'POST', '/api/teachers', { name: 'Other', username: 'tariq.k', password: 'x' });
  assert.equal(clash.status, 409);
  // A super admin can't choose another prefix: it is added in front.
  const other = await api(secondSuper, 'POST', '/api/admins', { name: 'X', username: 'fsc.x', password: 'x' });
  assert.equal(other.body.username, 'ssc.fsc.x');
  assert.equal((await api(secondSuper, 'DELETE', `/api/admins/${other.body.id}`)).status, 204);

  // The first academy sees none of it...
  assert.deepEqual((await api(SUPER, 'GET', '/api/teachers')).body.map((t) => t.username), ['fsc.sara']);
  assert.deepEqual((await api(SUPER, 'GET', '/api/classes')).body.map((c) => c.id), ['c1']);
  assert.deepEqual((await api(SUPER, 'GET', '/api/admins')).body.map((a) => a.username), ['fsc.admin']);
  assert.deepEqual((await api(ADMIN, 'GET', '/api/subjects')).body.map((s) => s.id), ['sub1']);

  // ...and can't change it, or use the other academy's teacher.
  assert.equal((await api(ADMIN, 'PUT', `/api/classes/${cls.body.id}`, { name: 'Taken', teacherId: '' })).status, 404);
  assert.equal((await api(SUPER, 'PUT', `/api/teachers/${teacher.body.id}`, { name: 'X', username: 'x' })).status, 404);
  const borrow = await api(ADMIN, 'PUT', '/api/classes/c1', { name: 'Grade 9', teacherId: teacher.body.id });
  assert.equal(borrow.status, 400);

  // The new academy doesn't see the first one's either.
  assert.equal((await api(admin.body.id, 'PUT', '/api/classes/c1', { name: 'Mine', teacherId: '' })).status, 404);
  assert.deepEqual((await api(secondSuper, 'GET', '/api/students')).body, []);

  const list = await api(owner, 'GET', '/api/platform/academies');
  const counts = Object.fromEntries(list.body.map((a) => [a.id, a.counts]));
  assert.deepEqual(counts[second.id], { admins: 1, teachers: 1, parents: 0, classes: 1, students: 0 });
  assert.deepEqual(counts.default, { admins: 1, teachers: 1, parents: 0, classes: 1, students: 1 });
});

test("each academy's settings are saved separately", async () => {
  const current = (await api(secondSuper, 'GET', '/api/settings')).body;
  const saved = await api(secondSuper, 'PUT', '/api/settings', {
    theme: { ...current.theme, schoolName: 'Second Academy' },
    adminPermissions: current.adminPermissions,
  });
  assert.equal(saved.status, 200);
  assert.equal((await api(secondSuper, 'GET', '/api/settings')).body.theme.schoolName, 'Second Academy');
  assert.equal((await api(SUPER, 'GET', '/api/settings')).body.theme.schoolName, 'First School');
});

test('the owner manages super admins; an academy keeps at least one', async () => {
  const added = await api(owner, 'POST', `/api/platform/academies/${second.id}/super-admins`, {
    name: 'Second Head',
    username: 'head2',
    password: 'h2',
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.username, 'ssc.head2');
  assert.equal((await login('ssc.head2', 'h2')).body.academyId, second.id);

  const renamed = await api(owner, 'PUT', `/api/platform/super-admins/${added.body.id}`, {
    name: 'Second Head',
    username: 'head-two',
    password: '',
  });
  assert.equal(renamed.status, 200);
  assert.equal((await login('ssc.head-two', 'h2')).status, 200); // the password was kept

  assert.equal((await api(owner, 'DELETE', `/api/platform/super-admins/${added.body.id}`)).status, 204);
  const last = await api(owner, 'DELETE', `/api/platform/super-admins/${secondSuper}`);
  assert.equal(last.status, 400);
  // Not someone else's account.
  assert.equal((await api(owner, 'DELETE', `/api/platform/super-admins/${ADMIN}`)).status, 404);
});

test("a disabled academy's users can't log in, and are logged out", async () => {
  assert.equal((await api(owner, 'POST', `/api/platform/academies/${second.id}/disable`)).status, 200);
  assert.equal((await login('ssc.bushra', 'pass1')).status, 403);
  assert.equal((await api(secondSuper, 'GET', '/api/teachers')).status, 401);
  assert.equal((await login('fsc.superadmin', 'super123')).status, 200); // the other academy works

  assert.equal((await api(owner, 'POST', `/api/platform/academies/${second.id}/enable`)).status, 200);
  assert.equal((await login('ssc.bushra', 'pass1')).status, 200);

  // Renaming keeps the prefix: the usernames start with it.
  const renamed = await api(owner, 'PUT', `/api/platform/academies/${second.id}`, { name: 'Renamed School', prefix: 'ren' });
  assert.equal(renamed.body.name, 'Renamed School');
  assert.equal(renamed.body.prefix, 'ssc');
});
