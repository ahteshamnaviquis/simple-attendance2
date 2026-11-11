// Adds demo data to the diary, leaves, complaints & suggestions and gallery
// pages, built from the users, classes, students and parents already in the
// database (so it works on a real school's data, not only the sample data).
//
//   Diary        homework and notes for every class for the last 10 school days,
//                written by each subject's teacher
//   Leaves       for parents' children: approved, rejected and pending leaves
//   Complaints   from parents and teachers, some answered by the office
//   Gallery      school albums and one album per class, with generated pictures
//
// Every row it adds has an id starting with "demo-", so it can tell its own rows
// from real ones:
//   - Running it again adds only what is missing (nothing is duplicated).
//   - A page that already has real (non-demo) data is left alone, unless you
//     pass --force.
//   - It never changes or removes real data, and it never changes the tables.
//
// Run from the backend folder:
//   npm run demo-school-life                  add what is missing
//   npm run demo-school-life -- --dry-run     only show what it would do
//   npm run demo-school-life -- --refresh     replace the demo rows (fresh dates)
//   npm run demo-school-life -- --remove      remove every demo row
//   npm run demo-school-life -- --force       also fill pages that have real data
//   npm run demo-school-life -- --only=diary,gallery   (diary, leaves, feedback, gallery)
//
// Production: point it at that database with DATABASE_URL (or the DB_* values),
// for example
//   DATABASE_URL="mysql://user:password@host:3306/attendance" npm run demo-school-life -- --yes
// Any database not on this computer needs --yes; without it the script only
// shows what it would do.

const crypto = require('crypto');
const zlib = require('zlib');
const { DB } = require('../config');
const { readData, updateMany, closeDatabase, writeFile } = require('../store');

// ---------- Options ----------

const args = process.argv.slice(2);
const has = (flag) => args.includes(flag);
const SECTIONS = ['diary', 'leaves', 'feedback', 'gallery'];
const onlyArg = args.find((a) => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : SECTIONS;
for (const name of ONLY) {
  if (!SECTIONS.includes(name)) {
    console.error(`Unknown section "${name}". Use: ${SECTIONS.join(', ')}`);
    process.exit(1);
  }
}
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(DB.host);
const DRY_RUN = has('--dry-run') || (!isLocal && !has('--yes'));
const REMOVE = has('--remove');
const REFRESH = has('--refresh');
const FORCE = has('--force');

// The tables of each section, and the collection whose rows decide whether a
// page "has data".
const TABLES = {
  diary: ['diary'],
  leaves: ['leaves'],
  feedback: ['feedback'],
  gallery: ['galleryAlbums', 'galleryPhotos'],
};

// ---------- Small helpers ----------

// Same key -> same id, so a second run finds the rows of the first one.
const demoId = (kind, ...parts) =>
  `demo-${kind}-${crypto.createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 16)}`;
const isDemo = (row) => String(row.id).startsWith('demo-');

let seed = 20261110;
function random() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (list) => list[Math.floor(random() * list.length)];

const pad = (n) => String(n).padStart(2, '0');
function dateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return dateString(d);
}
// A time on a day (local time), as the ISO text the app stores.
const at = (date, hour, minute = 0) => new Date(`${date}T${pad(hour)}:${pad(minute)}:00`).toISOString();
const isSunday = (date) => new Date(`${date}T00:00:00`).getDay() === 0;

// The last `count` school days (no Sundays), oldest first, ending today.
function schoolDays(count) {
  const days = [];
  for (let back = 0; days.length < count; back++) {
    const date = addDays(-back);
    if (!isSunday(date)) days.unshift(date);
  }
  return days;
}

// ---------- Diary ----------

