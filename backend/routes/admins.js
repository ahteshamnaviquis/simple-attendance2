// /api/admins - list, add, edit and remove admins. Super admin only.
// Admins are stored in users.json with role "admin". They look after students,
// classes, subjects and attendance; teachers and exams stay with the super admin.
// The super admin account itself can't be changed or removed here.

const express = require('express');
const { readData, updateData } = require('../fileStore');
const { HttpError, newId, publicUser, requireSuperAdmin } = require('../helpers');

const router = express.Router();
router.use(requireSuperAdmin);

// Check and tidy the form values. Password is required only for new admins;
// when editing, a blank password means "keep the current one".
function cleanAdminInput(body, isNew) {
  const name = String(body?.name ?? '').trim();
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');

  if (!name) throw new HttpError(400, 'Name is required');
  if (!username) throw new HttpError(400, 'Username is required');
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new HttpError(400, 'Username can only use letters, numbers, dot, dash and underscore');
  }
  if (isNew && !password) throw new HttpError(400, 'Password is required');

  return { name, username, password };
}

function checkUsernameFree(users, username, exceptId) {
  const taken = users.some((u) => u.id !== exceptId && u.username.toLowerCase() === username);
  if (taken) throw new HttpError(409, 'That username is already taken');
}

function findAdminIndex(users, id) {
  const index = users.findIndex((u) => u.id === id && u.role === 'admin');
  if (index === -1) throw new HttpError(404, 'Admin not found');
  return index;
}

// GET /api/admins
router.get('/', async (req, res) => {
  const users = await readData('users');
  const admins = users
    .filter((u) => u.role === 'admin')
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(admins);
});

// POST /api/admins
router.post('/', async (req, res) => {
  const input = cleanAdminInput(req.body, true);
  let created;
  await updateData('users', (users) => {
    checkUsernameFree(users, input.username);
    created = { id: newId(), ...input, role: 'admin' };
    return [...users, created];
  });
  res.status(201).json(publicUser(created));
});

// PUT /api/admins/:id
router.put('/:id', async (req, res) => {
  const input = cleanAdminInput(req.body, false);
  let updated;
  await updateData('users', (users) => {
    const index = findAdminIndex(users, req.params.id);
    checkUsernameFree(users, input.username, req.params.id);

    updated = { ...users[index], name: input.name, username: input.username };
    if (input.password) updated.password = input.password;

    const copy = [...users];
    copy[index] = updated;
    return copy;
  });
  res.json(publicUser(updated));
});

// DELETE /api/admins/:id
// Records keep the admin's name (createdBy, updatedBy, ...), so nothing else changes.
router.delete('/:id', async (req, res) => {
  await updateData('users', (users) => {
    const index = findAdminIndex(users, req.params.id);
    return users.filter((_, i) => i !== index);
  });
  res.status(204).end();
});

module.exports = router;
