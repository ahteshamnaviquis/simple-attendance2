// API tests for subject assignments, examinations, marks and results. Run with: npm test
//
// Starts the real server on a spare port with a temporary data folder, so the
// files in backend/data are never touched. The folder starts with the fixed data
// below (not seedData.js, so changing the demo data doesn't break the tests):
// admin u1, teachers u2 (Sara, class teacher of c1 and c2) and u3 (Ali, class
// teacher of c3), Grade 1 - Grade 3 (c1-c3), students s1-s3 in c1, s4-s5 in c2,
// s6-s7 in c3. Subjects start empty: the tests add their own.
//
// In these tests Grade 1 (c1) studies English (taught by Sara), Mathematics
// (taught by Ali) and Physics (no teacher yet, so the admin enters its marks).

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

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

const START_DATA = {
  users: [
    { id: 'u1', name: 'Admin User', username: 'admin', password: 'admin123', role: 'admin' },
    { id: 'u2', name: 'Sara Khan', username: 'sara', password: 'teacher123', role: 'teacher' },
    { id: 'u3', name: 'Ali Raza', username: 'ali', password: 'teacher123', role: 'teacher' },
  ],
  classes: [
    { id: 'c1', name: 'Grade 1', teacherId: 'u2' },
    { id: 'c2', name: 'Grade 2', teacherId: 'u2' },
    { id: 'c3', name: 'Grade 3', teacherId: 'u3' },
  ],
  students: [
    ['s1', '1', 'Ahmed Hassan', 'c1'],
    ['s2', '2', 'Ayesha Malik', 'c1'],
    ['s3', '3', 'Bilal Ahmed', 'c1'],
    ['s4', '1', 'Fatima Noor', 'c2'],
    ['s5', '2', 'Hamza Iqbal', 'c2'],
    ['s6', '1', 'Zainab Shah', 'c3'],
    ['s7', '2', 'Usman Tariq', 'c3'],
  ].map(([id, rollNumber, name, classId]) => ({ id, rollNumber, name, classId, guardianName: '', phone: '' })),
  attendance: [],
  subjects: [],
  classSubjects: [],
  exams: [],
  marks: [],
};

function readFile(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, `${name}.json`), 'utf8'));
}

test.before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exams-test-'));
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

const ids = {};
const marksUrl = () => `/api/exams/${ids.exam}/marks`;
const saveMarks = (user, subjectId, marks) => api(user, 'PUT', marksUrl(), { subjectId, marks });

test('admin manages subjects; teachers can only read them', async () => {
  for (const name of ['English', 'Mathematics', 'Physics', 'Urdu']) {
    const res = await api(ADMIN, 'POST', '/api/subjects', { name });
    assert.equal(res.status, 201);
    ids[name] = res.body.id;
  }
  assert.equal((await api(ADMIN, 'POST', '/api/subjects', { name: 'english' })).status, 409);
  assert.equal((await api(SARA, 'POST', '/api/subjects', { name: 'Chemistry' })).status, 403);
  assert.equal((await api(SARA, 'GET', '/api/subjects')).body.length, 4);
});

