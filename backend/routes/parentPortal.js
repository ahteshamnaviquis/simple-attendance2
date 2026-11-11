// /api/parent - what a logged-in parent sees: their own children only.
//
//   GET  /children                          each child with class, teachers, subjects and a short summary
//   GET  /children/:studentId/attendance    the child's day-by-day attendance (?from=&to=, default last 60 days)
//   GET  /children/:studentId/exams         published examinations with the child's result
//   GET  /children/:studentId/exams/:examId the child's subject-wise result and the class averages
//   GET  /contacts                          who the parent can message: the school office and
//                                           their children's teachers, with unread counts
//   GET  /messages?with=school|<teacherId>  one conversation (marks the other side's messages read)
//   GET  /messages/unread                   { count } of unread messages from the school and teachers
//   POST /messages                          { to: 'school' | teacherId, body } send a message
//
// Rules:
// - A parent only sees the students linked to them in parent_students (403 otherwise).
// - Attendance comes from the class's daily reports: the child is absent on a day
//   when the report names them among the absent students (same name, ignoring
//   case), otherwise present. Days with no report for the class are left out.
// - Only published examinations that are not disabled are shown, and only the
//   child's own marks, total, position and Pass/Fail plus the class average,
//   highest and lowest. Other students' marks are never sent.

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, todayString, isValidDate, requireParent } = require('../helpers');
const { buildResults, passMarksOf } = require('../results');
const { cleanMessageBody, newMessage, inThread, teachersOf, threadSummary } = require('../conversations');

const router = express.Router();
router.use(requireParent);

const SUMMARY_DAYS = 30;
const DEFAULT_HISTORY_DAYS = 60;