const HOMEWORK = {
  english: [
    ['Essay writing', 'Write an essay of 200 words on "My Favourite Season". Underline the adjectives you use.'],
    ['Grammar', 'Exercise 4 (A and B) on active and passive voice, page 52. Learn the rules in the box.'],
    ['Comprehension', 'Read the lesson "The Last Leaf" and answer questions 1 to 5 in the notebook.'],
    ['Vocabulary', 'Learn the meanings of the 15 new words from Unit 6 and make a sentence with each. Test on Thursday.'],
  ],
  mathematics: [
    ['Exercise 3.2', 'Solve questions 1 to 10 of Exercise 3.2 (logarithms). Show every step.'],
    ['Quadratic equations', 'Solve Q1 to Q8 of Exercise 2.1 using the quadratic formula. Revise the factorisation method.'],
    ['Practice sheet', 'Complete the practice sheet given in class. A short test on the whole unit next week.'],
    ['Matrices', 'Exercise 1.4, questions 2, 4, 6 and 8. Bring the geometry box tomorrow.'],
  ],
  urdu: [
    ['Mazmoon', 'Write a mazmoon on "Waqt ki Pabandi" in about 150 words.'],
    ['Nazm', 'Learn the first two stanzas of the nazm by heart. Recitation in class tomorrow.'],
    ['Grammar', 'Exercise of chapter 5: find the ism, fail and harf in the given sentences.'],
  ],
  physics: [
    ['Numericals', 'Solve numericals 2.1 to 2.6 from the end of chapter 2 (kinematics).'],
    ['Practical', 'Write the practical "To find the acceleration of a ball rolling down an inclined plane" in the practical notebook.'],
    ['Short questions', 'Learn the short questions of chapter 3 (Dynamics). Quiz on Friday.'],
  ],
  chemistry: [
    ['Periodic table', 'Learn the first 20 elements with their symbols and atomic numbers.'],
    ['Chapter 4 exercise', 'Answer the multiple choice and short questions at the end of chapter 4 (Structure of molecules).'],
    ['Practical notebook', 'Draw the diagram of the apparatus for the preparation of oxygen gas.'],
  ],
  biology: [
    ['Diagram', 'Draw and label the diagram of the animal cell and the plant cell on a practical page.'],
    ['Long question', 'Write the long question "Explain the process of photosynthesis" in the notebook.'],
    ['Revision', 'Revise chapter 5 (Cell cycle). A test will be taken on Monday.'],
  ],
  islamiyat: [
    ['Ayat translation', 'Learn the translation of the first five ayat of Surah Al-Hujurat.'],
    ['Short questions', 'Write the answers to short questions 1 to 6 of the lesson "Huqooq ul Ibad".'],
  ],
  'pakistan studies': [
    ['Map work', 'Mark the provinces, their capitals and the main rivers of Pakistan on the outline map.'],
    ['Chapter 2', 'Read chapter 2 (Making of Pakistan) and answer questions 1 to 4.'],
  ],
  'computer science': [
    ['Flowchart', 'Draw a flowchart to find the largest of three numbers.'],
    ['Chapter review', 'Answer the short questions of chapter 2 (Number systems). Practise binary to decimal conversion.'],
    ['Lab task', 'Write the steps to make a table in a word processor. Practical in the computer lab on Wednesday.'],
  ],
};
const GENERAL_HOMEWORK = [
  ['Revision', 'Revise today\'s lesson and complete the class work in the notebook.'],
  ['Exercise', 'Complete the remaining questions of the exercise done in class.'],
  ['Test preparation', 'Prepare the chapter for a short test this week.'],
];
const CLASS_NOTES = [
  ['Parent-teacher meeting', 'The parent-teacher meeting is on Saturday from 9:00 to 12:00. Parents are requested to attend.'],
  ['Uniform', 'Students must come in full winter uniform from Monday. Name tags are compulsory.'],
  ['Monthly test', 'The monthly tests start next week. The date sheet has been pasted in the diary.'],
  ['Fee reminder', 'Please clear this month\'s fee by the 10th to avoid the late fee.'],
  ['Library books', 'Students who borrowed library books must return them by Friday.'],
];