test('admin assigns subjects and subject teachers to a class', async () => {
  const set = (user, classId, subjects) => api(user, 'PUT', `/api/class-subjects/${classId}`, { subjects });

  assert.equal((await set(SARA, 'c1', [{ subjectId: ids.English, teacherId: SARA }])).status, 403);
  const twice = [{ subjectId: ids.English }, { subjectId: ids.English }];
  assert.equal((await set(ADMIN, 'c1', twice)).status, 400);
  assert.equal((await set(ADMIN, 'c1', [{ subjectId: ids.English, teacherId: ADMIN }])).status, 400);
  assert.equal((await set(ADMIN, 'nope', [])).status, 404);

  const first = await set(ADMIN, 'c1', [
    { subjectId: ids.English, teacherId: SARA },
    { subjectId: ids.Mathematics, teacherId: SARA },
  ]);
  assert.equal(first.status, 200);
  const englishRowId = first.body.find((r) => r.subjectId === ids.English).id;

  // Change Maths to Ali, add Physics with no teacher. English keeps its row.
  const res = await set(ADMIN, 'c1', [
    { subjectId: ids.English, teacherId: SARA },
    { subjectId: ids.Mathematics, teacherId: ALI },
    { subjectId: ids.Physics, teacherId: null },
  ]);
  assert.equal(res.status, 200);
  assert.equal(res.body.find((r) => r.subjectId === ids.English).id, englishRowId);
  assert.equal(res.body.find((r) => r.subjectId === ids.Mathematics).teacherName, 'Ali Raza');
  await set(ADMIN, 'c3', [{ subjectId: ids.Urdu, teacherId: ALI }]);

  assert.equal(readFile('classSubjects').length, 4);
  const mine = await api(SARA, 'GET', '/api/class-subjects');
  assert.deepEqual(mine.body.map((r) => r.subjectName), ['English']);
  const c1 = await api(ADMIN, 'GET', '/api/class-subjects?classId=c1');
  assert.deepEqual(c1.body.map((r) => r.subjectName), ['English', 'Mathematics', 'Physics']);
});

test('only the admin creates examinations, from the class subjects', async () => {
  const exam = {
    name: 'Monthly Test - October',
    classId: 'c1',
    date: '2026-10-15',
    remarks: 'Bring geometry box',
    subjects: [
      { subjectId: ids.English, maxMarks: 100 },
      { subjectId: ids.Mathematics, maxMarks: 100 },
      { subjectId: ids.Physics, maxMarks: 75 },
    ],
  };
  assert.equal((await api(SARA, 'POST', '/api/exams', exam)).status, 403);

  const created = await api(ADMIN, 'POST', '/api/exams', exam);
  assert.equal(created.status, 201);
  assert.equal(created.body.status, 'open');
  assert.ok(created.body.subjects.every((s) => s.submittedAt === null));
  ids.exam = created.body.id;

  assert.equal((await api(ADMIN, 'POST', '/api/exams', exam)).status, 409); // same name, class, date
  const urdu = { ...exam, name: 'X', subjects: [{ subjectId: ids.Urdu, maxMarks: 100 }] };
  assert.equal((await api(ADMIN, 'POST', '/api/exams', urdu)).status, 400); // Urdu isn't a c1 subject
  const zero = { ...exam, name: 'X', subjects: [{ subjectId: ids.English, maxMarks: 0 }] };
  assert.equal((await api(ADMIN, 'POST', '/api/exams', zero)).status, 400);
  const none = { ...exam, name: 'X', subjects: [] };
  assert.equal((await api(ADMIN, 'POST', '/api/exams', none)).status, 400);

  assert.equal((await api(SARA, 'PUT', `/api/exams/${ids.exam}`, exam)).status, 403);
  assert.equal((await api(SARA, 'DELETE', `/api/exams/${ids.exam}`)).status, 403);
});

test('teachers see only the exam subjects they teach', async () => {
  const sara = await api(SARA, 'GET', '/api/exams/my-subjects');
  assert.deepEqual(sara.body.map((r) => [r.examName, r.subjectName, r.maxMarks, r.status]), [
    ['Monthly Test - October', 'English', 100, 'pending'],
  ]);
  const ali = await api(ALI, 'GET', '/api/exams/my-subjects');
  assert.deepEqual(ali.body.map((r) => r.subjectName), ['Mathematics']); // not c1's class teacher

  const exam = await api(SARA, 'GET', `/api/exams/${ids.exam}`);
  assert.deepEqual(exam.body.subjects.map((s) => s.subjectName), ['English']);
  assert.equal(exam.body.studentCount, 3);
  const all = await api(ADMIN, 'GET', `/api/exams/${ids.exam}`);
  assert.deepEqual(all.body.subjects.map((s) => s.teacherName), ['Sara Khan', 'Ali Raza', null]);

  // A teacher with no subject in this exam
  const zara = await api(ADMIN, 'POST', '/api/teachers', { name: 'Nadia', username: 'nadia', password: 'x' });
  ids.zara = zara.body.id;
  assert.equal((await api(ids.zara, 'GET', `/api/exams/${ids.exam}`)).status, 403);
  assert.equal((await api(ids.zara, 'GET', '/api/exams/my-subjects')).body.length, 0);

  // Teachers can't use the admin list or results
  assert.equal((await api(SARA, 'GET', '/api/exams')).status, 403);
  assert.equal((await api(SARA, 'GET', `/api/exams/${ids.exam}/results`)).status, 403);
  assert.equal((await api(ADMIN, 'GET', '/api/exams/my-subjects')).status, 403);
  assert.equal((await api(null, 'GET', '/api/exams/my-subjects')).status, 401);
});

