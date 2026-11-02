// /api/messages - the staff side of the conversations with parents (see conversations.js).
//
// Admins and the super admin: the school office conversations, which they all
// share (whatever the permissions). Teachers: their own conversations with the
// parents of the students they teach (as class teacher or subject teacher).
//
//   GET  /             conversations, newest first, with unread counts
//   GET  /unread       { count } of parent messages not read yet
//   GET  /parents      everyone this user can write to: parents with their children
//   GET  /:parentId    one conversation (marks the parent's messages read)
//   POST /             { parentIds, body } send the same message to one or more parents

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, requireLogin } = require('../helpers');
const { listParents } = require('./parents');
const { cleanMessageBody, newMessage, inThread, studentIdsOfTeacher, threadSummary } = require('../conversations');

const router = express.Router();
router.use(requireLogin);

// The teacherId of the conversations this user handles: null for the office.
const scopeOf = (user) => (user.role === 'teacher' ? user.id : null);

// The parents this user may write to. Teachers: parents of their students,
// with only those children listed.
async function reachableParents(user) {
  const parents = await listParents();
  if (user.role !== 'teacher') return parents;
  const [classes, classSubjects, students] = await Promise.all([
    readData('classes'),
    readData('classSubjects'),
    readData('students'),
  ]);
  const mine = studentIdsOfTeacher(user.id, { classes, classSubjects, students });
  return parents
    .map((p) => ({ ...p, children: p.children.filter((c) => mine.has(c.studentId)) }))
    .filter((p) => p.children.length > 0);
}

function publicParent(p) {
  return { id: p.id, name: p.name, relation: p.relation, phone: p.phone, disabled: p.disabled, children: p.children };
}

// GET /api/messages
router.get('/', async (req, res) => {
  const scope = scopeOf(req.user);
  const [parents, reachable, messages] = await Promise.all([
    listParents(),
    reachableParents(req.user),
    readData('messages'),
  ]);
  const threads = parents
    .map((parent) => {
      const mine = messages.filter((m) => inThread(m, parent.id, scope));
      if (mine.length === 0) return null;
      // A teacher sees the children they teach (all of them if none any more).
      const children = reachable.find((p) => p.id === parent.id)?.children ?? parent.children;
      return {
        parentId: parent.id,
        parentName: parent.name,
        relation: parent.relation,
        disabled: parent.disabled,
        children,
        ...threadSummary(mine, true),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
  res.json(threads);
});

// GET /api/messages/unread
router.get('/unread', async (req, res) => {
  const scope = scopeOf(req.user);
  const messages = await readData('messages');
  res.json({ count: messages.filter((m) => (m.teacherId ?? null) === scope && !m.fromSchool && !m.readAt).length });
});

// GET /api/messages/parents
router.get('/parents', async (req, res) => {
  res.json((await reachableParents(req.user)).map(publicParent));
});

// GET /api/messages/:parentId
// Teachers can open a conversation with a parent of their students, or one that
// already exists (a child may have moved to another class since).
router.get('/:parentId', async (req, res) => {
  const scope = scopeOf(req.user);
  const reachable = (await reachableParents(req.user)).find((p) => p.id === req.params.parentId);
  const all = (await listParents()).find((p) => p.id === req.params.parentId);
  if (!all) throw new HttpError(404, 'Parent not found');

  const existing = (await readData('messages')).some((m) => inThread(m, all.id, scope));
  if (!reachable && !existing) throw new HttpError(403, 'You do not teach any child of this parent');

  const now = new Date().toISOString();
  const saved = await updateData('messages', (messages) =>
    messages.map((m) => (inThread(m, all.id, scope) && !m.fromSchool && !m.readAt ? { ...m, readAt: now } : m))
  );
  res.json({
    parent: publicParent(reachable ?? all),
    with: scope ? 'teacher' : 'school',
    messages: saved.filter((m) => inThread(m, all.id, scope)),
  });
});

// POST /api/messages  { parentIds: [...], body }
// One message per parent, so each conversation stays private.
router.post('/', async (req, res) => {
  const body = cleanMessageBody(req.body?.body);
  const parentIds = Array.isArray(req.body?.parentIds) ? [...new Set(req.body.parentIds.map(String))] : [];
  if (parentIds.length === 0) throw new HttpError(400, 'Please choose at least one parent');

  const scope = scopeOf(req.user);
  const reachable = new Set((await reachableParents(req.user)).map((p) => p.id));
  const messages = await readData('messages');
  for (const id of parentIds) {
    if (!reachable.has(id) && !(scope && messages.some((m) => inThread(m, id, scope)))) {
      throw new HttpError(400, 'Please choose parents from the list');
    }
  }

  const createdAt = new Date().toISOString();
  const sent = parentIds.map((parentId) => newMessage({ parentId, teacherId: scope, sender: req.user, body, createdAt }));
  await updateData('messages', (list) => [...list, ...sent]);
  res.status(201).json({ sentCount: sent.length, messages: sent });
});

module.exports = { router };
