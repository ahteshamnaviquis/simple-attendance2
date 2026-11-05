// /api/leaves - leave applications for students.
//
//   GET    /?status=&classId=&studentId=  the applications the user may see, newest first
//   GET    /pending-count                 { count } of applications waiting for this user's decision
//   POST   /             { studentId, fromDate, toDate, reason }   a parent applies for their child
//   POST   /:id/review   { status: 'approved' | 'rejected', note } the class teacher or an admin decides
//   DELETE /:id                                                   the parent withdraws a pending application
//
// Rules:
// - A parent applies for their own linked children only, and sees only those
//   applications.
// - The class teacher of the class the application was made in, and admins and
//   the super admin, see and decide. A decision can be changed later.
// - Dates: from <= to, at most 60 days long, starting no more than 30 days ago.
//   A child can't have two pending or approved applications that overlap.
// - Only a pending application can be withdrawn.

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, isValidDate, todayString, requireRole } = require('../helpers');
const { isOffice, classTeacherOf, childrenOf, cleanText } = require('../schoolAccess');

const router = express.Router();
router.use(requireRole('superadmin', 'admin', 'teacher', 'parent'));

const STATUSES = ['pending', 'approved', 'rejected'];
const MAX_DAYS = 60;
const MAX_DAYS_BACK = 30;

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

// Which applications the user can see: a function leave -> boolean.
async function visibleTo(user) {
  if (isOffice(user)) return () => true;
  if (user.role === 'teacher') {
    const mine = classTeacherOf(user, await readData('classes'));
    return (l) => mine.has(l.classId);
  }
  return (l) => l.parentId === user.id;
}

async function canReview(user, leave) {
  if (isOffice(user)) return true;
  if (user.role !== 'teacher') return false;
  return classTeacherOf(user, await readData('classes')).has(leave.classId);
}

// GET /api/leaves
router.get('/', async (req, res) => {
  const visible = await visibleTo(req.user);
  const { status, classId, studentId } = req.query;
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');
  const reviewer = req.user.role !== 'parent';
  const list = (await readData('leaves'))
    .filter(visible)
    .filter((l) => !status || l.status === status)
    .filter((l) => !classId || l.classId === classId)
    .filter((l) => !studentId || l.studentId === studentId)
    .sort((a, b) => (b.status === 'pending') - (a.status === 'pending') || b.createdAt.localeCompare(a.createdAt))
    .map((l) => ({ ...l, days: daysBetween(l.fromDate, l.toDate) + 1, canReview: reviewer }));
  res.json(list);
});

// GET /api/leaves/pending-count
router.get('/pending-count', async (req, res) => {
  if (req.user.role === 'parent') return res.json({ count: 0 });
  const visible = await visibleTo(req.user);
  const count = (await readData('leaves')).filter((l) => l.status === 'pending' && visible(l)).length;
  res.json({ count });
});

// POST /api/leaves
router.post('/', requireRole('parent'), async (req, res) => {
  const [students, parentStudents, classes] = await Promise.all([
    readData('students'),
    readData('parentStudents'),
    readData('classes'),
  ]);
  const child = childrenOf(req.user, parentStudents, students).find((s) => s.id === req.body?.studentId);
  if (!child) throw new HttpError(403, 'Please choose one of your children');

  const fromDate = String(req.body?.fromDate ?? '');
  const toDate = String(req.body?.toDate ?? '');
  if (!isValidDate(fromDate) || !isValidDate(toDate)) throw new HttpError(400, 'Please choose valid dates');
  if (fromDate > toDate) throw new HttpError(400, 'The first day must be on or before the last day');
  if (daysBetween(fromDate, toDate) + 1 > MAX_DAYS) throw new HttpError(400, `A leave can be at most ${MAX_DAYS} days`);
  if (daysBetween(fromDate, todayString()) > MAX_DAYS_BACK) {
    throw new HttpError(400, `A leave can start at most ${MAX_DAYS_BACK} days ago`);
  }
  const reason = cleanText(req.body?.reason, 'reason', 1000);

  const leave = {
    id: newId(),
    studentId: child.id,
    studentName: child.name,
    classId: child.classId,
    className: classes.find((c) => c.id === child.classId)?.name ?? '',
    parentId: req.user.id,
    parentName: req.user.name,
    fromDate,
    toDate,
    reason,
    status: 'pending',
    reviewNote: '',
    reviewedById: null,
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  };
  await updateData('leaves', (list) => {
    const overlap = list.find(
      (l) => l.studentId === child.id && l.status !== 'rejected' && l.fromDate <= toDate && l.toDate >= fromDate
    );
    if (overlap) {
      throw new HttpError(409, `${child.name} already has a leave from ${overlap.fromDate} to ${overlap.toDate}`);
    }
    return [...list, leave];
  });
  res.status(201).json(leave);
});

// POST /api/leaves/:id/review
router.post('/:id/review', requireRole('superadmin', 'admin', 'teacher'), async (req, res) => {
  const status = req.body?.status;
  if (!['approved', 'rejected'].includes(status)) throw new HttpError(400, 'Please approve or reject the leave');
  const note = cleanText(req.body?.note, 'note', 500, { required: false });
  const leave = (await readData('leaves')).find((l) => l.id === req.params.id);
  if (!leave) throw new HttpError(404, 'Leave application not found');
  if (!(await canReview(req.user, leave))) {
    throw new HttpError(403, 'Only the class teacher or the school office can decide this leave');
  }

  let saved;
  await updateData('leaves', (list) =>
    list.map((l) => {
      if (l.id !== leave.id) return l;
      saved = {
        ...l,
        status,
        reviewNote: note,
        reviewedById: req.user.id,
        reviewedBy: req.user.name,
        reviewedAt: new Date().toISOString(),
      };
      return saved;
    })
  );
  if (!saved) throw new HttpError(404, 'Leave application not found');
  res.json(saved);
});

// DELETE /api/leaves/:id
router.delete('/:id', requireRole('parent'), async (req, res) => {
  await updateData('leaves', (list) => {
    const leave = list.find((l) => l.id === req.params.id && l.parentId === req.user.id);
    if (!leave) throw new HttpError(404, 'Leave application not found');
    if (leave.status !== 'pending') throw new HttpError(400, 'Only a pending application can be withdrawn');
    return list.filter((l) => l.id !== leave.id);
  });
  res.json({ ok: true });
});

module.exports = router;
