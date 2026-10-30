// /api/classes - list, add and edit classes, and assign teachers.
// Each class: { id, name, teacherId }  (teacherId is null when unassigned)

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, requireLogin, requireArea } = require('../helpers');

const router = express.Router();

function withTeacherName(cls, users) {
  const teacher = users.find((u) => u.id === cls.teacherId);
  return { ...cls, teacherName: teacher ? teacher.name : null };
}

function cleanClassInput(body, users) {
  const name = String(body?.name ?? '').trim();
  const teacherId = body?.teacherId ? String(body.teacherId) : null;

  if (!name) throw new HttpError(400, 'Class name is required');
  if (teacherId && !users.some((u) => u.id === teacherId && u.role === 'teacher')) {
    throw new HttpError(400, 'The selected teacher does not exist');
  }
  return { name, teacherId };
}

function checkNameFree(classes, name, exceptId) {
  const taken = classes.some(
    (c) => c.id !== exceptId && c.name.toLowerCase() === name.toLowerCase()
  );
  if (taken) throw new HttpError(409, 'A class with this name already exists');
}

// GET /api/classes - admins see all classes, teachers only their own.
router.get('/', requireLogin, async (req, res) => {
  const [classes, users] = await Promise.all([readData('classes'), readData('users')]);
  let list = classes;
  if (req.user.role === 'teacher') {
    list = list.filter((c) => c.teacherId === req.user.id);
  }
  res.json(
    list.map((c) => withTeacherName(c, users)).sort((a, b) => a.name.localeCompare(b.name))
  );
});

// POST /api/classes
router.post('/', requireArea('classes'), async (req, res) => {
  let created;
  let users;
  await updateData('classes', async (classes) => {
    users = await readData('users');
    const input = cleanClassInput(req.body, users);
    checkNameFree(classes, input.name);
    created = { id: newId(), ...input };
    return [...classes, created];
  });
  res.status(201).json(withTeacherName(created, users));
});

// PUT /api/classes/:id
// Past attendance reports keep the class name and teacher they had on that day.
router.put('/:id', requireArea('classes'), async (req, res) => {
  let updated;
  let users;
  await updateData('classes', async (classes) => {
    const index = classes.findIndex((c) => c.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Class not found');

    users = await readData('users');
    const input = cleanClassInput(req.body, users);
    checkNameFree(classes, input.name, req.params.id);

    updated = { ...classes[index], ...input };
    const copy = [...classes];
    copy[index] = updated;
    return copy;
  });
  res.json(withTeacherName(updated, users));
});

module.exports = router;
