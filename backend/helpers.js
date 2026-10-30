// Small shared helpers for the API routes.

const crypto = require('crypto');
const { readData } = require('./store');

// An error with an HTTP status code. Throw it from a route (or from inside
// updateData) and the error handler in server.js sends it to the browser.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function newId() {
  return crypto.randomUUID();
}

// Remove the password before sending a user to the browser.
function publicUser(user) {
  const { password, ...rest } = user;
  return rest;
}

// Today's date as YYYY-MM-DD in this computer's local time zone.
function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// True for a real calendar date written as YYYY-MM-DD.
function isValidDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !isNaN(date) && date.toISOString().slice(0, 10) === text;
}

// Middleware: works out who is calling from the X-User-Id header that the
// frontend sends after login, and puts that user on req.user.
//
// NOT REAL SECURITY: anyone can send any id in this header. It only lets the
// backend apply the role rules for honest users of a local prototype.
async function loadCurrentUser(req, res, next) {
  const id = req.get('X-User-Id');
  req.user = null;
  if (id) {
    const users = await readData('users');
    const user = users.find((u) => u.id === id && !u.disabled); // a disabled user is logged out
    if (user) req.user = { ...publicUser(user), permissions: await permissionsFor(user) };
  }
  next();
}

// The areas each role may manage. The super admin always has teachers and
// exams; admins have whatever the super admin allowed in the settings table.
async function permissionsFor(user) {
  if (user.role === 'superadmin') return { teachers: true, exams: true };
  if (user.role === 'admin') {
    const { readSettings } = require('./settings'); // here, not at the top: settings.js uses this file
    return (await readSettings()).adminPermissions;
  }
  return {};
}

// True when the user may manage this area (students, classes, subjects, teachers, exams).
function can(user, area) {
  return Boolean(user?.permissions?.[area]);
}

// Middleware: only let users who may manage this area continue.
function requireArea(area) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in again' });
    }
    if (!can(req.user, area)) {
      return res.status(403).json({ error: 'You are not allowed to do this' });
    }
    next();
  };
}

// Middleware: only let users with one of the given roles continue.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in again' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not allowed to do this' });
    }
    next();
  };
}

// Two kinds of administrator:
//   superadmin - admin accounts, settings, teachers and examinations
//   admin      - dashboard and attendance reports, plus the areas the super
//                admin allows (by default students, classes and subjects)
function isAdmin(user) {
  return user?.role === 'admin';
}

const requireLogin = requireRole('superadmin', 'admin', 'teacher');
const requireSuperAdmin = requireRole('superadmin');

module.exports = {
  HttpError,
  newId,
  publicUser,
  todayString,
  isValidDate,
  loadCurrentUser,
  isAdmin,
  can,
  requireRole,
  requireArea,
  requireLogin,
  requireSuperAdmin,
};