test('a teacher enters marks only for their own subject, even by changing the request', async () => {
  const grid = await api(SARA, 'GET', `${marksUrl()}?subjectId=${ids.English}`);
  assert.equal(grid.status, 200);
  assert.deepEqual(grid.body.rows.map((r) => r.studentId), ['s1', 's2', 's3']);
  assert.equal(grid.body.subject.maxMarks, 100);

  assert.equal((await api(SARA, 'GET', `${marksUrl()}?subjectId=${ids.Mathematics}`)).status, 403);
  assert.equal((await saveMarks(SARA, ids.Mathematics, [{ studentId: 's1', obtained: 50 }])).status, 403);
  assert.equal((await saveMarks(ALI, ids.English, [{ studentId: 's1', obtained: 50 }])).status, 403);
  assert.equal((await saveMarks(SARA, ids.Physics, [{ studentId: 's1', obtained: 50 }])).status, 403);
  assert.equal((await saveMarks(ids.zara, ids.English, [{ studentId: 's1', obtained: 50 }])).status, 403);
  assert.equal(readFile('marks').length, 0);
});

test('valid marks are saved and edited without duplicates; zero is not missing', async () => {
  let res = await saveMarks(SARA, ids.English, [
    { studentId: 's1', obtained: 80, remarks: 'Good' },
    { studentId: 's2', obtained: '72.5' },
    { studentId: 's3', obtained: '' },
  ]);
  assert.equal(res.status, 200);
  assert.equal(res.body.savedCount, 2);
  assert.equal(res.body.subject.status, 'in_progress');
  assert.equal(res.body.subject.enteredCount, 2);

  res = await saveMarks(SARA, ids.English, [
    { studentId: 's1', obtained: 85, remarks: 'Excellent' },
    { studentId: 's2', obtained: 72.5 },
    { studentId: 's3', obtained: 0 },
  ]);
  assert.equal(res.body.savedCount, 2); // s2 unchanged
  assert.equal(res.body.rows.find((r) => r.studentId === 's3').obtained, 0);
  assert.equal(res.body.subject.enteredCount, 3);

  const english = readFile('marks').filter((m) => m.subjectId === ids.English);
  assert.equal(english.length, 3);
  assert.equal(new Set(english.map((m) => m.studentId)).size, 3);
});

test('invalid marks are rejected and nothing from that save is stored', async () => {
  const before = readFile('marks');
  const bad = [
    [{ studentId: 's1', obtained: 50 }, { studentId: 's2', obtained: -1 }],
    [{ studentId: 's1', obtained: 50 }, { studentId: 's2', obtained: 101 }],
    [{ studentId: 's1', obtained: 'abc' }],
    [{ studentId: 's1', obtained: 10.555 }],
    [{ studentId: 's1', obtained: 10, absent: true }],
    [{ studentId: 's1', obtained: 10 }, { studentId: 's1', obtained: 11 }],
    [{ studentId: 's4', obtained: 10 }], // s4 is in another class
  ];
  for (const marks of bad) {
    const res = await saveMarks(SARA, ids.English, marks);
    assert.equal(res.status, 400, JSON.stringify(marks));
  }
  assert.equal((await saveMarks(ADMIN, ids.Urdu, [{ studentId: 's1', obtained: 1 }])).status, 400);
  assert.deepEqual(readFile('marks'), before);
});

