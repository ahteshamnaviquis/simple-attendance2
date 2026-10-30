// /api/attendance - daily attendance reports.
//
// A report looks like:
// {
//   id, classId, date: "YYYY-MM-DD",
//   className, teacherId, teacherName,   <- copied when created, so history stays
//                                           correct even if the class changes later
//   totalStudents, present, absent, addedToday, leftToday,
//   absentees: [{ name, reason }],
//   createdAt, createdBy, updatedAt, updatedBy
// }
//
// Rules:
// - All counts are whole numbers, 0 or more.
// - present + absent = totalStudents.
// - No more absentee names than the absent count (fewer is OK if some are unknown).
// - Only one report per class per date. Class and date cannot be changed later.
// - No reports for future dates.
// - Teachers can only see and change reports for classes assigned to them.

const express = require('express');
const { readData, updateData } = require('../store');
const {
  HttpError,
  newId,
  todayString,
  isValidDate,
  isAdmin,
  requireLogin,
} = require('../helpers');

const router = express.Router();

const COUNT_FIELDS = {
  totalStudents: 'Total students',
  present: 'Present',
  absent: 'Absent',
  addedToday: 'Added today',
  leftToday: 'Left today',
};

// Check the counts and absentee list. Returns the cleaned values.
function cleanReportInput(body) {
  const report = {};

  for (const [field, label] of Object.entries(COUNT_FIELDS)) {
    const raw = body?.[field];
    if (raw === undefined || raw === null || raw === '') {
      throw new HttpError(400, `${label} is required`);
    }
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      throw new HttpError(400, `${label} must be a whole number, 0 or more`);
    }
    report[field] = value;
  }

  if (report.present + report.absent !== report.totalStudents) {
    throw new HttpError(
      400,
      `Present (${report.present}) + absent (${report.absent}) must equal total students (${report.totalStudents})`
    );
  }

  const rows = Array.isArray(body?.absentees) ? body.absentees : [];
  report.absentees = rows
    .map((row) => ({
      name: String(row?.name ?? '').trim(),
      reason: String(row?.reason ?? '').trim(),
    }))
    .filter((row) => row.name || row.reason); // ignore completely empty rows

  if (report.absentees.some((row) => !row.name)) {
    throw new HttpError(400, 'Every absent student row needs a name');
  }
  if (report.absentees.length > report.absent) {
    throw new HttpError(
      400,
      `You listed ${report.absentees.length} absent students, but the absent count is ${report.absent}`
    );
  }

  return report;
}

function canUseClass(user, cls) {
  return isAdmin(user) || (cls && cls.teacherId === user.id);
}

// GET /api/attendance?date=YYYY-MM-DD&classId=...
// Both filters are optional. Newest dates first.
router.get('/', requireLogin, async (req, res) => {
  const [reports, classes] = await Promise.all([readData('attendance'), readData('classes')]);
  const { date, classId } = req.query;

  let list = reports;
  if (req.user.role === 'teacher') {
    const myClassIds = classes.filter((c) => c.teacherId === req.user.id).map((c) => c.id);
    list = list.filter((r) => myClassIds.includes(r.classId));
  }
  if (date) list = list.filter((r) => r.date === date);
  if (classId) list = list.filter((r) => r.classId === classId);

  list = [...list].sort(
    (a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className)
  );
  res.json(list);
});

// GET /api/attendance/school-days
// Dates on which at least one class (any teacher) submitted a report.
// Teachers only see their own reports, so the dashboard uses this to tell a
// missed school day apart from a day with no school.
router.get('/school-days', requireLogin, async (req, res) => {
  const reports = await readData('attendance');
  res.json([...new Set(reports.map((r) => r.date))].sort());
});

// GET /api/attendance/:id
router.get('/:id', requireLogin, async (req, res) => {
  const [reports, classes] = await Promise.all([readData('attendance'), readData('classes')]);
  const report = reports.find((r) => r.id === req.params.id);
  if (!report) throw new HttpError(404, 'Report not found');

  const cls = classes.find((c) => c.id === report.classId);
  if (!canUseClass(req.user, cls)) throw new HttpError(403, 'This class is not assigned to you');
  res.json(report);
});

// POST /api/attendance - create a new report.
router.post('/', requireLogin, async (req, res) => {
  const input = cleanReportInput(req.body);
  const classId = String(req.body?.classId ?? '');
  const date = String(req.body?.date ?? '');

  if (!isValidDate(date)) throw new HttpError(400, 'Please choose a valid date');
  if (date > todayString()) {
    throw new HttpError(400, 'Attendance cannot be submitted for a future date');
  }

  let created;
  await updateData('attendance', async (reports) => {
    const [classes, users] = await Promise.all([readData('classes'), readData('users')]);
    const cls = classes.find((c) => c.id === classId);
    if (!cls) throw new HttpError(400, 'Please choose a valid class');
    if (!canUseClass(req.user, cls)) throw new HttpError(403, 'This class is not assigned to you');

    if (reports.some((r) => r.classId === classId && r.date === date)) {
      throw new HttpError(409, 'A report for this class and date already exists. Edit it instead.');
    }

    const teacher = users.find((u) => u.id === cls.teacherId);
    const now = new Date().toISOString();
    created = {
      id: newId(),
      classId,
      date,
      className: cls.name,
      teacherId: cls.teacherId,
      teacherName: teacher ? teacher.name : null,
      ...input,
      createdAt: now,
      createdBy: req.user.name,
      updatedAt: now,
      updatedBy: req.user.name,
    };
    return [...reports, created];
  });
  res.status(201).json(created);
});

// PUT /api/attendance/:id - update the counts and absentees of an existing report.
// The class, date and stored class/teacher names stay as they were.
router.put('/:id', requireLogin, async (req, res) => {
  const input = cleanReportInput(req.body);

  let updated;
  await updateData('attendance', async (reports) => {
    const index = reports.findIndex((r) => r.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Report not found');

    const classes = await readData('classes');
    const cls = classes.find((c) => c.id === reports[index].classId);
    if (!canUseClass(req.user, cls)) throw new HttpError(403, 'This class is not assigned to you');

    updated = {
      ...reports[index],
      ...input,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.name,
    };
    const copy = [...reports];
    copy[index] = updated;
    return copy;
  });
  res.json(updated);
});

module.exports = router;
