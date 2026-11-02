// /api/parents - parent accounts and the children each one can see.
// Needs the "parents" permission (the super admin always has it; admins have it
// unless the super admin turns it off in Settings).
//
// Parents are stored in the users table with role "parent" (disabled: true when
// disabled). Which students they can see is in parent_students: a parent can
// have several children, and a child can have more than one parent account.
//
// A parent as sent to the browser:
// { id, name, username, role, disabled, children: [{ studentId, name, rollNumber, classId, className }] }

const express = require('express');
const { readData, updateData } = require('../store');
const { HttpError, newId, publicUser, requireArea } = require('../helpers');

const router = express.Router();
router.use(requireArea('parents'));

// Check and tidy the form values. Password is required only for new parents;
// when editing, a blank password means "keep the current one".
function cleanParentInput(body, isNew) {
  const name = String(body?.name ?? '').trim();
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  const studentIds = Array.isArray(body?.studentIds) ? [...new Set(body.studentIds.map(String))] : null;

  if (!name) throw new HttpError(400, 'Name is required');
  if (!username) throw new HttpError(400, 'Username is required');
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new HttpError(400, 'Username can only use letters, numbers, dot, dash and underscore');
  }
  if (isNew && !password) throw new HttpError(400, 'Password is required');
  if (!studentIds || studentIds.length === 0) throw new HttpError(400, 'Please choose at least one child');

  return { name, username, password, studentIds };
}

async function checkStudentsExist(studentIds) {
  const students = await readData('students');
  const known = new Set(students.map((s) => s.id));
  if (studentIds.some((id) => !known.has(id))) throw new HttpError(400, 'Please choose students from the list');
}

function checkUsernameFree(users, username, exceptId) {
  const taken = users.some((u) => u.id !== exceptId && u.username.toLowerCase() === username);
  if (taken) throw new HttpError(409, 'That username is already taken');
}

function findParentIndex(users, id) {
  const index = users.findIndex((u) => u.id === id && u.role === 'parent');
  if (index === -1) throw new HttpError(404, 'Parent not found');
  return index;
}

// Replace the children of one parent with `studentIds`, keeping existing links.
async function setChildren(parentId, studentIds) {
  await updateData('parentStudents', (links) => {
    const others = links.filter((l) => l.parentId !== parentId);
    const mine = studentIds.map(
      (studentId) =>
        links.find((l) => l.parentId === parentId && l.studentId === studentId) ?? {
          id: newId(),
          parentId,
          studentId,
        }
    );
    return [...others, ...mine];
  });
}

// Parents with their children (name, roll number and current class).
async function listParents() {
  const [users, links, students, classes] = await Promise.all([
    readData('users'),
    readData('parentStudents'),
    readData('students'),
    readData('classes'),
  ]);
  return users
    .filter((u) => u.role === 'parent')
    .map((parent) => ({
      ...publicUser(parent),
      children: links
        .filter((l) => l.parentId === parent.id)
        .map((l) => students.find((s) => s.id === l.studentId))
        .filter(Boolean)
        .map((s) => ({
          studentId: s.id,
          name: s.name,
          rollNumber: s.rollNumber,
          classId: s.classId,
          className: classes.find((c) => c.id === s.classId)?.name ?? '',
        })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function findParent(id) {
  const parent = (await listParents()).find((p) => p.id === id);
  if (!parent) throw new HttpError(404, 'Parent not found');
  return parent;
}

// GET /api/parents
router.get('/', async (req, res) => {
  res.json(await listParents());
});

// POST /api/parents
router.post('/', async (req, res) => {
  const { studentIds, ...input } = cleanParentInput(req.body, true);
  await checkStudentsExist(studentIds);
  const id = newId();
  await updateData('users', (users) => {
    checkUsernameFree(users, input.username);
    return [...users, { id, ...input, role: 'parent' }];
  });
  await setChildren(id, studentIds);
  res.status(201).json(await findParent(id));
});

// PUT /api/parents/:id
router.put('/:id', async (req, res) => {
  const { studentIds, ...input } = cleanParentInput(req.body, false);
  await checkStudentsExist(studentIds);
  await updateData('users', (users) => {
    const index = findParentIndex(users, req.params.id);
    checkUsernameFree(users, input.username, req.params.id);

    const updated = { ...users[index], name: input.name, username: input.username };
    if (input.password) updated.password = input.password;

    const copy = [...users];
    copy[index] = updated;
    return copy;
  });
  await setChildren(req.params.id, studentIds);
  res.json(await findParent(req.params.id));
});

// POST /api/parents/:id/disable and /enable
// A disabled parent can't log in (and is logged out). Their children and
// messages are kept, so enabling them again puts everything back.
for (const [action, disabled] of [['disable', true], ['enable', false]]) {
  router.post(`/:id/${action}`, async (req, res) => {
    await updateData('users', (users) => {
      const index = findParentIndex(users, req.params.id);
      const copy = [...users];
      copy[index] = { ...users[index], disabled };
      return copy;
    });
    res.json(await findParent(req.params.id));
  });
}

// DELETE /api/parents/:id
// The database also removes their links to students and their messages.
router.delete('/:id', async (req, res) => {
  await updateData('users', (users) => {
    const index = findParentIndex(users, req.params.id);
    return users.filter((_, i) => i !== index);
  });
  res.status(204).end();
});

module.exports = { router, listParents };
