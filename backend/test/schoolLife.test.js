// API tests for the diary, leaves, complaints & suggestions and the gallery. Run with: npm test
//
// Starts the real server on a spare port with a temporary MySQL database (see testServer.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, readTable, readFile, tokenFor } = require('./testServer');

const ADMIN = 'u1';
const SARA = 'u2'; // class teacher of Grade 9 (c1), teaches English there
const ALI = 'u3'; // class teacher of Grade 10 (c2), teaches Mathematics in Grade 9
const PARENT = 'p1'; // Ahmed's parent (Grade 9)
const OTHER_PARENT = 'p2'; // Bilal's parent (Grade 10)

let baseUrl;

async function api(userId, method, url, body, contentType) {
  const raw = Buffer.isBuffer(body);
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': contentType || 'application/json', ...(userId && { Authorization: `Bearer ${await tokenFor(userId)}` }) },
    body: raw ? body : body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

function daysFromToday(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const user = (id, name, role) => ({ id, name, username: id, password: 'x', role });

test.before(async () => {
  baseUrl = await startServer({
    users: [
      user('u0', 'Super Admin', 'superadmin'),
      user(ADMIN, 'Office Admin', 'admin'),
      user(SARA, 'Sara Khan', 'teacher'),
      user(ALI, 'Ali Raza', 'teacher'),
      user(PARENT, 'Hassan Ali', 'parent'),
      user(OTHER_PARENT, 'Imran Shah', 'parent'),
    ],
    classes: [
      { id: 'c1', name: 'Grade 9', teacherId: SARA },
      { id: 'c2', name: 'Grade 10', teacherId: ALI },
    ],
    subjects: [
      { id: 'sub1', name: 'English' },
      { id: 'sub2', name: 'Mathematics' },
    ],
    students: [
      { id: 's1', rollNumber: '1', name: 'Ahmed Hassan', gender: 'male', classId: 'c1', guardianName: '', phone: '' },
      { id: 's2', rollNumber: '1', name: 'Bilal Shah', gender: 'male', classId: 'c2', guardianName: '', phone: '' },
    ],
    classSubjects: [
      { id: 'cs1', classId: 'c1', subjectId: 'sub1', teacherId: SARA },
      { id: 'cs2', classId: 'c1', subjectId: 'sub2', teacherId: ALI },
      { id: 'cs3', classId: 'c2', subjectId: 'sub2', teacherId: ALI },
    ],
    parentProfiles: [
      { id: PARENT, relation: 'Father', phone: '1', altPhone: '', email: '', cnic: '', occupation: '', address: '' },
      { id: OTHER_PARENT, relation: 'Father', phone: '2', altPhone: '', email: '', cnic: '', occupation: '', address: '' },
    ],
    parentStudents: [
      { id: 'l1', parentId: PARENT, studentId: 's1' },
      { id: 'l2', parentId: OTHER_PARENT, studentId: 's2' },
    ],
  });
});

test.after(stopServer);

test('diary: who can write what, and who reads it', async () => {
  const today = daysFromToday(0);

  // Ali teaches only Mathematics in Grade 9: no general entry, no English.
  assert.equal((await api(ALI, 'POST', '/api/diary', { classId: 'c1', date: today, body: 'Read' })).status, 400);
  assert.equal(
    (await api(ALI, 'POST', '/api/diary', { classId: 'c1', subjectId: 'sub1', date: today, body: 'Read' })).status,
    403
  );
  const math = await api(ALI, 'POST', '/api/diary', {
    classId: 'c1', subjectId: 'sub2', date: today, title: 'Homework', body: 'Exercise 4.1',
  });
  assert.equal(math.status, 201);
  assert.equal(math.body.subjectName, 'Mathematics');

  // Sara is Grade 9's class teacher: a general note is fine, Grade 10 is not.
  assert.equal((await api(SARA, 'POST', '/api/diary', { classId: 'c1', date: today, body: 'Bring art supplies' })).status, 201);
  assert.equal((await api(SARA, 'POST', '/api/diary', { classId: 'c2', date: today, body: 'x' })).status, 403);

  const options = await api(ALI, 'GET', '/api/diary/options');
  assert.deepEqual(
    options.body.map((o) => [o.className, o.general, o.subjects.map((s) => s.subjectName)]),
    [['Grade 10', true, ['Mathematics']], ['Grade 9', false, ['Mathematics']]]
  );

  // Parents see their child's class only.
  const ahmed = await api(PARENT, 'GET', '/api/diary?studentId=s1');
  assert.equal(ahmed.body.entries.length, 2);
  assert.equal((await api(OTHER_PARENT, 'GET', '/api/diary')).body.entries.length, 0);
  assert.equal((await api(OTHER_PARENT, 'GET', '/api/diary?studentId=s1')).status, 403);
  assert.equal((await api(PARENT, 'POST', '/api/diary', { classId: 'c1', date: today, body: 'x' })).status, 403);

  // Only the writer (or the office) changes an entry.
  assert.equal((await api(SARA, 'PUT', `/api/diary/${math.body.id}`, { ...math.body, body: 'x' })).status, 403);
  const edited = await api(ADMIN, 'PUT', `/api/diary/${math.body.id}`, { ...math.body, body: 'Exercise 4.2' });
  assert.equal(edited.body.body, 'Exercise 4.2');
  assert.equal((await api(ALI, 'DELETE', `/api/diary/${math.body.id}`)).status, 200);
  assert.equal((await readTable('diary')).length, 1);
});

test('leaves: a parent applies, the class teacher decides', async () => {
  const from = daysFromToday(1);
  const to = daysFromToday(3);
  assert.equal((await api(PARENT, 'POST', '/api/leaves', { studentId: 's2', fromDate: from, toDate: to, reason: 'x' })).status, 403);
  assert.equal((await api(PARENT, 'POST', '/api/leaves', { studentId: 's1', fromDate: to, toDate: from, reason: 'x' })).status, 400);
  assert.equal((await api(SARA, 'POST', '/api/leaves', { studentId: 's1', fromDate: from, toDate: to, reason: 'x' })).status, 403);

  const leave = await api(PARENT, 'POST', '/api/leaves', { studentId: 's1', fromDate: from, toDate: to, reason: 'Wedding' });
  assert.equal(leave.status, 201);
  assert.equal(leave.body.className, 'Grade 9');
  // Overlapping dates are refused.
  assert.equal((await api(PARENT, 'POST', '/api/leaves', { studentId: 's1', fromDate: to, toDate: to, reason: 'x' })).status, 409);

  assert.equal((await api(SARA, 'GET', '/api/leaves/pending-count')).body.count, 1);
  assert.equal((await api(ALI, 'GET', '/api/leaves/pending-count')).body.count, 0); // not Grade 9's class teacher
  assert.equal((await api(ALI, 'POST', `/api/leaves/${leave.body.id}/review`, { status: 'approved' })).status, 403);
  assert.equal((await api(OTHER_PARENT, 'GET', '/api/leaves')).body.length, 0);

  const approved = await api(SARA, 'POST', `/api/leaves/${leave.body.id}/review`, { status: 'approved', note: 'OK' });
  assert.equal(approved.body.status, 'approved');
  assert.equal(approved.body.reviewedBy, 'Sara Khan');
  const mine = await api(PARENT, 'GET', '/api/leaves');
  assert.equal(mine.body[0].days, 3);
  // Only a pending application can be withdrawn.
  assert.equal((await api(PARENT, 'DELETE', `/api/leaves/${leave.body.id}`)).status, 400);
});

test('complaints and suggestions go to the office only', async () => {
  const item = await api(PARENT, 'POST', '/api/feedback', {
    kind: 'complaint', subject: 'Bus late', body: 'The bus was late twice', studentId: 's1',
  });
  assert.equal(item.status, 201);
  assert.equal(item.body.studentName, 'Ahmed Hassan');
  assert.equal((await api(PARENT, 'POST', '/api/feedback', { kind: 'other', subject: 'a', body: 'b' })).status, 400);
  assert.equal((await api(SARA, 'POST', '/api/feedback', { kind: 'suggestion', subject: 'Library', body: 'More books' })).status, 201);
  assert.equal((await api(ADMIN, 'POST', '/api/feedback', { kind: 'suggestion', subject: 'a', body: 'b' })).status, 403);

  assert.equal((await api(SARA, 'GET', '/api/feedback')).body.length, 1);
  assert.equal((await api(ADMIN, 'GET', '/api/feedback')).body.length, 2);
  assert.equal((await api(ADMIN, 'GET', '/api/feedback/open-count')).body.count, 2);
  assert.equal((await api(SARA, 'POST', `/api/feedback/${item.body.id}/reply`, { reply: 'x' })).status, 403);

  const replied = await api(ADMIN, 'POST', `/api/feedback/${item.body.id}/reply`, { reply: 'We spoke to the driver', status: 'resolved' });
  assert.equal(replied.body.repliedBy, 'Office Admin');
  assert.equal((await api(PARENT, 'GET', '/api/feedback')).body[0].reply, 'We spoke to the driver');
  assert.equal((await api(PARENT, 'DELETE', `/api/feedback/${item.body.id}`)).status, 400);
});

test('gallery: albums, photos and who sees them', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex');

  const school = await api(ADMIN, 'POST', '/api/gallery/albums', { title: 'Sports day', classId: '' });
  assert.equal(school.status, 201);
  assert.equal((await api(SARA, 'POST', '/api/gallery/albums', { title: 'Trip', classId: '' })).status, 403);
  assert.equal((await api(SARA, 'POST', '/api/gallery/albums', { title: 'Trip', classId: 'c2' })).status, 403);
  const trip = await api(SARA, 'POST', '/api/gallery/albums', { title: 'Grade 9 trip', classId: 'c1' });
  assert.equal(trip.status, 201);
  assert.equal((await api(PARENT, 'POST', '/api/gallery/albums', { title: 'x' })).status, 403);

  const photo = await api(SARA, 'POST', `/api/gallery/albums/${trip.body.id}/photos`, png, 'image/png');
  assert.equal(photo.status, 201);
  assert.equal((await api(SARA, 'POST', `/api/gallery/albums/${trip.body.id}/photos`, Buffer.from('nope'), 'image/png')).status, 400);
  assert.equal((await api(SARA, 'POST', `/api/gallery/albums/${school.body.id}/photos`, png, 'image/png')).status, 403);

  // Grade 9's parent sees both albums; Grade 10's parent only the school one.
  assert.equal((await api(PARENT, 'GET', '/api/gallery/albums')).body.length, 2);
  const other = await api(OTHER_PARENT, 'GET', '/api/gallery/albums');
  assert.deepEqual(other.body.map((a) => a.title), ['Sports day']);
  assert.equal((await api(OTHER_PARENT, 'GET', `/api/gallery/albums/${trip.body.id}`)).status, 404);

  const image = await fetch(`${baseUrl}/api/gallery/photos/${photo.body.id}/image`);
  assert.equal(image.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);

  // Removing the album removes its photos and their images.
  assert.equal((await api(ADMIN, 'DELETE', `/api/gallery/albums/${trip.body.id}`)).status, 200);
  assert.equal((await readTable('galleryPhotos')).length, 0);
  assert.equal(await readFile(`gallery-${photo.body.id}`), null);
});
