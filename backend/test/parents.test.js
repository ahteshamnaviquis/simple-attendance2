// API tests for parent accounts, the parent portal and messages. Run with: npm test
//
// Starts the real server on a spare port with a temporary MySQL database (see testServer.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopServer, readTable } = require('./testServer');

const SUPER = 'u0';
const ADMIN = 'u1';
const SARA = 'u2';
const PARENT = 'p1'; // Ahmed's and Fatima's parent
const OTHER_PARENT = 'p2'; // Bilal's parent

let baseUrl;

async function api(userId, method, url, body) {
  const response = await fetch(baseUrl + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(userId && { 'X-User-Id': userId }) },
    body: body && JSON.stringify(body),
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

// A date `days` days ago, as YYYY-MM-DD in this computer's time zone (like the server).
function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function report(id, classId, date, absentees) {
  return {
    id,
    classId,
    date,
    className: classId === 'c1' ? 'Grade 9' : 'Grade 10',
    teacherId: SARA,
    teacherName: 'Sara Khan',
    totalStudents: 2,
    present: 2 - absentees.length,
    absent: absentees.length,
    addedToday: 0,
    leftToday: 0,
    absentees,
    createdAt: '2026-10-01T08:00:00.000Z',
    createdBy: 'Sara Khan',
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: 'Sara Khan',
  };
}

function exam(id, name, status, extra = {}) {
  return {
    id,
    name,
    classId: 'c1',
    className: 'Grade 9',
    date: '2026-10-10',
    remarks: '',
    subjects: [
      { subjectId: 'sub1', subjectName: 'English', maxMarks: 100, passMarks: 33, submittedAt: '2026-10-11T08:00:00.000Z', submittedBy: 'Sara Khan' },
      { subjectId: 'sub2', subjectName: 'Mathematics', maxMarks: 50, passMarks: 17, submittedAt: '2026-10-11T08:00:00.000Z', submittedBy: 'Sara Khan' },
    ],
    status,
    createdById: SUPER,
    createdBy: 'Super Admin',
    createdAt: '2026-10-01T08:00:00.000Z',
    updatedAt: '2026-10-01T08:00:00.000Z',
    updatedBy: 'Super Admin',
    publishedAt: status === 'published' ? '2026-10-12T08:00:00.000Z' : null,
    publishedBy: status === 'published' ? 'Super Admin' : null,
    ...extra,
  };
}

function mark(examId, subjectId, studentId, studentName, obtained) {
  return {
    id: `${examId}-${subjectId}-${studentId}`,
    examId,
    subjectId,
    studentId,
    studentName,
    rollNumber: studentId === 's1' ? '1' : '2',
    obtained,
    absent: false,
    remarks: '',
    updatedAt: '2026-10-11T08:00:00.000Z',
    updatedBy: 'Sara Khan',
  };
}

const START_DATA = {
  users: [
    { id: 'u0', name: 'Super Admin', username: 'superadmin', password: 'super123', role: 'superadmin' },
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
    { id: 'p1', name: 'Hassan Ali', username: 'hassan', password: 'parent123', role: 'parent' },
    { id: 'p2', name: 'Ahmed Khan', username: 'ahmedk', password: 'parent123', role: 'parent' },
  ],
  classes: [
    { id: 'c1', name: 'Grade 9', teacherId: 'u2' },
    { id: 'c2', name: 'Grade 10', teacherId: null },
  ],
  students: [
    { id: 's1', rollNumber: '1', name: 'Ahmed Hassan', classId: 'c1', guardianName: 'Hassan Ali', phone: '' },
    { id: 's2', rollNumber: '2', name: 'Bilal Ahmed', classId: 'c1', guardianName: '', phone: '' },
    { id: 's3', rollNumber: '1', name: 'Fatima Noor', classId: 'c2', guardianName: '', phone: '' },
  ],
  subjects: [
    { id: 'sub1', name: 'English' },
    { id: 'sub2', name: 'Mathematics' },
  ],
  classSubjects: [
    { id: 'cs1', classId: 'c1', subjectId: 'sub1', teacherId: 'u2' },
    { id: 'cs2', classId: 'c1', subjectId: 'sub2', teacherId: null },
  ],
  attendance: [
    report('r1', 'c1', daysAgo(1), [{ name: 'ahmed hassan ', reason: 'Fever' }]),
    report('r2', 'c1', daysAgo(2), [{ name: 'Bilal Ahmed', reason: '' }]),
    report('r3', 'c1', daysAgo(3), []),
    report('r4', 'c1', daysAgo(90), [{ name: 'Ahmed Hassan', reason: 'Old' }]),
  ],
  exams: [
    exam('e1', 'Mid Term', 'published'),
    exam('e2', 'Final', 'open'),
    exam('e3', 'Hidden', 'published', { disabled: true }),
  ],
  marks: [
    mark('e1', 'sub1', 's1', 'Ahmed Hassan', 80),
    mark('e1', 'sub2', 's1', 'Ahmed Hassan', 10), // below pass marks (17)
    mark('e1', 'sub1', 's2', 'Bilal Ahmed', 90),
    mark('e1', 'sub2', 's2', 'Bilal Ahmed', 45),
  ],
  parentStudents: [
    { id: 'ps1', parentId: 'p1', studentId: 's1' },
    { id: 'ps2', parentId: 'p1', studentId: 's3' },
    { id: 'ps3', parentId: 'p2', studentId: 's2' },
  ],
  messages: [],
};

test.before(async () => {
  baseUrl = await startServer(START_DATA);
});

test.after(stopServer);

test('a parent logs in, but can not use staff screens', async () => {
  const login = await api(null, 'POST', '/api/login', { username: 'hassan', password: 'parent123' });
  assert.equal(login.status, 200);
  assert.equal(login.body.role, 'parent');

  for (const url of ['/api/students', '/api/attendance', '/api/classes', '/api/parents', '/api/messages', '/api/users']) {
    assert.equal((await api(PARENT, 'GET', url)).status, 403, url);
  }
  // Staff can't use the parent portal.
  assert.equal((await api(ADMIN, 'GET', '/api/parent/children')).status, 403);
});

test('a parent sees only their own children, with class, teachers and a summary', async () => {
  const res = await api(PARENT, 'GET', '/api/parent/children');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.map((c) => c.name), ['Ahmed Hassan', 'Fatima Noor']);

  const ahmed = res.body[0];
  assert.equal(ahmed.className, 'Grade 9');
  assert.equal(ahmed.classTeacher, 'Sara Khan');
  assert.deepEqual(ahmed.subjects.map((s) => [s.subjectName, s.teacherName]), [
    ['English', 'Sara Khan'],
    ['Mathematics', null],
  ]);
  // The 90-day-old report is outside the 30-day summary.
  assert.deepEqual(ahmed.attendance, { schoolDays: 3, present: 2, absent: 1, rate: 66.7 });
  assert.equal(ahmed.latestExam.name, 'Mid Term');

  const fatima = res.body[1];
  assert.equal(fatima.attendance.schoolDays, 0);
  assert.equal(fatima.attendance.rate, null);
  assert.equal(fatima.latestExam, null);

  assert.equal((await api(PARENT, 'GET', '/api/parent/children/s2/attendance')).status, 403);
  assert.equal((await api(PARENT, 'GET', '/api/parent/children/s2/exams')).status, 403);
});

