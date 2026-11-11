// Express API for the Simple Daily Attendance & Class Management System.
// LOCAL PROTOTYPE ONLY - do not expose this server publicly.
//
// Express 5 passes errors from async route handlers to the error handler
// at the bottom automatically, so routes do not need try/catch.

const express = require('express');
const seedData = require('./seedData');
const { PORT, HOST, DB, FRONTEND_URLS, BASE_PATH, DEMO_LOGIN, DEMO_LOGIN_USERS, OWNER } = require('./config');
const { initDatabase, readData, updateData, unscoped, withAcademy, readFile, DEFAULT_ACADEMY } = require('./store');
const { fileName: photoFileName } = require('./photos');
const { publicUser, loadCurrentUser, requireRole } = require('./helpers');
const adminsRouter = require('./routes/admins');
const settingsRouter = require('./routes/settings');
const teachersRouter = require('./routes/teachers');
const classesRouter = require('./routes/classes');
const attendanceRouter = require('./routes/attendance');
const studentsRouter = require('./routes/students');
const subjectsRouter = require('./routes/subjects');
const classSubjectsRouter = require('./routes/classSubjects');
const examsRouter = require('./routes/exams');
const { router: parentsRouter } = require('./routes/parents');
const { router: messagesRouter } = require('./routes/messages');
const parentPortalRouter = require('./routes/parentPortal');
const diaryRouter = require('./routes/diary');
const leavesRouter = require('./routes/leaves');
const feedbackRouter = require('./routes/feedback');
const galleryRouter = require('./routes/gallery');
const platformRouter = require('./routes/platform');

const app = express();

// Served under a path (BASE_PATH in .env, such as "/att"): remove it, so
// /att/api/login is handled as /api/login.
// Without BASE_PATH, a request like /att/api/login (a host that passes its
// folder on) still works: one leading folder before /api is removed.
if (BASE_PATH) {
  app.use((req, res, next) => {
    if (req.url === BASE_PATH || req.url.startsWith(BASE_PATH + '/') || req.url.startsWith(BASE_PATH + '?')) {
      req.url = req.url.slice(BASE_PATH.length) || '/';
    }
    next();
  });
} else {
  app.use((req, res, next) => {
    const match = /^\/[^/?]+(\/api(?:[/?].*)?)$/.exec(req.url);
    if (match) req.url = match[1];
    next();
  });
}

// CORS: let the frontend (FRONTEND_URL in .env) call this API from the browser.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (FRONTEND_URLS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Academy-Id',
      Vary: 'Origin',
    });
  }
  // The browser's "may I?" check before the real request.
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());
app.use(loadCurrentUser);

// Health check: confirms the API is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Users and academies of every academy: usernames are unique across all of
// them, so the login page needs no academy box.
function everyone() {
  return unscoped(() => Promise.all([readData('users'), readData('academies')]));
}

// A user's academy is disabled (the platform owner has none).
function academyDisabled(user, academies) {
  if (user.role === 'owner') return false;
  const academy = academies.find((a) => a.id === user.academyId);
  return !academy || Boolean(academy.disabled);
}

// Login: check username and password against the users table.
// Returns the user (without password) on success. No tokens or sessions -
// the frontend simply remembers who logged in. LOCAL DEMO ONLY.
app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }

  const [users, academies] = await everyone();
  const user = users.find(
    (u) => u.username.toLowerCase() === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  if (academyDisabled(user, academies)) {
    return res.status(403).json({ error: 'This school has been disabled. Please contact the school.' });
  }
  if (user.disabled) {
    return res
      .status(403)
      .json({
        error:
          user.role === 'parent'
            ? 'This account has been disabled. Please contact the school.'
            : 'This account has been disabled. Please contact the super admin.',
      });
  }
  res.json(publicUser(user));
});

// Demo quick login (DEMO_LOGIN=true in .env): the users the login page offers
// as one-click buttons. When it is off, the list is empty and the page shows
// only the normal form.
// The platform owner is never offered: they always type their password.
const ROLE_ORDER = ['superadmin', 'admin', 'teacher', 'parent'];

async function demoUsers() {
  if (!DEMO_LOGIN) return [];
  const [users, academies] = await everyone();
  return users
    .filter((u) => u.role !== 'owner' && !u.disabled && !academyDisabled(u, academies))
    // (DEMO_LOGIN_USERS may leave out the academy prefix: "sara" finds "dat.sara".)
    .filter((u) => !DEMO_LOGIN_USERS.length || DEMO_LOGIN_USERS.some((name) => sameUsername(u.username, name)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name));
}

function sameUsername(username, name) {
  const full = username.toLowerCase();
  return full === name || full.slice(full.indexOf('.') + 1) === name;
}

