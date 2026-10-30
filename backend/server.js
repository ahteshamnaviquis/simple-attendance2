// Express API for the Simple Daily Attendance & Class Management System.
// LOCAL PROTOTYPE ONLY - do not expose this server publicly.
//
// Express 5 passes errors from async route handlers to the error handler
// at the bottom automatically, so routes do not need try/catch.

const express = require('express');
const seedData = require('./seedData');
const { PORT, HOST, DB, FRONTEND_URLS } = require('./config');
const { initDatabase, readData, updateData } = require('./store');
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

const app = express();

// CORS: let the frontend (FRONTEND_URL in .env) call this API from the browser.
app.use((req, res, next) => {
  const origin = req.get('Origin');
  if (FRONTEND_URLS.includes(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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

// Login: check username and password against the users table.
// Returns the user (without password) on success. No tokens or sessions -
// the frontend simply remembers who logged in. LOCAL DEMO ONLY.
app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }

  const users = await readData('users');
  console.log(`Attempting login for username: ${users}`);
  const user = users.find(
    (u) => u.username.toLowerCase() === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  if (user.disabled) {
    return res
      .status(403)
      .json({ error: 'This account has been disabled. Please contact the super admin.' });
  }
  res.json(publicUser(user));
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
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

// Databases filled from older data may have no super admin: add the
// starting super admin account so someone can manage the admins.
async function ensureSuperAdmin() {
  const starting = seedData.users.find((u) => u.role === 'superadmin');
  await updateData('users', (users) => {
    if (users.some((u) => u.role === 'superadmin')) return users;
    if (users.some((u) => u.username.toLowerCase() === starting.username)) {
      console.warn(`No super admin: the username "${starting.username}" is already used`);
      return users;
    }
    console.log(`Added super admin "${starting.username}"`);
    return [starting, ...users];
  });
}

initDatabase(seedData)
  .then(ensureSuperAdmin)
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
