// Express API for the Simple Daily Attendance & Class Management System.
// LOCAL PROTOTYPE ONLY - do not expose this server publicly.
//
// Express 5 passes errors from async route handlers to the error handler
// at the bottom automatically, so routes do not need try/catch.

const express = require('express');
const { PORT, HOST, DATA_DIR } = require('./config');
const { initDataFiles, readData } = require('./fileStore');
const { publicUser, loadCurrentUser, requireAdmin } = require('./helpers');
const teachersRouter = require('./routes/teachers');
const classesRouter = require('./routes/classes');
const attendanceRouter = require('./routes/attendance');
const studentsRouter = require('./routes/students');

const app = express();

app.use(express.json());
app.use(loadCurrentUser);

// Health check: confirms the API is running.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Login: check username and password against users.json.
// Returns the user (without password) on success. No tokens or sessions -
// the frontend simply remembers who logged in. LOCAL DEMO ONLY.
app.post('/api/login', async (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    return res.status(400).json({ error: 'Please enter username and password' });
  }

  const users = await readData('users');
  const user = users.find(
    (u) => u.username.toLowerCase() === username && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  res.json(publicUser(user));
});

// List all users (without passwords). Admin only.
app.get('/api/users', requireAdmin, async (req, res) => {
  const users = await readData('users');
  res.json(users.map(publicUser));
});

app.use('/api/teachers', teachersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/students', studentsRouter);

// Unknown API routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: known errors (HttpError, bad JSON) get their own status,
// anything else is logged and reported as a general server error.
app.use((err, req, res, next) => {
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

initDataFiles()
  .then(() => {
    // HOST defaults to 127.0.0.1 so the prototype is not reachable from other computers.
    app.listen(PORT, HOST, () => {
      console.log(`API running at http://${HOST}:${PORT}`);
      console.log(`Data folder: ${DATA_DIR}`);
    });
  })
  .catch((err) => {
    console.error('Could not prepare data files:', err);
    process.exit(1);
  });
