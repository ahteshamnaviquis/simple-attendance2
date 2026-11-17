// API tests for a teacher's own dashboard (/api/teacher-dashboard). Run with: npm test
//
// Starts the real server on a spare port with a temporary MySQL database (see testServer.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer } = require('./testServer');

const SARA = 'u2'; // class teacher of Grade 9 (c1), teaches English there and Mathematics in Grade 10
const ALI = 'u3'; // class teacher of Grade 10 (c2)

let baseUrl;

async function api(userId, url) {
  const response = await fetch(baseUrl + url, { headers: { 'X-User-Id': userId } });
  return { status: response.status, body: await response.json().catch(() => null) };
}

const user = (id, name, role) => ({ id, name, username: id, password: 'x', role });
const student = (id, classId, gender) => ({ id, rollNumber: id, name: id, gender, classId, guardianName: '', phone: '' });
const report = (id, classId, date) => ({
  id, classId, date, className: classId, teacherId: '', teacherName: '', totalStudents: 1, present: 1, absent: 0,
  addedToday: 0, leftToday: 0, absentees: [], createdAt: `${date}T08:00:00.000Z`, createdBy: '',
  updatedAt: `${date}T08:00:00.000Z`, updatedBy: '',
});
const message = (id, parentId, teacherId, fromSchool, readAt) => ({
  id, parentId, teacherId, fromSchool, senderId: fromSchool ? teacherId : parentId, senderName: 'x',
  senderRole: fromSchool ? 'teacher' : 'parent', body: 'Hello', createdAt: '2026-03-01T08:00:00.000Z', readAt,
});

test.before(async () => {
  baseUrl = await startServer({
    users: [
      user('u1', 'Office Admin', 'admin'),
      user(SARA, 'Sara Khan', 'teacher'),
      user(ALI, 'Ali Raza', 'teacher'),
      user('p1', 'Parent One', 'parent'),
      user('p2', 'Parent Two', 'parent'),
    ],
    classes: [
      { id: 'c1', name: 'Grade 9', teacherId: SARA },
      { id: 'c2', name: 'Grade 10', teacherId: ALI },
      { id: 'c3', name: 'Grade 8', teacherId: ALI },
    ],
    subjects: [
      { id: 'sub1', name: 'English' },
      { id: 'sub2', name: 'Mathematics' },
    ],
    students: [
      student('s1', 'c1', 'male'),
      student('s2', 'c1', 'female'),
      student('s3', 'c1', 'female'),
      student('s4', 'c2', 'male'),
      student('s5', 'c3', 'male'),
    ],
    classSubjects: [
      { id: 'cs1', classId: 'c1', subjectId: 'sub1', teacherId: SARA },
      { id: 'cs2', classId: 'c2', subjectId: 'sub2', teacherId: SARA },
    ],
    // School days: 03-02, 03-03, 03-05 (someone reported). Sara's Grade 9
    // reported only on 03-03, so 03-02 and 03-05 are missed; 03-04 was no
    // school day. 03-10 is "today": not reported yet, so pending.
    attendance: [
      report('r1', 'c2', '2026-03-02'),
      report('r2', 'c1', '2026-03-03'),
      report('r3', 'c2', '2026-03-05'),
      report('r4', 'c2', '2026-01-05'), // before the period
    ],
    messages: [
      message('m1', 'p1', SARA, false, '2026-03-01T09:00:00.000Z'),
      message('m2', 'p1', SARA, false, null),
      message('m3', 'p2', SARA, false, null),
      message('m4', 'p1', SARA, true, null),
      message('m5', 'p1', null, false, null), // to the school office, not Sara
    ],
  });
});

test.after(stopServer);

test('teacher dashboard: classes, students, messages and missed days', async () => {
  const { status, body } = await api(SARA, '/api/teacher-dashboard?to=2026-03-10&days=30');
  assert.equal(status, 200);

  assert.deepEqual(
    body.classes.map((c) => [c.name, c.isClassTeacher, c.subjects, c.students, c.boys, c.girls]),
    [
      ['Grade 9', true, ['English'], 3, 1, 2],
      ['Grade 10', false, ['Mathematics'], 1, 1, 0],
    ]
  );
  assert.equal(body.totalStudents, 4);
  assert.deepEqual(body.messages, { conversations: 2, received: 3, read: 1, unread: 2, sent: 1 });
  assert.equal(body.schoolDays, 3);
  assert.deepEqual(body.missed.map((m) => [m.date, m.className]), [['2026-03-05', 'Grade 9'], ['2026-03-02', 'Grade 9']]);
  assert.deepEqual(body.pendingToday.map((p) => p.className), ['Grade 9']);
});

test('teacher dashboard: a shorter period and bad input', async () => {
  const short = await api(SARA, '/api/teacher-dashboard?to=2026-03-10&days=7');
  assert.deepEqual(short.body.missed.map((m) => m.date), ['2026-03-05']);

  assert.equal((await api(SARA, '/api/teacher-dashboard?to=yesterday')).status, 400);
  assert.equal((await api(SARA, '/api/teacher-dashboard?days=0')).status, 400);
});

test('teacher dashboard: teachers only', async () => {
  assert.equal((await api('u1', '/api/teacher-dashboard')).status, 403);
  assert.equal((await api('p1', '/api/teacher-dashboard')).status, 403);
});
