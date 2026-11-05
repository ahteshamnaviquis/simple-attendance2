// /api/feedback - complaints and suggestions to the school office.
//
//   GET    /?kind=&status=   admins and the super admin: all; parents and teachers: their own
//   GET    /open-count       { count } of open items (the office only; 0 for others)
//   POST   /                 { kind, subject, body, studentId }  a parent or teacher writes one
//   POST   /:id/reply        { reply, status: 'open' | 'resolved' }  the office answers
//   DELETE /:id              the writer removes theirs while it has no reply yet
//
// Rules:
// - kind is "complaint" or "suggestion". A parent may say which of their
//   children it is about (optional).
// - Only the school office (every admin and the super admin) reads and answers
//   them; the writer sees the reply and the status.

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, requireRole } = require('../helpers');
const { isOffice, childrenOf, cleanText } = require('../schoolAccess');

const router = express.Router();
router.use(requireRole('superadmin', 'admin', 'teacher', 'parent'));

const KINDS = ['complaint', 'suggestion'];
const STATUSES = ['open', 'resolved'];
const requireOffice = requireRole('superadmin', 'admin');
const requireWriter = requireRole('teacher', 'parent');

// GET /api/feedback
router.get('/', async (req, res) => {
  const { kind, status } = req.query;
  if (kind && !KINDS.includes(kind)) throw new HttpError(400, 'Unknown kind');
  if (status && !STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');
  const list = (await readData('feedback'))
    .filter((f) => isOffice(req.user) || f.fromId === req.user.id)
    .filter((f) => !kind || f.kind === kind)
    .filter((f) => !status || f.status === status)
    .sort((a, b) => (b.status === 'open') - (a.status === 'open') || b.createdAt.localeCompare(a.createdAt));
  res.json(list);
});

// GET /api/feedback/open-count
router.get('/open-count', async (req, res) => {
  if (!isOffice(req.user)) return res.json({ count: 0 });
  res.json({ count: (await readData('feedback')).filter((f) => f.status === 'open').length });
});

// POST /api/feedback
router.post('/', requireWriter, async (req, res) => {
  const kind = req.body?.kind;
  if (!KINDS.includes(kind)) throw new HttpError(400, 'Please choose complaint or suggestion');

  let student = null;
  if (req.body?.studentId) {
    if (req.user.role !== 'parent') throw new HttpError(400, 'Only parents can choose a child');
    const [students, parentStudents] = await Promise.all([readData('students'), readData('parentStudents')]);
    student = childrenOf(req.user, parentStudents, students).find((s) => s.id === req.body.studentId);
    if (!student) throw new HttpError(403, 'Please choose one of your children');
  }

  const item = {
    id: newId(),
    kind,
    subject: cleanText(req.body?.subject, 'subject', 150),
    body: cleanText(req.body?.body, 'details', 4000),
    fromId: req.user.id,
    fromName: req.user.name,
    fromRole: req.user.role,
    studentId: student?.id ?? null,
    studentName: student?.name ?? null,
    status: 'open',
    reply: '',
    repliedBy: null,
    repliedAt: null,
    createdAt: new Date().toISOString(),
  };
  await updateData('feedback', (list) => [...list, item]);
  res.status(201).json(item);
});

// POST /api/feedback/:id/reply
router.post('/:id/reply', requireOffice, async (req, res) => {
  const status = req.body?.status ?? 'resolved';
  if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status');
  const reply = cleanText(req.body?.reply, 'reply', 4000, { required: false });
  let saved;
  await updateData('feedback', (list) => {
    const item = list.find((f) => f.id === req.params.id);
    if (!item) throw new HttpError(404, 'Not found');
    const changedReply = reply !== item.reply;
    saved = {
      ...item,
      status,
      reply,
      repliedBy: changedReply ? (reply ? req.user.name : null) : item.repliedBy,
      repliedAt: changedReply ? (reply ? new Date().toISOString() : null) : item.repliedAt,
    };
    return list.map((f) => (f.id === item.id ? saved : f));
  });
  res.json(saved);
});

// DELETE /api/feedback/:id
router.delete('/:id', requireWriter, async (req, res) => {
  await updateData('feedback', (list) => {
    const item = list.find((f) => f.id === req.params.id && f.fromId === req.user.id);
    if (!item) throw new HttpError(404, 'Not found');
    if (item.reply || item.status !== 'open') {
      throw new HttpError(400, 'The school has already answered this, so it can no longer be removed');
    }
    return list.filter((f) => f.id !== item.id);
  });
  res.json({ ok: true });
});

module.exports = router;
