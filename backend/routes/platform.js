// /api/platform - the platform owner (the "super super admin") manages the
// academies (schools) that use the system, and each academy's super admins.
// Everything else in an academy (admins, teachers, students, ...) is managed
// by its super admin, as before, and stays in that academy.
//
//   GET    /academies                      every academy with its super admins and a few counts
//   POST   /academies                      { name, prefix, superAdmin: { name, username, password } }
//                                           prefix: 3 letters every username in it starts with
//                                           (left out: made from the name); never changed later
//   PUT    /academies/:id                  { name }
//   POST   /academies/:id/disable|enable   a disabled academy's users can't log in
//   POST   /academies/:id/super-admins     { name, username, password }
//   PUT    /super-admins/:id               { name, username, password }  (blank password = keep)
//   DELETE /super-admins/:id               not an academy's last super admin

const express = require('express');
const { readData, updateData, updateMany, unscoped, withAcademy } = require('../store');
const { HttpError, newId, publicUser, requireOwner } = require('../helpers');
const { settings: DEFAULT_SETTINGS } = require('../seedData');
const { suggestPrefix, cleanPrefix, withPrefix } = require('../usernamePrefix');

const router = express.Router();
router.use(requireOwner);

function cleanAcademyName(body) {
  const name = String(body?.name ?? '').trim();
  if (!name) throw new HttpError(400, 'Academy name is required');
  if (name.length > 100) throw new HttpError(400, 'Academy name can be at most 100 characters');
  return name;
}

// Check and tidy a super admin's form. Password is required only for a new one;
// when editing, a blank password means "keep the current one".
function cleanAccount(body, isNew) {
  const name = String(body?.name ?? '').trim();
  const username = String(body?.username ?? '').trim().toLowerCase();
  const password = String(body?.password ?? '');
  if (!name) throw new HttpError(400, 'Name is required');
  if (name.length > 100) throw new HttpError(400, 'Name can be at most 100 characters');
  if (!username) throw new HttpError(400, 'Username is required');
  if (!/^[a-z0-9._-]+$/.test(username)) {
    throw new HttpError(400, 'Username can only use letters, numbers, dot, dash and underscore');
  }
  if (username.length > 60) throw new HttpError(400, 'Username can be at most 60 characters');
  if (isNew && !password) throw new HttpError(400, 'Password is required');
  return { name, username, password };
}

// Usernames are unique across every academy.
async function checkUsernameFree(username, exceptId) {
  const users = await unscoped(() => readData('users'));
  if (users.some((u) => u.id !== exceptId && u.username.toLowerCase() === username)) {
    throw new HttpError(409, `The username "${username}" is already taken`);
  }
}

function checkPrefixFree(academies, prefix) {
  const owner = academies.find((a) => a.prefix === prefix);
  if (owner) {
    throw new HttpError(409, `The prefix ${prefix.toUpperCase()} is already used by ${owner.name}. Choose any other 3 letters.`);
  }
}

function checkNameFree(academies, name, exceptId) {
  if (academies.some((a) => a.id !== exceptId && a.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, 'There is already an academy with that name');
  }
}

async function findAcademy(id) {
  const academy = (await readData('academies')).find((a) => a.id === id);
  if (!academy) throw new HttpError(404, 'Academy not found');
  return academy;
}

// A super admin's account, found across every academy.
async function findSuperAdmin(id) {
  const user = (await unscoped(() => readData('users'))).find((u) => u.id === id && u.role === 'superadmin');
  if (!user) throw new HttpError(404, 'Super admin not found');
  return user;
}

// GET /api/platform/academies
router.get('/academies', async (req, res) => {
  const [academies, users, students, classes] = await unscoped(() =>
    Promise.all([readData('academies'), readData('users'), readData('students'), readData('classes')])
  );
  const count = (list, id, test = () => true) => list.filter((x) => x.academyId === id && test(x)).length;
  res.json(
    academies
      .map((a) => ({
        ...a,
        superAdmins: users
          .filter((u) => u.academyId === a.id && u.role === 'superadmin')
          .map(publicUser)
          .sort((x, y) => x.name.localeCompare(y.name)),
        counts: {
          admins: count(users, a.id, (u) => u.role === 'admin'),
          teachers: count(users, a.id, (u) => u.role === 'teacher'),
          parents: count(users, a.id, (u) => u.role === 'parent'),
          classes: count(classes, a.id),
          students: count(students, a.id),
        },
      }))
      .sort((x, y) => x.name.localeCompare(y.name))
  );
});