test('attendance history marks the days the child was named absent', async () => {
  const res = await api(PARENT, 'GET', '/api/parent/children/s1/attendance');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.days, [
    { date: daysAgo(1), status: 'absent', reason: 'Fever' },
    { date: daysAgo(2), status: 'present', reason: '' },
    { date: daysAgo(3), status: 'present', reason: '' },
  ]);

  const longer = await api(PARENT, 'GET', `/api/parent/children/s1/attendance?from=${daysAgo(100)}`);
  assert.equal(longer.body.days.length, 4);
  assert.equal((await api(PARENT, 'GET', '/api/parent/children/s1/attendance?from=bad')).status, 400);
});

test('parents see only published, enabled results, and only their child\'s marks', async () => {
  const list = await api(PARENT, 'GET', '/api/parent/children/s1/exams');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.map((e) => e.name), ['Mid Term']);
  assert.equal(list.body[0].result, 'fail');
  assert.equal(list.body[0].rank, 2);

  const detail = await api(PARENT, 'GET', '/api/parent/children/s1/exams/e1');
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.body.result, {
    complete: true,
    result: 'fail',
    totalObtained: 90,
    totalMax: 150,
    percentage: 60,
    rank: 2,
  });
  assert.equal(detail.body.subjects[1].mark.passed, false);
  assert.equal(detail.body.classStats.highest, 90);
  assert.equal(detail.body.classStats.rankedCount, 2);
  assert.equal(JSON.stringify(detail.body).includes('Bilal'), false);

  assert.equal((await api(PARENT, 'GET', '/api/parent/children/s1/exams/e2')).status, 404); // not published
  assert.equal((await api(PARENT, 'GET', '/api/parent/children/s1/exams/e3')).status, 404); // disabled
});