function buildDiary(school) {
  const rows = [];
  const days = schoolDays(10);
  for (const cls of school.classes) {
    const teaching = school.classSubjects
      .filter((cs) => cs.classId === cls.id)
      .map((cs) => ({ cs, subject: school.subjects.find((s) => s.id === cs.subjectId) }))
      .filter((x) => x.subject);
    const classTeacher = school.users.find((u) => u.id === cls.teacherId) || school.admin;

    days.forEach((date, dayIndex) => {
      // Two subjects a day, taking turns through the class's subjects.
      for (let slot = 0; slot < 2 && teaching.length; slot++) {
        const { cs, subject } = teaching[(dayIndex * 2 + slot) % teaching.length];
        const writer = school.users.find((u) => u.id === cs.teacherId) || classTeacher;
        if (!writer) continue;
        const [title, body] = pick(HOMEWORK[subject.name.toLowerCase()] || GENERAL_HOMEWORK);
        const time = at(date, 13 + slot, 10 + Math.floor(random() * 40));
        rows.push({
          id: demoId('diary', cls.id, date, slot),
          classId: cls.id,
          className: cls.name,
          subjectId: subject.id,
          subjectName: subject.name,
          date,
          title,
          body,
          createdById: writer.id,
          createdBy: writer.name,
          createdAt: time,
          updatedAt: time,
        });
      }
      // A note for the whole class every few days.
      if (dayIndex % 4 === 1 && classTeacher) {
        const [title, body] = CLASS_NOTES[(dayIndex + rows.length) % CLASS_NOTES.length];
        const time = at(date, 14, 30);
        rows.push({
          id: demoId('diary', cls.id, date, 'note'),
          classId: cls.id,
          className: cls.name,
          subjectId: null,
          subjectName: null,
          date,
          title,
          body,
          createdById: classTeacher.id,
          createdBy: classTeacher.name,
          createdAt: time,
          updatedAt: time,
        });
      }
    });
  }
  return { diary: rows };
}

// ---------- Leaves ----------

// [first day, last day] counted from today, the reason, and how it was decided.
const LEAVE_PLANS = [
  { from: -12, to: -11, status: 'approved', note: 'Get well soon.', reason: 'He/she had high fever and the doctor advised two days of rest.' },
  { from: -5, to: -5, status: 'rejected', note: 'The monthly test is on this day. Please send your child to school.', reason: 'We have to attend a family function in another city.' },
  { from: 2, to: 4, status: 'pending', note: '', reason: 'We are travelling to our village for my cousin\'s wedding.' },
  { from: -20, to: -18, status: 'approved', note: 'Approved. Please make sure the missed class work is completed.', reason: 'Family emergency, we had to travel to Lahore.' },
  { from: 6, to: 6, status: 'pending', note: '', reason: 'Dental appointment in the morning.' },
];

function leaveReason(text, child) {
  const he = child.gender === 'female' ? 'She' : 'He';
  return text.replace('He/she', he);
}

function buildLeaves(school) {
  const rows = [];
  let childIndex = 0;
  for (const link of school.parentStudents) {
    const parent = school.users.find((u) => u.id === link.parentId && u.role === 'parent');
    const child = school.students.find((s) => s.id === link.studentId);
    if (!parent || !child) continue;
    const cls = school.classes.find((c) => c.id === child.classId);
    const reviewer = school.users.find((u) => u.id === cls?.teacherId) || school.admin;

    // Each child gets two or three of the plans, starting at a different one.
    const count = 2 + (childIndex % 2);
    for (let i = 0; i < count; i++) {
      const planIndex = (childIndex + i) % LEAVE_PLANS.length;
      const plan = LEAVE_PLANS[planIndex];
      const fromDate = addDays(plan.from);
      const toDate = addDays(plan.to);
      const createdAt = at(addDays(Math.min(plan.from, 0) - 2), 20, 15);
      const decided = plan.status !== 'pending';
      rows.push({
        id: demoId('leave', child.id, planIndex),
        studentId: child.id,
        studentName: child.name,
        classId: child.classId,
        className: cls?.name ?? '',
        parentId: parent.id,
        parentName: parent.name,
        fromDate,
        toDate,
        reason: leaveReason(plan.reason, child),
        status: plan.status,
        reviewNote: plan.note,
        reviewedById: decided && reviewer ? reviewer.id : null,
        reviewedBy: decided && reviewer ? reviewer.name : null,
        reviewedAt: decided ? at(addDays(Math.min(plan.from, 0) - 1), 9, 30) : null,
        createdAt,
      });
    }
    childIndex++;
  }
  return { leaves: rows };
}

// ---------- Complaints & suggestions ----------