app.get('/api/demo-login', async (req, res) => {
  const users = await demoUsers();
  res.json({
    enabled: DEMO_LOGIN,
    users: users.map((u) => ({ id: u.id, name: u.name, username: u.username, role: u.role })),
  });
});

// Log in as one of those users without a password. Refused when demo login is off.
app.post('/api/demo-login', async (req, res) => {
  if (!DEMO_LOGIN) return res.status(403).json({ error: 'Quick login is turned off' });
  const id = String(req.body?.userId || '');
  const user = (await demoUsers()).find((u) => u.id === id);
  if (!user) return res.status(404).json({ error: 'That demo user is not available' });
  res.json(publicUser(user));
});

// GET /api/photos/:academyId/:key - a profile photo (photos.js). An <img> sends
// no login: the key is random, and each upload gets a new one, so the picture
// can be kept by the browser for good.
app.get('/api/photos/:academyId/:key', async (req, res) => {
  const { academyId, key } = req.params;
  if (!/^[0-9a-f-]{36}$/.test(key)) return res.status(404).json({ error: 'Photo not found' });
  const file = await withAcademy(academyId, () => readFile(photoFileName(key)));
  if (!file) return res.status(404).json({ error: 'Photo not found' });
  res
    .set({
      'Content-Type': file.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=31536000, immutable',
    })
    .send(file.data);
});

// List all users (without passwords). Admins and the super admin only.
app.get('/api/users', requireRole('admin', 'superadmin'), async (req, res) => {
  const users = await readData('users');
  res.json(users.map(publicUser));
});

app.use('/api/admins', adminsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/teachers', teachersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/students', studentsRouter);
app.use('/api/subjects', subjectsRouter);
app.use('/api/class-subjects', classSubjectsRouter);
app.use('/api/exams', examsRouter);
app.use('/api/parents', parentsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/parent', parentPortalRouter);
app.use('/api/diary', diaryRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/gallery', galleryRouter);
app.use('/api/platform', platformRouter);

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: known errors (HttpError, bad JSON) get their own status,
// anything else is logged and reported as a general server error.
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That file is too big' });
  }
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  // Usernames are unique across every academy, but each route only checks its
  // own academy's users: the database catches the rest.
  if (err.code === 'ER_DUP_ENTRY' && /username/.test(err.sqlMessage)) {
    const taken = /Duplicate entry '([^']*)'/.exec(err.sqlMessage)?.[1];
    return res.status(409).json({ error: taken ? `The username "${taken}" is already taken` : 'That username is already taken' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

// Databases filled from older data may have no super admin: add the
// starting super admin account to the first academy so someone can manage it.
async function ensureSuperAdmin() {
  const [everyUser, academies] = await everyone();
  const academy = academies.find((a) => a.id === DEFAULT_ACADEMY);
  if (!academy) return;
  const seeded = seedData.users.find((u) => u.role === 'superadmin');
  // With the academy's username prefix, like every other username: "dat.superadmin".
  const starting = { ...seeded, username: academy.prefix ? `${academy.prefix}.${seeded.username}` : seeded.username };
  await withAcademy(DEFAULT_ACADEMY, () => updateData('users', (users) => {
    if (users.some((u) => u.role === 'superadmin')) return users;
    if (everyUser.some((u) => u.username.toLowerCase() === starting.username)) {
      console.warn(`No super admin: the username "${starting.username}" is already used`);
      return users;
    }
    console.log(`Added super admin "${starting.username}"`);
    return [starting, ...users];
  }));
}

// The platform owner (the "super super admin"), who adds academies: added when
// there is none, with OWNER_USERNAME and OWNER_PASSWORD from .env.
async function ensureOwner() {
  await unscoped(() =>
    updateData('users', (users) => {
      if (users.some((u) => u.role === 'owner')) return users;
      if (users.some((u) => u.username.toLowerCase() === OWNER.username)) {
        console.warn(`No platform owner: the username "${OWNER.username}" is already used`);
        return users;
      }
      console.log(`Added the platform owner "${OWNER.username}"`);
      return [...users, { id: 'owner', name: OWNER.name, username: OWNER.username, password: OWNER.password, role: 'owner', academyId: null }];
    })
  );
}

initDatabase(seedData)
  .then(ensureSuperAdmin)
  .then(ensureOwner)
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`API running at http://${HOST}:${PORT}`);
      console.log(`Allowed frontend: ${FRONTEND_URLS.join(', ')}`);
      console.log(`Database: ${DB.database} on ${DB.host}:${DB.port}`);
    });
  })
  .catch((err) => {
    console.error(`Could not prepare the MySQL database "${DB.database}" on ${DB.host}:${DB.port}:`, err.message);
    process.exit(1);
  });
