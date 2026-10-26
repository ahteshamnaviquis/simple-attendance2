// /api/teachers - list, add and edit teachers. Adding and editing needs the "teachers" permission.
// Teachers are stored in users.json with role "teacher".

const express = require('express');
const { readData, updateData } = require('../fileStore');
const { HttpError, newId, publicUser, requireLogin, requireArea } = require('../helpers');

const router = express.Router();

// Check and tidy the form values. Password is required only for new teachers;
// when editing, a blank password means "keep the current one".
function cleanTeacherInput(body, isNew) {
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

// GET /api/teachers
router.get('/', requireLogin, async (req, res) => {
  const users = await readData('users');
  const teachers = users
    .filter((u) => u.role === 'teacher')
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json(teachers);
});

// POST /api/teachers
router.post('/', requireArea('teachers'), async (req, res) => {
  const input = cleanTeacherInput(req.body, true);
  let created;
  await updateData('users', (users) => {
    checkUsernameFree(users, input.username);
    created = { id: newId(), ...input, role: 'teacher' };
    return [...users, created];
  });
  res.status(201).json(publicUser(created));
});

// PUT /api/teachers/:id
router.put('/:id', requireArea('teachers'), async (req, res) => {
  const input = cleanTeacherInput(req.body, false);
  let updated;
  await updateData('users', (users) => {
    const index = users.findIndex((u) => u.id === req.params.id && u.role === 'teacher');
    if (index === -1) throw new HttpError(404, 'Teacher not found');
    checkUsernameFree(users, input.username, req.params.id);

    updated = { ...users[index], name: input.name, username: input.username };
    if (input.password) updated.password = input.password;

    const copy = [...users];
    copy[index] = updated;
    return copy;
  });
  res.json(publicUser(updated));
});

module.exports = router;
