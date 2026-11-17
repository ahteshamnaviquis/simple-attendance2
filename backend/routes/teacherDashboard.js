// /api/teacher-dashboard - one teacher's own summary (teachers only).
//
//   GET /?to=YYYY-MM-DD&days=30
//
// Returns:
//   classes:       every class they teach, as class teacher and/or subject
//                  teacher, with the subjects and the number of students
//                  (boys, girls)
//   totalStudents: the students in those classes (each counted once)
//   messages:      their conversations with parents: how many, messages
//                  received from parents (read and unread) and sent
//   missed:        the school days in the period on which a class they are
//                  class teacher of has no attendance report
//   pendingToday:  their classes with no report yet for `to` (today)
//
// A school day is a date on which any class submitted attendance (the same
// rule as the dashboard's tracker), so holidays and weekends never count as
// missed. `to` is the teacher's today (their device's date); the period is the
// `days` days before it. Today itself is never "missed", only pending.

const express = require('express');
const { readData } = require('../store');
const { HttpError, requireRole } = require('../helpers');

const router = express.Router();
router.use(requireRole('teacher'));

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function localToday() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysBefore(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

router.get('/', async (req, res) => {
  const to = req.query.to ?? localToday();
  if (!DATE.test(to)) throw new HttpError(400, 'to must be a date (YYYY-MM-DD)');
  const days = req.query.days === undefined ? 30 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new HttpError(400, 'days must be from 1 to 366');
  const from = daysBefore(to, days);

  const [classes, classSubjects, subjects, students, reports, messages] = await Promise.all([
    readData('classes'),
    readData('classSubjects'),
    readData('subjects'),
    readData('students'),
    readData('attendance'),
    readData('messages'),
  ]);
  const me = req.user.id;

  // The classes they teach, class teacher ones first.
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name ?? 'Subject';
  const mine = classes
    .map((cls) => {
      const isClassTeacher = cls.teacherId === me;
      const taught = classSubjects
        .filter((cs) => cs.classId === cls.id && cs.teacherId === me)
        .map((cs) => subjectName(cs.subjectId))
        .sort((a, b) => a.localeCompare(b));
      if (!isClassTeacher && taught.length === 0) return null;
      const inClass = students.filter((s) => s.classId === cls.id);
      return {
        id: cls.id,
        name: cls.name,
        isClassTeacher,
        subjects: taught,
        students: inClass.length,
        boys: inClass.filter((s) => s.gender === 'male').length,
        girls: inClass.filter((s) => s.gender === 'female').length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.isClassTeacher - a.isClassTeacher || a.name.localeCompare(b.name));

  // Missed and pending attendance (class teacher classes only).
  const ownClasses = mine.filter((c) => c.isClassTeacher);
  const reported = new Set(reports.map((r) => `${r.classId}|${r.date}`));
  const schoolDays = [...new Set(reports.map((r) => r.date))]
    .filter((date) => date > from && date < to)
    .sort((a, b) => b.localeCompare(a));
  const missed = schoolDays.flatMap((date) =>
    ownClasses
      .filter((c) => !reported.has(`${c.id}|${date}`))
      .map((c) => ({ date, classId: c.id, className: c.name }))
  );
  const pendingToday = ownClasses
    .filter((c) => !reported.has(`${c.id}|${to}`))
    .map((c) => ({ classId: c.id, className: c.name }));

  // Their conversations with parents.
  const threads = messages.filter((m) => m.teacherId === me);
  const received = threads.filter((m) => !m.fromSchool);

  res.json({
    from,
    to,
    days,
    classes: mine,
    totalStudents: new Set(students.filter((s) => mine.some((c) => c.id === s.classId)).map((s) => s.id)).size,
    messages: {
      conversations: new Set(threads.map((m) => m.parentId)).size,
      received: received.length,
      read: received.filter((m) => m.readAt).length,
      unread: received.filter((m) => !m.readAt).length,
      sent: threads.filter((m) => m.fromSchool).length,
    },
    schoolDays: schoolDays.length,
    missed,
    pendingToday,
  });
});

module.exports = router;