const PARENT_FEEDBACK = [
  {
    kind: 'complaint', subject: 'School van is often late',
    body: 'The school van has reached our stop 20 to 25 minutes late almost every day this week, so the children miss the assembly. Please look into it.',
    reply: 'Thank you for telling us. We have spoken to the van driver and changed the route so your stop comes earlier. Please let us know if it happens again.',
    childLinked: true,
  },
  {
    kind: 'suggestion', subject: 'Weekly progress update',
    body: 'It would be very helpful if teachers could send a short weekly update about the child\'s progress in each subject.',
    reply: '',
    childLinked: false,
  },
  {
    kind: 'complaint', subject: 'Drinking water on the first floor',
    body: 'My child told me the water cooler on the first floor has not been working for a few days. Children have to go downstairs during class.',
    reply: 'The cooler has been repaired and a second one has been placed near the stairs. Thank you for pointing this out.',
    childLinked: true,
  },
  {
    kind: 'suggestion', subject: 'Extra classes before the board exams',
    body: 'Please arrange extra Mathematics and Physics classes on Saturdays before the board exams.',
    reply: '',
    childLinked: true,
  },
];
const TEACHER_FEEDBACK = [
  {
    kind: 'suggestion', subject: 'Projector for the science lab',
    body: 'A projector in the science lab would help a lot in showing experiments and diagrams to the whole class.',
    reply: 'Good idea. A projector has been included in next month\'s purchase list.',
  },
  {
    kind: 'complaint', subject: 'Classroom fans not working',
    body: 'Two of the four fans in my classroom have stopped working. It gets very hot in the afternoon periods.',
    reply: '',
  },
  {
    kind: 'suggestion', subject: 'Reading period in the library',
    body: 'We could have one library period a week for every class to build the reading habit.',
    reply: '',
  },
];

function buildFeedback(school) {
  const rows = [];
  const office = school.admin;
  const add = (item, from, student, key, daysAgo) => {
    const answered = Boolean(item.reply) && office;
    const createdAt = at(addDays(-daysAgo), 19, 5 + (rows.length * 7) % 50);
    rows.push({
      id: demoId('feedback', from.id, key),
      kind: item.kind,
      subject: item.subject,
      body: item.body,
      fromId: from.id,
      fromName: from.name,
      fromRole: from.role,
      studentId: student?.id ?? null,
      studentName: student?.name ?? null,
      status: answered ? 'resolved' : 'open',
      reply: answered ? item.reply : '',
      repliedBy: answered ? office.name : null,
      repliedAt: answered ? at(addDays(-daysAgo + 1), 11, 0) : null,
      createdAt,
    });
  };

  const parents = school.users.filter((u) => u.role === 'parent');
  parents.forEach((parent, p) => {
    const children = school.parentStudents
      .filter((l) => l.parentId === parent.id)
      .map((l) => school.students.find((s) => s.id === l.studentId))
      .filter(Boolean);
    for (let i = 0; i < 2; i++) {
      const index = (p * 2 + i) % PARENT_FEEDBACK.length;
      const item = PARENT_FEEDBACK[index];
      const child = item.childLinked ? children[i % Math.max(children.length, 1)] : null;
      add(item, parent, child, `parent-${index}`, 3 + p * 4 + i * 6);
    }
  });

  const teachers = school.users.filter((u) => u.role === 'teacher');
  TEACHER_FEEDBACK.forEach((item, i) => {
    const teacher = teachers[i % Math.max(teachers.length, 1)];
    if (teacher) add(item, teacher, null, `teacher-${i}`, 2 + i * 5);
  });

  return { feedback: rows };
}

// ---------- Gallery ----------

