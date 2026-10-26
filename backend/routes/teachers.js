// /api/teachers - list, add and edit teachers. Adding and editing needs the "teachers" permission;
// disabling and removing teachers is for the super admin only.
// Teachers are stored in users.json with role "teacher" (disabled: true when disabled).

const express = require('express');
const { readData, updateData } = require('../fileStore');
const {
  HttpError,
  newId,
  publicUser,
  requireLogin,
  requireArea,
  requireSuperAdmin,
} = require('../helpers');

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

function findTeacherIndex(users, id) {
  const index = users.findIndex((u) => u.id === id && u.role === 'teacher');
  if (index === -1) throw new HttpError(404, 'Teacher not found');
  return index;
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

// POST /api/teachers/:id/disable and /enable - super admin only.
// A disabled teacher can't log in (and is logged out). Their classes and
// subjects stay assigned, so enabling them again puts everything back.
for (const [action, disabled] of [['disable', true], ['enable', false]]) {
  router.post(`/:id/${action}`, requireSuperAdmin, async (req, res) => {
    let updated;
    await updateData('users', (users) => {
      const index = findTeacherIndex(users, req.params.id);
      updated = { ...users[index], disabled };
      const copy = [...users];
      copy[index] = updated;
      return copy;
    });
    res.json(publicUser(updated));
  });
}

// DELETE /api/teachers/:id - super admin only.
// Their classes and subjects become unassigned. Attendance reports and marks
// keep the teacher's name as text, so history stays readable.
router.delete('/:id', requireSuperAdmin, async (req, res) => {
  const id = req.params.id;
  await updateData('users', (users) => {
    const index = findTeacherIndex(users, id);
    return users.filter((_, i) => i !== index);
  });
  const unassign = (rows) => rows.map((r) => (r.teacherId === id ? { ...r, teacherId: null } : r));
  await updateData('classes', unassign);
  await updateData('classSubjects', unassign);
  res.status(204).end();
});

module.exports = router;