test('submitting needs every student; submitted marks are locked', async () => {
  // Maths: s3 missing
  await saveMarks(ALI, ids.Mathematics, [
    { studentId: 's1', obtained: 78 },
    { studentId: 's2', obtained: 0 },
  ]);
  const early = await api(ALI, 'POST', `/api/exams/${ids.exam}/subjects/${ids.Mathematics}/submit`);
  assert.equal(early.status, 409);

  await saveMarks(ALI, ids.Mathematics, [{ studentId: 's3', obtained: 90 }]);
  assert.equal((await api(SARA, 'POST', `/api/exams/${ids.exam}/subjects/${ids.Mathematics}/submit`)).status, 403);
  const ok = await api(ALI, 'POST', `/api/exams/${ids.exam}/subjects/${ids.Mathematics}/submit`);
  assert.equal(ok.status, 200);
  assert.equal(ok.body.subjects.find((s) => s.subjectId === ids.Mathematics).submittedBy, 'Ali Raza');

  assert.equal((await saveMarks(ALI, ids.Mathematics, [{ studentId: 's1', obtained: 1 }])).status, 409);
  assert.equal((await saveMarks(ADMIN, ids.Mathematics, [{ studentId: 's1', obtained: 1 }])).status, 409);
  const again = await api(ALI, 'POST', `/api/exams/${ids.exam}/subjects/${ids.Mathematics}/submit`);
  assert.equal(again.status, 409);

  const ali = await api(ALI, 'GET', '/api/exams/my-subjects');
  assert.equal(ali.body[0].status, 'submitted');
});

test('admin monitors progress per subject and teacher', async () => {
  const list = await api(ADMIN, 'GET', '/api/exams');
  const exam = list.body[0];
  assert.equal(exam.subjectCount, 3);
  assert.equal(exam.submittedCount, 1);
  assert.equal(exam.pendingCount, 2);
  assert.equal(exam.readyToPublish, false);
  assert.equal(exam.stats.studentCount, 3);
  assert.deepEqual(
    exam.subjects.map((s) => [s.subjectName, s.teacherName, s.status, s.enteredCount]),
    [
      ['English', 'Sara Khan', 'in_progress', 3],
      ['Mathematics', 'Ali Raza', 'submitted', 3],
      ['Physics', null, 'pending', 0],
    ]
  );
});

test('results stay Incomplete until every subject is submitted', async () => {
  // Admin enters Physics (no teacher assigned); s2 absent.
  const physics = await saveMarks(ADMIN, ids.Physics, [
    { studentId: 's1', obtained: 60 },
    { studentId: 's2', absent: true },
    { studentId: 's3', obtained: 60 },
  ]);
  assert.equal(physics.status, 200);
  // English: change s3 so s1 and s3 tie
  await saveMarks(SARA, ids.English, [{ studentId: 's3', obtained: 73 }]);

  let res = await api(ADMIN, 'GET', `/api/exams/${ids.exam}/results`);
  assert.ok(res.body.rows.every((r) => r.allEntered && !r.complete && r.rank === null));
  assert.equal(res.body.stats.completeCount, 0);

  assert.equal((await api(ADMIN, 'POST', `/api/exams/${ids.exam}/publish`)).status, 409);

  await api(SARA, 'POST', `/api/exams/${ids.exam}/subjects/${ids.English}/submit`);
  await api(ADMIN, 'POST', `/api/exams/${ids.exam}/subjects/${ids.Physics}/submit`);

  res = await api(ADMIN, 'GET', `/api/exams/${ids.exam}/results`);
  const [s1, s2, s3] = res.body.rows;
  assert.equal(s1.totalMax, 275);
  assert.equal(s1.totalObtained, 223); // 85 + 78 + 60
  assert.equal(s1.percentage, 81.09);
  assert.equal(s1.marks[ids.Physics].percentage, 80);
  assert.equal(s2.marks[ids.Mathematics].obtained, 0);
  assert.equal(s2.marks[ids.Physics].absent, true);
  assert.equal(s2.totalObtained, 72.5);
  assert.equal(s2.percentage, 26.36);
  assert.deepEqual([s1.rank, s3.rank, s2.rank], [1, 1, 3]);
  // Pass marks default to 33%: 33/100 and 25/75. s2 has 0 in Maths and was absent in Physics.
  assert.deepEqual(res.body.subjects.map((s) => s.passMarks), [33, 33, 25]);
  assert.deepEqual([s1.result, s2.result, s3.result], ['pass', 'fail', 'pass']);
  assert.deepEqual(s2.failedSubjects, [ids.Mathematics, ids.Physics]);
  assert.equal(s2.marks[ids.English].passed, true);
  assert.equal(s2.marks[ids.Physics].passed, false);
  assert.deepEqual(res.body.stats, {
    studentCount: 3,
    completeCount: 3,
    incompleteCount: 0,
    leftClassCount: 0,
    totalMax: 275,
    allSubmitted: true,
    average: 62.85,
    highest: 81.09,
    lowest: 26.36,
    passCount: 2,
    failCount: 1,
  });
  assert.deepEqual(res.body.subjects.map((s) => s.teacherName), ['Sara Khan', 'Ali Raza', null]);
});

