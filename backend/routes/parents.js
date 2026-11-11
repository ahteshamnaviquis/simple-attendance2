// /api/parents - the parent directory: list, edit details, disable and remove.
// Needs the "parents" permission (the super admin always has it; admins have it
// unless the super admin turns it off in Settings).
//
// Parents are not added here: they are added with their child on the student
// form (see parentAccounts.js and routes/students.js), which also links a
// brother's or sister's existing parent.
//
// A parent as sent to the browser:
// { id, name, username, role, disabled, relation, phone, altPhone, email, cnic,
//   occupation, address, children: [{ studentId, name, rollNumber, classId, className }] }

const express = require('express');
const { readData, updateData, updateMany } = require('../store');
const { HttpError, requireArea, academyPrefix } = require('../helpers');
const { cleanParentDetails, saveParentDetails, describeParents } = require('../parentAccounts');
const { photoRoutes, deletePhotoOf } = require('../photos');

const router = express.Router();
router.use(requireArea('parents'));

function findParentIndex(users, id) {
  const index = users.findIndex((u) => u.id === id && u.role === 'parent');
  if (index === -1) throw new HttpError(404, 'Parent not found');
  return index;
}

// Every parent with their details and children.
async function listParents() {
  const [users, parentProfiles, parentStudents, students, classes] = await Promise.all([
    readData('users'),
    readData('parentProfiles'),
    readData('parentStudents'),
    readData('students'),
    readData('classes'),
  ]);
  return describeParents({ users, parentProfiles, parentStudents, students, classes });
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

// PUT /api/parents/:id - edit details (blank password = keep the current one).
// Children are changed on the student form.
router.put('/:id', async (req, res) => {
  const details = cleanParentDetails(req.body, { isNew: false });
  const prefix = await academyPrefix();
  await updateMany(['users', 'parentProfiles'], (data) => {
    findParentIndex(data.users, req.params.id);
    const changed = { ...data };
    saveParentDetails(changed, details, req.params.id, prefix);
    return changed;
  });
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

// PUT and DELETE /api/parents/:id/photo - the parent's profile photo (photos.js).
photoRoutes(router, {
  collection: 'users',
  guard: (req, res, next) => next(), // the "parents" permission is checked for the whole router
  find: (req, users) => findParentIndex(users, req.params.id),
  view: (req, parent) => findParent(parent.id),
});

// DELETE /api/parents/:id
// The database also removes their profile, links to students and messages.
router.delete('/:id', async (req, res) => {
  await updateData('users', async (users, conn) => {
    const index = findParentIndex(users, req.params.id);
    await deletePhotoOf(users[index], conn);
    return users.filter((_, i) => i !== index);
  });
  res.status(204).end();
});

module.exports = { router, listParents };
