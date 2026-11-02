// /api/messages - the school's side of the conversations with parents.
// For every admin and the super admin (not a permission they can lose): parents
// write to "the school", not to one person, so all of them see every conversation.
//
// A message (the messages table):
// { id, parentId, fromSchool, senderId, senderName, body, createdAt, readAt }
// readAt is set when the other side opens the conversation.
//
//   GET  /             conversations: each parent with messages, newest first
//   GET  /unread       { count } of parent messages nobody has read yet
//   GET  /parents      everyone a message can go to: parents with their children
//   GET  /:parentId    one conversation (marks the parent's messages read)
//   POST /             { parentIds, body } send the same message to one or more parents

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, requireRole } = require('../helpers');
const { listParents } = require('./parents');

const MAX_MESSAGE_LENGTH = 2000;

function cleanMessageBody(value) {
  const body = String(value ?? '').trim();
  if (!body) throw new HttpError(400, 'Please write a message');
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `A message can be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return body;
}

const router = express.Router();
router.use(requireRole('admin', 'superadmin'));

const isUnread = (m) => !m.fromSchool && !m.readAt;

// GET /api/messages
router.get('/', async (req, res) => {
  const [parents, messages] = await Promise.all([listParents(), readData('messages')]);
  const threads = parents
    .map((parent) => {
      const mine = messages.filter((m) => m.parentId === parent.id);
      if (mine.length === 0) return null;
      return {
        parentId: parent.id,
        parentName: parent.name,
        disabled: Boolean(parent.disabled),
        children: parent.children,
        lastMessage: mine[mine.length - 1],
        messageCount: mine.length,
        unreadCount: mine.filter(isUnread).length,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
  res.json(threads);
});

// GET /api/messages/unread
router.get('/unread', async (req, res) => {
  const messages = await readData('messages');
  res.json({ count: messages.filter(isUnread).length });
});

// GET /api/messages/parents
router.get('/parents', async (req, res) => {
  const parents = await listParents();
  res.json(
    parents.map((p) => ({
      id: p.id,
      name: p.name,
      relation: p.relation,
      disabled: p.disabled,
      children: p.children,
    }))
  );
});

// GET /api/messages/:parentId
router.get('/:parentId', async (req, res) => {
  const parent = (await listParents()).find((p) => p.id === req.params.parentId);
  if (!parent) throw new HttpError(404, 'Parent not found');

  const now = new Date().toISOString();
  const all = await updateData('messages', (messages) =>
    messages.map((m) => (m.parentId === parent.id && isUnread(m) ? { ...m, readAt: now } : m))
  );
  res.json({ parent, messages: all.filter((m) => m.parentId === parent.id) });
});

// POST /api/messages  { parentIds: [...], body }
// One message per parent, so each conversation stays private.
router.post('/', async (req, res) => {
  const body = cleanMessageBody(req.body?.body);
  const parentIds = Array.isArray(req.body?.parentIds) ? [...new Set(req.body.parentIds.map(String))] : [];
  if (parentIds.length === 0) throw new HttpError(400, 'Please choose at least one parent');

  const users = await readData('users');
  const known = new Set(users.filter((u) => u.role === 'parent').map((u) => u.id));
  if (parentIds.some((id) => !known.has(id))) throw new HttpError(400, 'Please choose parents from the list');

  const createdAt = new Date().toISOString();
  const sent = parentIds.map((parentId) => ({
    id: newId(),
    parentId,
    fromSchool: true,
    senderId: req.user.id,
    senderName: req.user.name,
    body,
    createdAt,
    readAt: null,
  }));
  await updateData('messages', (messages) => [...messages, ...sent]);
  res.status(201).json({ sentCount: sent.length, messages: sent });
});

module.exports = { router, cleanMessageBody };