test('max marks and subjects with marks are protected when editing the exam', async () => {
  const exam = (await api(ADMIN, 'GET', `/api/exams/${ids.exam}`)).body;
  const base = { name: exam.name, date: exam.date, remarks: exam.remarks };
  const subjects = exam.subjects.map((s) => ({ subjectId: s.subjectId, maxMarks: s.maxMarks }));

  const remove = await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, subjects: subjects.slice(0, 2) });
  assert.equal(remove.status, 409);
  const lower = subjects.map((s) => (s.subjectId === ids.English ? { ...s, maxMarks: 80 } : s));
  assert.equal((await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, subjects: lower })).status, 409);
  const urdu = [...subjects, { subjectId: ids.Urdu, maxMarks: 100 }];
  assert.equal((await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, subjects: urdu })).status, 400);
  const moveClass = await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, classId: 'c2', subjects });
  assert.equal(moveClass.status, 400);

  const raise = subjects.map((s) => (s.subjectId === ids.English ? { ...s, maxMarks: 90 } : s));
  const ok = await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, subjects: raise });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.subjects.every((s) => s.submittedAt)); // submissions kept
  await api(ADMIN, 'PUT', `/api/exams/${ids.exam}`, { ...base, subjects });

  assert.equal((await api(ADMIN, 'DELETE', `/api/exams/${ids.exam}`)).status, 409);
});

test('only the admin publishes; corrections go through unpublish and reopen', async () => {
  assert.equal((await api(SARA, 'POST', `/api/exams/${ids.exam}/publish`)).status, 403);
  const published = await api(ADMIN, 'POST', `/api/exams/${ids.exam}/publish`);
  assert.equal(published.status, 200);
  assert.equal(published.body.status, 'published');

  const reopenPublished = await api(ADMIN, 'POST', `/api/exams/${ids.exam}/subjects/${ids.English}/reopen`);
  assert.equal(reopenPublished.status, 409);
  assert.equal((await api(ADMIN, 'POST', `/api/exams/${ids.exam}/unpublish`)).status, 200);

  assert.equal((await api(SARA, 'POST', `/api/exams/${ids.exam}/subjects/${ids.English}/reopen`)).status, 403);
  const reopened = await api(ADMIN, 'POST', `/api/exams/${ids.exam}/subjects/${ids.English}/reopen`);
  assert.equal(reopened.status, 200);

  const fix = await saveMarks(SARA, ids.English, [{ studentId: 's2', obtained: 74.5 }]);
  assert.equal(fix.status, 200);
  const res = await api(ADMIN, 'GET', `/api/exams/${ids.exam}/results`);
  assert.equal(res.body.stats.completeCount, 0); // English is no longer submitted
  assert.equal((await api(ADMIN, 'POST', `/api/exams/${ids.exam}/publish`)).status, 409);

  await api(SARA, 'POST', `/api/exams/${ids.exam}/subjects/${ids.English}/submit`);
  assert.equal((await api(ADMIN, 'POST', `/api/exams/${ids.exam}/publish`)).status, 200);
});