// Pictures are drawn here (no image files needed): a sky, hills, a sun and
// some coloured shapes, in the album's colours.
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}
function makePng(width, height, colourAt) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < width; x++) {
      const [r, g, b] = colourAt(x, y);
      raw[row + 1 + x * 3] = r;
      raw[row + 2 + x * 3] = g;
      raw[row + 3 + x * 3] = b;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

function drawPicture(theme, variant) {
  const W = 640;
  const H = 420;
  const sky = [hex(theme.sky[0]), hex(theme.sky[1])];
  const ground = hex(theme.ground);
  const hill = hex(theme.hill);
  const sunX = 120 + ((variant * 173) % 400);
  const sunY = 70 + ((variant * 37) % 50);
  // Bright shapes: balloons, flags or people, depending on the album.
  const shapes = Array.from({ length: 9 }, (_, i) => ({
    x: 40 + ((i * 71 + variant * 53) % 560),
    y: 230 + ((i * 29 + variant * 17) % 120),
    r: 14 + ((i * 7 + variant) % 14),
    colour: hex(theme.accents[(i + variant) % theme.accents.length]),
  }));
  return makePng(W, H, (x, y) => {
    // Shapes in front.
    for (const s of shapes) {
      const dx = x - s.x;
      const dy = y - s.y;
      if (theme.shape === 'flag') {
        if (dx >= 0 && dx < s.r * 2 && dy >= 0 && dy < s.r * 1.3) return s.colour;
        if (dx >= -2 && dx < 0 && dy >= 0 && dy < s.r * 3.5) return [90, 70, 50];
      } else if (theme.shape === 'person') {
        if (dx * dx + (dy + s.r * 1.4) ** 2 < (s.r * 0.6) ** 2) return [222, 180, 140];
        if (Math.abs(dx) < s.r * 0.7 && dy > -s.r * 0.8 && dy < s.r * 1.2) return s.colour;
      } else if (dx * dx + dy * dy < s.r * s.r) {
        return mix(s.colour, [255, 255, 255], Math.max(0, (-dx - dy) / (s.r * 3)));
      }
    }
    const hillTop = 250 + 30 * Math.sin((x + variant * 90) / 70) + 15 * Math.sin(x / 23);
    if (y > 330 + 6 * Math.sin(x / 40)) return mix(ground, [0, 0, 0], (y - 330) / 400);
    if (y > hillTop) return mix(hill, ground, (y - hillTop) / 120);
    const sd = Math.hypot(x - sunX, y - sunY);
    if (sd < 34) return [255, 236, 150];
    const glow = Math.max(0, 1 - sd / 120) * 0.35;
    return mix(mix(sky[0], sky[1], y / 260), [255, 245, 200], glow);
  });
}

const SCHOOL_ALBUMS = [
  {
    key: 'sports', title: 'Annual Sports Day', daysAgo: 18, photos: 5,
    description: 'Races, tug of war and the prize distribution at the annual sports day.',
    theme: { sky: ['#5aa9e6', '#cfe8fc'], hill: '#6aa84f', ground: '#3d7a2a', shape: 'person', accents: ['#e63946', '#f4a261', '#2a9d8f', '#457b9d'] },
  },
  {
    key: 'science', title: 'Science Exhibition', daysAgo: 32, photos: 4,
    description: 'Students showed their working models and experiments to parents and guests.',
    theme: { sky: ['#7b6cf6', '#e0dcff'], hill: '#8e7dbe', ground: '#4a3f7a', shape: 'balloon', accents: ['#ffbe0b', '#fb5607', '#ff006e', '#3a86ff'] },
  },
  {
    key: 'independence', title: 'Independence Day Celebration', daysAgo: 90, photos: 4,
    description: 'Flag hoisting, national songs and tableaux on 14th August.',
    theme: { sky: ['#9ad1f5', '#f1f9ff'], hill: '#1b7a3a', ground: '#0f5a28', shape: 'flag', accents: ['#01411c', '#ffffff', '#1b7a3a'] },
  },
];
const CLASS_ALBUM = {
  key: 'trip', title: 'Class Trip', daysAgo: 11, photos: 3,
  description: 'Our class visit to the museum and the park.',
  theme: { sky: ['#f7a072', '#ffe5d0'], hill: '#90be6d', ground: '#577590', shape: 'balloon', accents: ['#f94144', '#f9c74f', '#43aa8b', '#277da1'] },
};

// Albums and photo rows; the pictures are drawn later, only for the photos
// that are really added.
function buildGallery(school) {
  const albums = [];
  const photos = [];
  const add = (spec, owner, cls) => {
    if (!owner) return;
    const date = addDays(-spec.daysAgo);
    const album = {
      id: demoId('album', spec.key, cls?.id ?? 'school'),
      title: cls ? `${cls.name} - ${spec.title}` : spec.title,
      description: spec.description,
      date,
      classId: cls?.id ?? null,
      className: cls?.name ?? null,
      createdById: owner.id,
      createdBy: owner.name,
      createdAt: at(date, 17, 0),
    };
    albums.push(album);
    const offset = albums.length * 3; // each album gets different pictures
    for (let i = 0; i < spec.photos; i++) {
      photos.push({
        id: demoId('photo', album.id, i),
        albumId: album.id,
        type: 'image/png',
        createdBy: owner.name,
        createdAt: at(date, 17, 1 + i),
        draw: () => drawPicture(spec.theme, i + offset),
      });
    }
  };
  for (const spec of SCHOOL_ALBUMS) add(spec, school.admin);
  for (const cls of school.classes) {
    add(CLASS_ALBUM, school.users.find((u) => u.id === cls.teacherId) || school.admin, cls);
  }
  return { galleryAlbums: albums, galleryPhotos: photos };
}

const BUILDERS = { diary: buildDiary, leaves: buildLeaves, feedback: buildFeedback, gallery: buildGallery };

// ---------- Main ----------

async function checkTables() {
  try {
    await readData('galleryPhotos');
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_DB_ERROR') {
      throw new Error(
        `The tables are missing in "${DB.database}". Start the server once (or run npm run setup-db) so it creates them, then run this again.`
      );
    }
    throw err;
  }
}