// The date `days` days before `date` (both YYYY-MM-DD).
function daysBefore(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// The parent's children, or 403 for a student who isn't one of them.
async function myStudentIds(user) {
  const links = await readData('parentStudents');
  return links.filter((l) => l.parentId === user.id).map((l) => l.studentId);
}

async function loadChild(user, studentId) {
  const [ids, students] = await Promise.all([myStudentIds(user), readData('students')]);
  const student = students.find((s) => s.id === studentId);
  if (!ids.includes(studentId) || !student) throw new HttpError(403, 'This student is not linked to your account');
  return { student, students };
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// One row per class report: { date, status: 'present' | 'absent', reason }.
function attendanceDays(student, reports, from, to) {
  return reports
    .filter((r) => r.classId === student.classId && r.date >= from && r.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((r) => {
      const absentee = r.absentees.find((a) => sameName(a.name, student.name));
      return absentee
        ? { date: r.date, status: 'absent', reason: absentee.reason || '' }
        : { date: r.date, status: 'present', reason: '' };
    });
}

function attendanceSummary(days) {
  const absent = days.filter((d) => d.status === 'absent').length;
  return {
    schoolDays: days.length,
    present: days.length - absent,
    absent,
    rate: days.length ? Math.round(((days.length - absent) / days.length) * 1000) / 10 : null,
  };
}

// Published, enabled exams the child takes part in: their class's exams, plus
// exams of an earlier class in which they have marks.
function examsFor(student, exams, marks) {
  const markedExamIds = new Set(marks.filter((m) => m.studentId === student.id).map((m) => m.examId));
  return exams
    .filter((e) => e.status === 'published' && !e.disabled)
    .filter((e) => e.classId === student.classId || markedExamIds.has(e.id))
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

// The child's row of an exam's results, with only what a parent may see.
function childResult(exam, student, students, marks) {
  const results = buildResults(exam, students, marks);
  const row = results.rows.find((r) => r.studentId === student.id);
  if (!row) return null;
  return { results, row };
}

function examSummary(exam, student, students, marks) {
  const found = childResult(exam, student, students, marks);
  return {
    examId: exam.id,
    name: exam.name,
    date: exam.date,
    className: exam.className,
    publishedAt: exam.publishedAt,
    complete: found?.row.complete ?? false,
    result: found?.row.result ?? null,
    totalObtained: found?.row.totalObtained ?? null,
    totalMax: found?.row.totalMax ?? null,
    percentage: found?.row.percentage ?? null,
    rank: found?.row.rank ?? null,
    rankedCount: found?.results.stats.completeCount ?? 0,
  };
}

// GET /api/parent/children
router.get('/children', async (req, res) => {
  const [ids, students, classes, users, classSubjects, subjects, reports, exams, marks] = await Promise.all([
    myStudentIds(req.user),
    readData('students'),
    readData('classes'),
    readData('users'),
    readData('classSubjects'),
    readData('subjects'),
    readData('attendance'),
    readData('exams'),
    readData('marks'),
  ]);
  const nameOf = (userId) => users.find((u) => u.id === userId)?.name ?? null;
  const today = todayString();

  const children = students
    .filter((s) => ids.includes(s.id))
    .map((student) => {
      const cls = classes.find((c) => c.id === student.classId);
      const latestExam = examsFor(student, exams, marks)[0];
      return {
        studentId: student.id,
        name: student.name,
        gender: student.gender ?? null,
        photo: student.photo ?? null,
        rollNumber: student.rollNumber,
        classId: student.classId,
        className: cls?.name ?? '',
        classTeacher: nameOf(cls?.teacherId),
        subjects: classSubjects
          .filter((cs) => cs.classId === student.classId)
          .map((cs) => ({
            subjectId: cs.subjectId,
            subjectName: subjects.find((s) => s.id === cs.subjectId)?.name ?? '',
            teacherName: nameOf(cs.teacherId),
          }))
          .sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
        attendance: attendanceSummary(attendanceDays(student, reports, daysBefore(today, SUMMARY_DAYS - 1), today)),
        attendanceDays: SUMMARY_DAYS,
        latestExam: latestExam ? examSummary(latestExam, student, students, marks) : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(children);
});

// GET /api/parent/children/:studentId/attendance?from=&to=
router.get('/children/:studentId/attendance', async (req, res) => {
  const { student } = await loadChild(req.user, req.params.studentId);
  const to = req.query.to || todayString();
  const from = req.query.from || daysBefore(to, DEFAULT_HISTORY_DAYS - 1);
  if (!isValidDate(from) || !isValidDate(to)) throw new HttpError(400, 'Please choose valid dates');
  if (from > to) throw new HttpError(400, 'The start date must be before the end date');

  const days = attendanceDays(student, await readData('attendance'), from, to);
  res.json({ from, to, days, summary: attendanceSummary(days) });
});

// GET /api/parent/children/:studentId/exams
router.get('/children/:studentId/exams', async (req, res) => {
  const { student, students } = await loadChild(req.user, req.params.studentId);
  const [exams, marks] = await Promise.all([readData('exams'), readData('marks')]);
  res.json(examsFor(student, exams, marks).map((exam) => examSummary(exam, student, students, marks)));
});

// GET /api/parent/children/:studentId/exams/:examId
router.get('/children/:studentId/exams/:examId', async (req, res) => {
  const { student, students } = await loadChild(req.user, req.params.studentId);
  const [exams, marks] = await Promise.all([readData('exams'), readData('marks')]);
  const exam = examsFor(student, exams, marks).find((e) => e.id === req.params.examId);
  if (!exam) throw new HttpError(404, 'This result is not available');

  const found = childResult(exam, student, students, marks);
  if (!found) throw new HttpError(404, 'This result is not available');
  const { results, row } = found;
  const { average, highest, lowest, completeCount } = results.stats;

  res.json({
    exam: {
      id: exam.id,
      name: exam.name,
      date: exam.date,
      className: exam.className,
      remarks: exam.remarks,
      publishedAt: exam.publishedAt,
    },
    student: { studentId: student.id, name: row.studentName, rollNumber: row.rollNumber },
    subjects: exam.subjects.map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      maxMarks: s.maxMarks,
      passMarks: passMarksOf(s),
      mark: row.marks[s.subjectId],
    })),
    result: {
      complete: row.complete,
      result: row.result,
      totalObtained: row.totalObtained,
      totalMax: row.totalMax,
      percentage: row.percentage,
      rank: row.rank,
    },
    classStats: { average, highest, lowest, rankedCount: completeCount },
  });
});

// The people a parent can message: the school office first, then their
// children's teachers (what each teaches which child), each with a summary of
// the conversation. Teachers with unread messages come first, then the most
// recent conversations, then everyone else by name. A teacher who no longer teaches them stays listed while
// there is a conversation with them, but can't get new messages.
async function contactsFor(user) {
  const [ids, students, classes, classSubjects, subjects, users, messages] = await Promise.all([
    myStudentIds(user),
    readData('students'),
    readData('classes'),
    readData('classSubjects'),
    readData('subjects'),
    readData('users'),
    readData('messages'),
  ]);
  const mine = messages.filter((m) => m.parentId === user.id);
  const byTeacher = teachersOf(
    students.filter((s) => ids.includes(s.id)),
    { classes, classSubjects, subjects }
  );

  const school = {
    id: 'school',
    kind: 'school',
    teacherId: null,
    name: 'School office',
    canWrite: true,
    teaches: [],
    ...threadSummary(mine.filter((m) => !m.teacherId), false),
  };

  const teacherIds = new Set([...byTeacher.keys(), ...mine.filter((m) => m.teacherId).map((m) => m.teacherId)]);
  const teachers = [...teacherIds]
    .map((teacherId) => {
      const teacher = users.find((u) => u.id === teacherId && u.role === 'teacher');
      const teaches = byTeacher.get(teacherId) ?? [];
      const thread = mine.filter((m) => m.teacherId === teacherId);
      if (!teacher && thread.length === 0) return null;
      return {
        id: teacherId,
        kind: 'teacher',
        teacherId,
        name: teacher?.name ?? thread[thread.length - 1]?.senderName ?? 'Former teacher',
        canWrite: Boolean(teacher && !teacher.disabled && teaches.length > 0),
        teaches,
        ...threadSummary(thread, false),
      };
    })
    .filter(Boolean)
    .sort(
      (a, b) =>
        (b.unreadCount > 0) - (a.unreadCount > 0) ||
        (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? '') ||
        a.name.localeCompare(b.name)
    );

  return [school, ...teachers];
}

async function findContact(user, key) {
  const contact = (await contactsFor(user)).find((c) => c.id === (key || 'school'));
  if (!contact) throw new HttpError(404, 'You can message the school office and your children\'s teachers');
  return contact;
}

// GET /api/parent/contacts
router.get('/contacts', async (req, res) => {
  res.json(await contactsFor(req.user));
});

// GET /api/parent/messages?with=school|<teacherId>
// Reading the conversation marks the other side's messages as read.
router.get('/messages', async (req, res) => {
  const contact = await findContact(req.user, req.query.with);
  const now = new Date().toISOString();
  const all = await updateData('messages', (messages) =>
    messages.map((m) =>
      inThread(m, req.user.id, contact.teacherId) && m.fromSchool && !m.readAt ? { ...m, readAt: now } : m
    )
  );
  const { lastMessage, messageCount, unreadCount, ...rest } = contact;
  res.json({ contact: rest, messages: all.filter((m) => inThread(m, req.user.id, contact.teacherId)) });
});

// GET /api/parent/messages/unread
router.get('/messages/unread', async (req, res) => {
  const messages = await readData('messages');
  res.json({ count: messages.filter((m) => m.parentId === req.user.id && m.fromSchool && !m.readAt).length });
});

// POST /api/parent/messages  { to: 'school' | teacherId, body }
router.post('/messages', async (req, res) => {
  const body = cleanMessageBody(req.body?.body);
  const contact = await findContact(req.user, req.body?.to);
  if (!contact.canWrite) throw new HttpError(403, `${contact.name} no longer teaches your children`);
  const message = newMessage({ parentId: req.user.id, teacherId: contact.teacherId, sender: req.user, body });
  await updateData('messages', (messages) => [...messages, message]);
  res.status(201).json(message);
});

module.exports = router;