test('the admin list filters examinations', async () => {
  const other = await api(ADMIN, 'POST', '/api/exams', {
    name: 'Weekly Test',
    classId: 'c3',
    date: '2026-10-01',
    subjects: [{ subjectId: ids.Urdu, maxMarks: 50 }],
  });
  assert.equal(other.status, 201);

  const filtered = async (q) => (await api(ADMIN, 'GET', `/api/exams?${q}`)).body.map((e) => e.name);
  assert.deepEqual(await filtered(''), ['Monthly Test - October', 'Weekly Test']);
  assert.deepEqual(await filtered('classId=c3'), ['Weekly Test']);
  assert.deepEqual(await filtered('name=monthly'), ['Monthly Test - October']);
  assert.deepEqual(await filtered(`subjectId=${ids.Urdu}`), ['Weekly Test']);
  assert.deepEqual(await filtered('from=2026-10-10&to=2026-10-31'), ['Monthly Test - October']);
  assert.deepEqual(await filtered('status=published'), ['Monthly Test - October']);

  assert.equal((await api(ALI, 'GET', '/api/exams/my-subjects')).body.length, 2); // Maths + Urdu
  assert.equal((await api(ADMIN, 'DELETE', `/api/exams/${other.body.id}`)).status, 200);
});

test('marks of a student who left the class are kept but not ranked', async () => {
  await api(ADMIN, 'POST', `/api/exams/${ids.exam}/unpublish`);
  const student = readFile('students').find((s) => s.id === 's3');
  const moved = await api(ADMIN, 'PUT', '/api/students/s3', { ...student, classId: 'c2' });
  assert.equal(moved.status, 200);

  const res = await api(ADMIN, 'GET', `/api/exams/${ids.exam}/results`);
  const s3 = res.body.rows.find((r) => r.studentId === 's3');
  assert.equal(s3.leftClass, true);
  assert.equal(s3.marks[ids.Mathematics].obtained, 90);
  assert.equal(res.body.stats.studentCount, 2);
  assert.equal(res.body.stats.leftClassCount, 1);
});

test('existing features keep working', async () => {
  assert.equal((await api(null, 'POST', '/api/login', { username: 'sara', password: 'teacher123' })).status, 200);
  assert.equal((await api(SARA, 'GET', '/api/classes')).body.length, 2);
  assert.equal((await api(ALI, 'GET', '/api/students')).body.length, 2); // still only his own class
  const report = await api(SARA, 'POST', '/api/attendance', {
    classId: 'c1',
    date: '2026-10-01',
    totalStudents: 2,
    present: 2,
    absent: 0,
    addedToday: 0,
    leftToday: 0,
    absentees: [],
  });
  assert.equal(report.status, 201);
  // Ali teaches Maths in c1 but is not its class teacher: attendance stays Sara's.
  assert.equal((await api(ALI, 'GET', '/api/attendance?classId=c1')).body.length, 0);
  assert.equal(readFile('classes').length, 3);
  assert.equal(readFile('classes')[0].teacherId, 'u2');
});

