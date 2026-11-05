// /api/diary - the class diary: homework and notes for a class on a day.
//
//   GET    /?from=&to=&classId=&studentId=  entries the user may read (default: the last 14 days
//                                           up to 7 days ahead), newest date first
//   GET    /options                         the classes and subjects the user may write for
//   POST   /        { classId, subjectId, date, title, body }
//   PUT    /:id     { subjectId, date, title, body }   (the class can't change)
//   DELETE /:id
//
// Rules:
// - Reading: admins and the super admin see every class; a teacher the classes
//   they teach (class teacher or subject teacher); a parent their children's
//   classes (studentId picks one child).
// - Writing: admins and the super admin for any class and subject. The class
//   teacher for their class (any of its subjects, or none). A subject teacher
//   only for the subjects they teach in that class.
// - Editing and removing: the person who wrote it (while they still may write
//   for that class and subject), or an admin / the super admin.
// - The entry keeps the class, subject and writer's names as text.

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, isValidDate, todayString, requireRole } = require('../helpers');
const { isOffice, readableClassIds, childrenOf, cleanText } = require('../schoolAccess');

const router = express.Router();
router.use(requireRole('superadmin', 'admin', 'teacher', 'parent'));

const MAX_BODY = 4000;
const MAX_RANGE_DAYS = 366;

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function loadSchool() {
  const [classes, classSubjects, subjects, students, parentStudents] = await Promise.all([
    readData('classes'),
    readData('classSubjects'),
    readData('subjects'),
    readData('students'),
    readData('parentStudents'),
  ]);
  return { classes, classSubjects, subjects, students, parentStudents };
}

// What the user may write: [{ classId, className, general, subjects: [{ subjectId, subjectName }] }].
// general: may write an entry with no subject (the class teacher and the office).
function writeOptions(user, { classes, classSubjects, subjects }) {
  if (user.role === 'parent') return [];
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? '';
  return classes
    .map((cls) => {
      const own = isOffice(user) || cls.teacherId === user.id;
      const list = classSubjects
        .filter((cs) => cs.classId === cls.id && (own || cs.teacherId === user.id))
        .map((cs) => ({ subjectId: cs.subjectId, subjectName: subjectName(cs.subjectId) }))
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName));
      if (!own && list.length === 0) return null;
      return { classId: cls.id, className: cls.name, general: own, subjects: list };
    })
    .filter(Boolean)
    .sort((a, b) => a.className.localeCompare(b.className));
}

// The class and subject of an entry, checked against what the user may write.
function checkTarget(user, school, classId, subjectId) {
  const option = writeOptions(user, school).find((o) => o.classId === classId);
  if (!option) throw new HttpError(403, 'You can only write the diary for the classes you teach');
  if (!subjectId) {
    if (!option.general) throw new HttpError(400, 'Please choose the subject you teach');
    return { classId, className: option.className, subjectId: null, subjectName: null };
  }
  const subject = option.subjects.find((s) => s.subjectId === subjectId);
  if (!subject) throw new HttpError(403, 'You can only write the diary for the subjects you teach in this class');
  return { classId, className: option.className, subjectId, subjectName: subject.subjectName };
}

function cleanEntry(body) {
  const date = String(body?.date ?? '');
  if (!isValidDate(date)) throw new HttpError(400, 'Please choose a valid date');
  return {
    date,
    title: cleanText(body?.title, 'title', 150, { required: false }),
    body: cleanText(body?.body, 'diary text', MAX_BODY),
  };
}

function canChange(user, entry, school) {
  if (isOffice(user)) return true;
  if (entry.createdById !== user.id) return false;
  try {
    checkTarget(user, school, entry.classId, entry.subjectId);
    return true;
  } catch {
    return false;
  }
}

// GET /api/diary/options
router.get('/options', async (req, res) => {
  res.json(writeOptions(req.user, await loadSchool()));
});

// GET /api/diary?from=&to=&classId=&studentId=
router.get('/', async (req, res) => {
  const school = await loadSchool();
  const today = todayString();
  const to = req.query.to || shiftDate(today, 7);
  const from = req.query.from || shiftDate(today, -13);
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Please choose valid dates');
  if (from > to) throw new HttpError(400, 'The start date must be before the end date');
  if (shiftDate(from, MAX_RANGE_DAYS) < to) throw new HttpError(400, 'Please choose at most one year');

  let allowed = readableClassIds(req.user, school);
  if (req.query.studentId) {
    const child = childrenOf(req.user, school.parentStudents, school.students).find((s) => s.id === req.query.studentId);
    if (req.user.role !== 'parent' || !child) throw new HttpError(403, 'This student is not linked to your account');
    allowed = new Set([child.classId]);
  }
  const classId = req.query.classId || '';

  const entries = (await readData('diary'))
    .filter((e) => e.date >= from && e.date <= to)
    .filter((e) => !allowed || allowed.has(e.classId))
    .filter((e) => !classId || e.classId === classId)
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        a.className.localeCompare(b.className) ||
        (a.subjectName ?? '').localeCompare(b.subjectName ?? '')
    )
    .map((e) => ({ ...e, canEdit: canChange(req.user, e, school) }));
  res.json({ from, to, entries });
});

// POST /api/diary
router.post('/', async (req, res) => {
  const school = await loadSchool();
  const target = checkTarget(req.user, school, String(req.body?.classId ?? ''), req.body?.subjectId || null);
  const now = new Date().toISOString();
  const entry = {
    id: newId(),
    ...target,
    ...cleanEntry(req.body),
    createdById: req.user.id,
    createdBy: req.user.name,
    createdAt: now,
    updatedAt: now,
  };
  await updateData('diary', (list) => [...list, entry]);
  res.status(201).json(entry);
});

// PUT /api/diary/:id
router.put('/:id', async (req, res) => {
  const school = await loadSchool();
  const fields = cleanEntry(req.body);
  let saved;
  await updateData('diary', (list) => {
    const entry = list.find((e) => e.id === req.params.id);
    if (!entry) throw new HttpError(404, 'Diary entry not found');
    if (!canChange(req.user, entry, school)) throw new HttpError(403, 'You can only change your own diary entries');
    // The same subject stays as it is (even if the class no longer studies it).
    const subjectId = req.body?.subjectId || null;
    const target = subjectId === entry.subjectId ? entry : checkTarget(req.user, school, entry.classId, subjectId);
    saved = { ...entry, ...fields, subjectId: target.subjectId, subjectName: target.subjectName, updatedAt: new Date().toISOString() };
    return list.map((e) => (e.id === entry.id ? saved : e));
  });
  res.json(saved);
});

// DELETE /api/diary/:id
router.delete('/:id', async (req, res) => {
  const school = await loadSchool();
  await updateData('diary', (list) => {
    const entry = list.find((e) => e.id === req.params.id);
    if (!entry) throw new HttpError(404, 'Diary entry not found');
    if (!canChange(req.user, entry, school)) throw new HttpError(403, 'You can only remove your own diary entries');
    return list.filter((e) => e.id !== entry.id);
  });
  res.json({ ok: true });
});

module.exports = router;