// A complete new parent for the student form.
const NEW_PARENT = {
  name: 'Noor Khan',
  relation: 'Mother',
  phone: '0300-2222222',
  altPhone: '',
  email: 'Noor@Example.com',
  cnic: '35202-1234567-1',
  occupation: 'Teacher',
  address: 'House 5, Gulberg',
  username: 'Noor',
  password: 'noor123',
};

test('parents are added with the student, in one transaction', async () => {
  // There is no separate "add parent".
  assert.equal((await api(ADMIN, 'POST', '/api/parents', NEW_PARENT)).status, 404);

  const student = { name: 'Zara Khan', classId: 'c2', rollNumber: '7', guardianName: '', phone: '' };

  // Bad parent details: nothing is saved, not even the student.
  const bad = [
    [{ ...NEW_PARENT, relation: 'Cousin' }, /relation/],
    [{ ...NEW_PARENT, phone: '' }, /phone is required/],
    [{ ...NEW_PARENT, phone: 'call me' }, /phone number/],
    [{ ...NEW_PARENT, email: 'nope' }, /email/],
    [{ ...NEW_PARENT, cnic: '123' }, /CNIC/],
    [{ ...NEW_PARENT, password: '' }, /password is required/],
  ];
  for (const [parent, message] of bad) {
    const res = await api(ADMIN, 'POST', '/api/students', { ...student, parents: [parent] });
    assert.equal(res.status, 400, JSON.stringify(parent));
    assert.match(res.body.error, message);
  }
  const taken = await api(ADMIN, 'POST', '/api/students', { ...student, parents: [{ ...NEW_PARENT, username: 'sara' }] });
  assert.equal(taken.status, 409);
  assert.equal((await readTable('students')).some((s) => s.name === 'Zara Khan'), false);
  assert.equal((await readTable('users')).some((u) => u.username === 'noor'), false);

  // Teachers can add students, but not parent accounts.
  assert.equal((await api(SARA, 'POST', '/api/students', { ...student, classId: 'c1', parents: [NEW_PARENT] })).status, 403);

  const created = await api(ADMIN, 'POST', '/api/students', { ...student, parents: [NEW_PARENT] });
  assert.equal(created.status, 201);
  assert.equal(created.body.guardianName, 'Noor Khan'); // follows the first parent
  assert.equal(created.body.phone, '0300-2222222');
  assert.equal(created.body.parents.length, 1);
  assert.equal(created.body.parents[0].relation, 'Mother');
  const zaraId = created.body.id;
  const noorId = created.body.parents[0].parentId;

  const noor = (await api(ADMIN, 'GET', '/api/parents')).body.find((p) => p.id === noorId);
  assert.equal(noor.username, 'noor');
  assert.equal(noor.email, 'noor@example.com');
  assert.equal(noor.cnic, '35202-1234567-1');
  assert.equal(noor.password, undefined);
  assert.deepEqual(noor.children.map((c) => c.name), ['Zara Khan']);
  assert.equal((await api(null, 'POST', '/api/login', { username: 'noor', password: 'noor123' })).status, 200);

  // A brother joins: link the same parent, so she sees both children.
  const brother = await api(ADMIN, 'POST', '/api/students', {
    name: 'Ali Khan',
    classId: 'c1',
    rollNumber: '9',
    parents: [{ parentId: noorId }],
  });
  assert.equal(brother.status, 201);
  const children = await api(noorId, 'GET', '/api/parent/children');
  assert.deepEqual(children.body.map((c) => c.name), ['Ali Khan', 'Zara Khan']);

  // Editing the student: update the mother's phone (blank password keeps hers) and add a father.
  const edited = await api(ADMIN, 'PUT', `/api/students/${zaraId}`, {
    ...student,
    parents: [
      { parentId: noorId, ...NEW_PARENT, phone: '0311-5555555', password: '' },
      { ...NEW_PARENT, name: 'Imran Khan', relation: 'Father', username: 'imran', email: '' },
    ],
  });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.body.parents.map((p) => [p.name, p.relation]), [['Noor Khan', 'Mother'], ['Imran Khan', 'Father']]);
  assert.equal(edited.body.phone, '0311-5555555');
  assert.equal((await api(null, 'POST', '/api/login', { username: 'noor', password: 'noor123' })).status, 200);

  // Same parent twice, two new parents with one username, or a non-parent: rejected.
  assert.equal((await api(ADMIN, 'PUT', `/api/students/${zaraId}`, { ...student, parents: [{ parentId: noorId }, { parentId: noorId }] })).status, 400);
  assert.equal((await api(ADMIN, 'PUT', `/api/students/${zaraId}`, { ...student, parents: [NEW_PARENT, NEW_PARENT] })).status, 400);
  assert.equal((await api(ADMIN, 'PUT', `/api/students/${zaraId}`, { ...student, parents: [{ parentId: SARA }] })).status, 400);

  // Leaving `parents` out keeps them; an empty list unlinks them (the accounts stay).
  const kept = await api(ADMIN, 'PUT', `/api/students/${zaraId}`, { ...student, name: 'Zara Imran' });
  assert.equal(kept.body.parents.length, 2);
  const unlinked = await api(ADMIN, 'PUT', `/api/students/${zaraId}`, { ...student, parents: [] });
  assert.deepEqual(unlinked.body.parents, []);
  assert.ok((await readTable('users')).some((u) => u.username === 'imran'));

  // Teachers see each student's parents (name, relation, phone) but can't change them.
  const sarasView = (await api(SARA, 'GET', '/api/students')).body.find((s) => s.name === 'Ali Khan');
  assert.deepEqual(sarasView.parents, [{ parentId: noorId, name: 'Noor Khan', relation: 'Mother', phone: '0311-5555555' }]);
  assert.equal((await api(SARA, 'PUT', `/api/students/${brother.body.id}`, { name: 'Ali Khan', classId: 'c1', parents: [] })).status, 403);
});