test('the admin creates the same exam for several classes at once', async () => {
  const exam = {
    name: 'Midterm Exam',
    date: '2026-11-10',
    remarks: '',
    subjects: [
      { subjectId: ids.English, maxMarks: 100 },
      { subjectId: ids.Urdu, maxMarks: 50 },
    ],
  };
  const before = readFile('exams').length;

  assert.equal((await api(SARA, 'POST', '/api/exams/bulk', { ...exam, classIds: ['c1'] })).status, 403);
  assert.equal((await api(ADMIN, 'POST', '/api/exams/bulk', { ...exam, classIds: [] })).status, 400);
  // c2 has no subjects yet: nothing is created, not even for c1
  const noSubjects = await api(ADMIN, 'POST', '/api/exams/bulk', { ...exam, classIds: ['c1', 'c2'] });
  assert.equal(noSubjects.status, 400);
  assert.match(noSubjects.body.error, /Grade 2/);
  assert.equal(readFile('exams').length, before);

  await api(ADMIN, 'PUT', '/api/class-subjects/c2', { subjects: [{ subjectId: ids.English, teacherId: SARA }] });
  const res = await api(ADMIN, 'POST', '/api/exams/bulk', { ...exam, classIds: ['c1', 'c2', 'c3', 'c1'] });
  assert.equal(res.status, 201);
  const byClass = Object.fromEntries(
    res.body.map((e) => [e.className, e.subjects.map((s) => `${s.subjectName}/${s.maxMarks}`)])
  );
  assert.deepEqual(byClass, {
    'Grade 1': ['English/100'], // c1 doesn't study Urdu
    'Grade 2': ['English/100'],
    'Grade 3': ['Urdu/50'], // c3 doesn't study English
  });
  assert.ok(res.body.every((e) => e.status === 'open' && e.createdBy === 'Admin User'));
  assert.equal(readFile('exams').length, before + 3);

  // Again: Grade 1 already has it, so nothing more is created.
  const again = await api(ADMIN, 'POST', '/api/exams/bulk', { ...exam, classIds: ['c2', 'c1'] });
  assert.equal(again.status, 409);
  assert.match(again.body.error, /Grade 2/);
  assert.equal(readFile('exams').length, before + 3);

  // Each class's subject teacher sees their own class's exam.
  const sara = await api(SARA, 'GET', '/api/exams/my-subjects');
  assert.deepEqual(
    sara.body.filter((r) => r.examName === 'Midterm Exam').map((r) => r.className),
    ['Grade 1', 'Grade 2']
  );
});

test('pass marks default to 33% and can be set per subject', async () => {
  const base = { name: 'Pass Marks Test', classId: 'c1', date: '2026-12-01', remarks: '' };
  const create = (subjects) => api(ADMIN, 'POST', '/api/exams', { ...base, subjects });

  assert.equal((await create([{ subjectId: ids.English, maxMarks: 50, passMarks: 51 }])).status, 400);
  assert.equal((await create([{ subjectId: ids.English, maxMarks: 50, passMarks: 0 }])).status, 400);
  assert.equal((await create([{ subjectId: ids.English, maxMarks: 50, passMarks: 20.5 }])).status, 400);

  const res = await create([
    { subjectId: ids.English, maxMarks: 50 }, // default: 17
    { subjectId: ids.Mathematics, maxMarks: 100, passMarks: 40 },
  ]);
  assert.equal(res.status, 201);
  assert.deepEqual(res.body.subjects.map((s) => s.passMarks), [17, 40]);

  // Edit: change pass marks; can't go above the maximum.
  const url = `/api/exams/${res.body.id}`;
  const tooHigh = await api(ADMIN, 'PUT', url, { ...base, subjects: [{ subjectId: ids.English, maxMarks: 50, passMarks: 60 }] });
  assert.equal(tooHigh.status, 400);
  const edited = await api(ADMIN, 'PUT', url, {
    ...base,
    subjects: [
      { subjectId: ids.English, maxMarks: 50, passMarks: 25 },
      { subjectId: ids.Mathematics, maxMarks: 100, passMarks: 40 },
    ],
  });
  assert.equal(edited.status, 200);
  assert.deepEqual(edited.body.subjects.map((s) => s.passMarks), [25, 40]);

  // Teachers see the pass marks of their subject.
  const grid = await api(SARA, 'GET', `${url}/marks?subjectId=${ids.English}`);
  assert.equal(grid.body.subject.passMarks, 25);
  assert.equal((await api(ADMIN, 'DELETE', url)).status, 200);
});