async function loadSchool() {
  const names = ['users', 'classes', 'students', 'subjects', 'classSubjects', 'parentStudents'];
  const lists = await Promise.all(names.map((n) => readData(n)));
  const school = Object.fromEntries(names.map((n, i) => [n, lists[i]]));
  const active = (u) => !u.disabled;
  school.users = school.users.filter(active);
  school.admin =
    school.users.find((u) => u.role === 'admin') || school.users.find((u) => u.role === 'superadmin') || null;
  return school;
}

async function main() {
  console.log(`Database: ${DB.database} on ${DB.host}:${DB.port}${DRY_RUN ? '  (dry run: nothing is saved)' : ''}`);
  if (!isLocal && !has('--yes') && !has('--dry-run')) {
    console.log('This database is not on this computer. Add --yes to save the changes.\n');
  }
  await checkTables();
  const school = await loadSchool();
  if (!school.classes.length) throw new Error('There are no classes yet. Add classes (and students) first.');

  const tables = ONLY.flatMap((s) => TABLES[s]);
  const result = await updateMany(tables, async (current, conn) => {
    const changed = {};
    const report = [];

    for (const section of ONLY) {
      const names = TABLES[section];
      const main = names[0];
      // 1. Take the old demo rows out when removing or refreshing.
      if (REMOVE || REFRESH) {
        for (const name of names) {
          const before = (changed[name] ?? current[name]).length;
          changed[name] = (changed[name] ?? current[name]).filter((row) => !isDemo(row));
          const removed = before - changed[name].length;
          if (removed) report.push(`${name}: ${removed} demo rows removed`);
        }
        if (section === 'gallery' && !DRY_RUN) {
          // (the first academy's files: "default:gallery-demo-...")
          const [res] = await conn.query("DELETE FROM files WHERE name LIKE 'default:gallery-demo-%'");
          if (res.affectedRows) report.push(`files: ${res.affectedRows} demo pictures removed`);
        }
        if (REMOVE) continue;
      }

      // 2. Leave a page with real data alone (unless --force).
      const list = changed[main] ?? current[main];
      const real = list.filter((row) => !isDemo(row)).length;
      if (real && !FORCE) {
        report.push(`${section}: skipped, it already has ${real} real rows (use --force to add demo rows anyway)`);
        continue;
      }

      // 3. Add the demo rows that are not there yet.
      const built = BUILDERS[section](school);
      for (const name of names) {
        const existing = changed[name] ?? current[name];
        const ids = new Set(existing.map((row) => row.id));
        const fresh = built[name].filter((row) => !ids.has(row.id));
        if (name === 'galleryPhotos' && !DRY_RUN) {
          for (const photo of fresh) {
            await writeFile(`gallery-${photo.id}`, photo.type, photo.draw(), conn);
          }
        }
        const clean = fresh.map(({ draw, ...row }) => row);
        changed[name] = [...existing, ...clean];
        report.push(`${name}: ${clean.length} added${clean.length < built[name].length ? `, ${built[name].length - clean.length} already there` : ''}`);
      }
    }

    console.log(report.map((line) => `  ${line}`).join('\n') || '  nothing to do');
    // A dry run changes nothing: throwing rolls the transaction back.
    if (DRY_RUN) throw Object.assign(new Error('dry run'), { dryRun: true });
    return changed;
  }).catch((err) => {
    if (err.dryRun) return null;
    throw err;
  });

  if (result) console.log('Done.');
  else console.log(isLocal || has('--dry-run') ? 'Dry run: nothing was saved.' : 'Nothing was saved. Run again with --yes to save.');
}

main()
  .catch((err) => {
    console.error('Could not add the demo data:', err.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);