test('admins edit, disable and remove parents in the directory', async () => {
  assert.equal((await api(SARA, 'GET', '/api/parents')).status, 403);

  const list = await api(ADMIN, 'GET', '/api/parents');
  assert.equal(list.status, 200);
  const hassan = list.body.find((p) => p.id === PARENT);
  assert.deepEqual(hassan.children.map((c) => c.className), ['Grade 9', 'Grade 10']);
  assert.equal(hassan.relation, ''); // added before parent details existed

  const edited = await api(ADMIN, 'PUT', `/api/parents/${PARENT}`, { ...NEW_PARENT, name: 'Hassan Ali', relation: 'Father', username: 'hassan', password: '' });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.relation, 'Father');
  assert.equal((await api(ADMIN, 'PUT', `/api/parents/${PARENT}`, { ...NEW_PARENT, relation: '' })).status, 400);
  assert.equal((await api(null, 'POST', '/api/login', { username: 'hassan', password: 'parent123' })).status, 200);

  const temp = await api(ADMIN, 'POST', '/api/students', {
    name: 'Temp Child',
    classId: 'c2',
    parents: [{ ...NEW_PARENT, name: 'Temp Parent', username: 'temp' }],
  });
  const id = temp.body.parents[0].parentId;

  // Disabled parents can't log in and are logged out.
  assert.equal((await api(ADMIN, 'POST', `/api/parents/${id}/disable`)).body.disabled, true);
  const blocked = await api(null, 'POST', '/api/login', { username: 'temp', password: 'noor123' });
  assert.equal(blocked.status, 403);
  assert.match(blocked.body.error, /contact the school/);
  assert.equal((await api(id, 'GET', '/api/parent/children')).status, 401);
  assert.equal((await api(ADMIN, 'POST', `/api/parents/${id}/enable`)).body.disabled, false);

  // Removing a student removes them from their parents.
  assert.equal((await api(ADMIN, 'DELETE', `/api/students/${temp.body.id}`)).status, 200);
  assert.deepEqual((await api(ADMIN, 'GET', '/api/parents')).body.find((p) => p.id === id).children, []);

  // Removing a parent removes their profile, links and messages.
  await api(ADMIN, 'POST', '/api/messages', { parentIds: [id], body: 'Hello' });
  assert.equal((await api(ADMIN, 'DELETE', `/api/parents/${id}`)).status, 204);
  assert.equal((await readTable('parentProfiles')).some((p) => p.id === id), false);
  assert.equal((await readTable('messages')).some((m) => m.parentId === id), false);
  assert.equal((await api(ADMIN, 'DELETE', `/api/parents/${SARA}`)).status, 404);
});