// POST /api/platform/academies  { name, superAdmin: { name, username, password } }
// The academy, its settings (its name as the school name) and its first super
// admin are saved together.
router.post('/academies', async (req, res) => {
  const name = cleanAcademyName(req.body);
  const prefix = cleanPrefix(req.body?.prefix || suggestPrefix(name));
  const account = cleanAccount(req.body?.superAdmin, true);
  account.username = withPrefix(prefix, account.username);
  await checkUsernameFree(account.username);

  const academy = { id: newId(), name, prefix, createdAt: new Date().toISOString() };
  const superAdmin = { id: newId(), ...account, role: 'superadmin' };
  await withAcademy(academy.id, () =>
    updateMany(['academies', 'users', 'settings'], ({ academies, users }) => {
      checkNameFree(academies, name);
      checkPrefixFree(academies, prefix);
      return {
        academies: [...academies, academy],
        users: [...users, superAdmin],
        settings: {
          theme: { ...DEFAULT_SETTINGS.theme, schoolName: name.slice(0, 40), logo: null },
          adminPermissions: { ...DEFAULT_SETTINGS.adminPermissions },
        },
      };
    })
  );
  res.status(201).json({ ...academy, superAdmins: [publicUser({ ...superAdmin, academyId: academy.id })] });
});

// PUT /api/platform/academies/:id  { name }
// The username prefix can't be changed: the academy's usernames start with it.
// The name here is the platform's; the school name the academy shows is in its
// own settings, which its super admin changes.
router.put('/academies/:id', async (req, res) => {
  const name = cleanAcademyName(req.body);
  let saved;
  await updateData('academies', (academies) => {
    const academy = academies.find((a) => a.id === req.params.id);
    if (!academy) throw new HttpError(404, 'Academy not found');
    checkNameFree(academies, name, academy.id);
    saved = { ...academy, name };
    return academies.map((a) => (a.id === academy.id ? saved : a));
  });
  res.json(saved);
});

// POST /api/platform/academies/:id/disable and /enable
for (const action of ['disable', 'enable']) {
  router.post(`/academies/:id/${action}`, async (req, res) => {
    await findAcademy(req.params.id);
    let saved;
    await updateData('academies', (academies) =>
      academies.map((a) => {
        if (a.id !== req.params.id) return a;
        saved = { ...a, disabled: action === 'disable' };
        if (!saved.disabled) delete saved.disabled;
        return saved;
      })
    );
    res.json(saved);
  });
}

// POST /api/platform/academies/:id/super-admins  { name, username, password }
router.post('/academies/:id/super-admins', async (req, res) => {
  const academy = await findAcademy(req.params.id);
  const account = cleanAccount(req.body, true);
  account.username = withPrefix(academy.prefix, account.username);
  await checkUsernameFree(account.username);
  const created = { id: newId(), ...account, role: 'superadmin' };
  await withAcademy(academy.id, () => updateData('users', (users) => [...users, created]));
  res.status(201).json(publicUser({ ...created, academyId: academy.id }));
});

// PUT /api/platform/super-admins/:id  { name, username, password }
router.put('/super-admins/:id', async (req, res) => {
  const current = await findSuperAdmin(req.params.id);
  const account = cleanAccount(req.body, false);
  const { prefix } = await findAcademy(current.academyId);
  account.username = withPrefix(prefix, account.username, current.username);
  await checkUsernameFree(account.username, current.id);
  let updated;
  await withAcademy(current.academyId, () =>
    updateData('users', (users) =>
      users.map((u) => {
        if (u.id !== current.id) return u;
        updated = { ...u, name: account.name, username: account.username };
        if (account.password) updated.password = account.password;
        return updated;
      })
    )
  );
  res.json(publicUser(updated));
});

// DELETE /api/platform/super-admins/:id
// Records keep the name (createdBy, updatedBy, ...), so nothing else changes.
router.delete('/super-admins/:id', async (req, res) => {
  const current = await findSuperAdmin(req.params.id);
  await withAcademy(current.academyId, () =>
    updateData('users', (users) => {
      if (users.filter((u) => u.role === 'superadmin').length <= 1) {
        throw new HttpError(400, 'An academy needs at least one super admin. Add another one first.');
      }
      return users.filter((u) => u.id !== current.id);
    })
  );
  res.status(204).end();
});

module.exports = router;
