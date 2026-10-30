// /api/class-subjects - which subjects each class studies, and who teaches each one.
//
// A row: { id, classId, subjectId, teacherId }   (teacherId is null when unassigned)
//
// - One row per class + subject.
// - The subject teacher is separate from the class teacher (classes.teacherId), who
//   still takes attendance and manages the class's students.
// - Examinations use these rows to decide which teacher may enter marks for a subject.
// - Only admins with the subjects permission change assignments. Exams keep their own copy of subject names and
//   maximum marks, so changing an assignment never changes saved marks.

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, requireLogin, requireArea } = require('../helpers');

const router = express.Router();

// Add class, subject and teacher names for the screens.
function describe(rows, classes, subjects, users) {
  return rows
    .map((row) => ({
      ...row,
      className: classes.find((c) => c.id === row.classId)?.name ?? '',
      subjectName: subjects.find((s) => s.id === row.subjectId)?.name ?? '',
      teacherName: users.find((u) => u.id === row.teacherId)?.name ?? null,
    }))
    .sort((a, b) => a.className.localeCompare(b.className) || a.subjectName.localeCompare(b.subjectName));
}

// GET /api/class-subjects?classId=...
// Admins see every class; teachers see only the subjects they teach.
router.get('/', requireLogin, async (req, res) => {
  const [rows, classes, subjects, users] = await Promise.all([
    readData('classSubjects'),
    readData('classes'),
    readData('subjects'),
    readData('users'),
  ]);
  let list = rows;
  if (req.user.role === 'teacher') list = list.filter((r) => r.teacherId === req.user.id);
  if (req.query.classId) list = list.filter((r) => r.classId === req.query.classId);
  res.json(describe(list, classes, subjects, users));
});

// PUT /api/class-subjects/:classId - set the whole subject list of one class.
// Body: { subjects: [{ subjectId, teacherId }] }
// Subjects that stay keep their row id; subjects left out are removed from the class.
router.put('/:classId', requireArea('subjects'), async (req, res) => {
  const items = Array.isArray(req.body?.subjects) ? req.body.subjects : null;
  if (!items) throw new HttpError(400, 'No subjects were sent');

  const [classes, subjects, users] = await Promise.all([
    readData('classes'),
    readData('subjects'),
    readData('users'),
  ]);
  const cls = classes.find((c) => c.id === req.params.classId);
  if (!cls) throw new HttpError(404, 'Class not found');

  const seen = new Set();
  const wanted = items.map((item) => {
    const subject = subjects.find((s) => s.id === String(item?.subjectId ?? ''));
    if (!subject) throw new HttpError(400, 'Please choose a valid subject for every row');
    if (seen.has(subject.id)) throw new HttpError(400, `${subject.name} is listed twice`);
    seen.add(subject.id);

    const teacherId = item?.teacherId ? String(item.teacherId) : null;
    if (teacherId && !users.some((u) => u.id === teacherId && u.role === 'teacher')) {
      throw new HttpError(400, `The teacher chosen for ${subject.name} does not exist`);
    }
    return { subjectId: subject.id, teacherId };
  });

  let saved;
  await updateData('classSubjects', (rows) => {
    const others = rows.filter((r) => r.classId !== cls.id);
    const current = rows.filter((r) => r.classId === cls.id);
    saved = wanted.map((w) => {
      const existing = current.find((r) => r.subjectId === w.subjectId);
      return existing ? { ...existing, teacherId: w.teacherId } : { id: newId(), classId: cls.id, ...w };
    });
    return [...others, ...saved];
  });
  res.json(describe(saved, classes, subjects, users));
});

module.exports = router;