test('the school and parents message each other, with unread counts', async () => {
  assert.equal((await api(ADMIN, 'POST', '/api/messages', { parentIds: [PARENT], body: '  ' })).status, 400);
  assert.equal((await api(ADMIN, 'POST', '/api/messages', { parentIds: [], body: 'Hi' })).status, 400);
  assert.equal((await api(ADMIN, 'POST', '/api/messages', { parentIds: [SARA], body: 'Hi' })).status, 400);
  assert.equal((await api(ADMIN, 'POST', '/api/messages', { parentIds: [PARENT], body: 'x'.repeat(2001) })).status, 400);
  assert.equal((await api(SARA, 'POST', '/api/messages', { parentIds: [PARENT], body: 'Hi' })).status, 403);

  // One message to two parents: two private conversations.
  const sent = await api(ADMIN, 'POST', '/api/messages', { parentIds: [PARENT, OTHER_PARENT], body: 'School closes early on Friday.' });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.sentCount, 2);

  assert.deepEqual((await api(PARENT, 'GET', '/api/parent/messages/unread')).body, { count: 1 });
  const inbox = await api(PARENT, 'GET', '/api/parent/messages');
  assert.equal(inbox.body.length, 1);
  assert.equal(inbox.body[0].senderName, 'Admin User');
  assert.deepEqual((await api(PARENT, 'GET', '/api/parent/messages/unread')).body, { count: 0 });

  assert.equal((await api(PARENT, 'POST', '/api/parent/messages', { body: '' })).status, 400);
  const reply = await api(PARENT, 'POST', '/api/parent/messages', { body: 'Thanks, noted.' });
  assert.equal(reply.status, 201);
  assert.equal(reply.body.fromSchool, false);

  // The super admin sees the same conversations as admins.
  assert.deepEqual((await api(SUPER, 'GET', '/api/messages/unread')).body, { count: 1 });
  const threads = await api(SUPER, 'GET', '/api/messages');
  assert.equal(threads.body[0].parentId, PARENT); // newest conversation first
  assert.equal(threads.body[0].unreadCount, 1);
  assert.equal(threads.body[0].lastMessage.body, 'Thanks, noted.');

  const thread = await api(ADMIN, 'GET', `/api/messages/${PARENT}`);
  assert.deepEqual(thread.body.messages.map((m) => m.body), ['School closes early on Friday.', 'Thanks, noted.']);
  assert.ok(thread.body.messages[0].readAt); // the parent read it
  assert.deepEqual((await api(ADMIN, 'GET', '/api/messages/unread')).body, { count: 0 });

  // The other parent doesn't see this conversation.
  const other = await api(OTHER_PARENT, 'GET', '/api/parent/messages');
  assert.deepEqual(other.body.map((m) => m.body), ['School closes early on Friday.']);
});

test('admins keep messages when the super admin stops them managing parents', async () => {
  const settings = (await api(null, 'GET', '/api/settings')).body;
  const off = { ...settings, adminPermissions: { ...settings.adminPermissions, parents: false } };
  assert.equal((await api(SUPER, 'PUT', '/api/settings', off)).status, 200);
  assert.equal((await api(ADMIN, 'GET', '/api/parents')).status, 403);
  assert.equal((await api(ADMIN, 'POST', '/api/students', { name: 'X', classId: 'c1', parents: [] })).status, 403);
  assert.equal((await api(SUPER, 'GET', '/api/parents')).status, 200);

  // Messages stay with every admin and the super admin.
  assert.equal((await api(ADMIN, 'GET', '/api/messages')).status, 200);
  const recipients = await api(ADMIN, 'GET', '/api/messages/parents');
  assert.equal(recipients.status, 200);
  assert.ok(recipients.body.some((p) => p.id === PARENT && p.children.length === 2));
  assert.equal(recipients.body[0].username, undefined);
  assert.equal((await api(ADMIN, 'POST', '/api/messages', { parentIds: [PARENT], body: 'Still here' })).status, 201);
  assert.equal((await api(SARA, 'GET', '/api/messages/parents')).status, 403);
});
