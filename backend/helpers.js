// Small shared helpers for the API routes.

const crypto = require('crypto');
const { readData, unscoped, withAcademy, currentAcademy, findSession, DEFAULT_ACADEMY } = require('./store');
const { passwordTag } = require('./passwords');

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

// The login token sent with a request ("Authorization: Bearer <token>"), or ''.
function tokenOf(req) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.get('Authorization') || '');
  return match ? match[1] : '';
}

// Middleware: works out who is calling from their login token (see
// createSession in store.js), and puts that user on req.user. The rest of the
// request then only sees that user's academy (see withAcademy in store.js):
//   a user of an academy   -> their academy
//   the platform owner     -> no academy (they use /api/platform, which picks one)
//   nobody logged in       -> the academy in ?academy= or the X-Academy-Id
//                             header, otherwise the first one (for the login
//                             page's look and the logo)
// A session ends (the user is logged out) when it expires, when the user is
// disabled or removed, or when their password changes.
async function loadCurrentUser(req, res, next) {
  req.user = null;
  req.token = tokenOf(req);
  const session = await findSession(req.token);
  const [users, academies] = await unscoped(() =>
    Promise.all([session ? readData('users') : [], readData('academies')])
  );

  let academyId;
  const user = session && users.find(
    (u) => u.id === session.userId && !u.disabled && passwordTag(u.password) === session.passwordTag
  );
  if (user?.role === 'owner') {
    req.user = { ...publicUser(user), permissions: {} };
    academyId = null;
  } else if (user && academies.some((a) => a.id === user.academyId && !a.disabled)) {
    // (a user of a disabled academy is logged out too)
    academyId = user.academyId;
    req.user = { ...publicUser(user), permissions: await withAcademy(academyId, () => permissionsFor(user)) };
  } else {
    const asked = String(req.query?.academy || req.get('X-Academy-Id') || '');
    const academy =
      academies.find((a) => a.id === asked) ?? academies.find((a) => a.id === DEFAULT_ACADEMY) ?? academies[0];
    academyId = academy?.id ?? null;
  }
  withAcademy(academyId, next);
}

// The current academy's username prefix (see usernamePrefix.js), '' for none.
async function academyPrefix() {
  const id = currentAcademy();
  return (await readData('academies')).find((a) => a.id === id)?.prefix ?? '';
}

// The areas each role may manage. The super admin always has teachers, exams
// and parents; admins have whatever the super admin allowed in the settings table.
async function permissionsFor(user) {
  if (user.role === 'superadmin') return { teachers: true, exams: true, parents: true };
  if (user.role === 'admin') {
    const { readSettings } = require('./settings'); // here, not at the top: settings.js uses this file
    return (await readSettings()).adminPermissions;
  }
  return {};
}

// True when the user may manage this area (students, classes, subjects, teachers, exams, parents).
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
//   superadmin - admin accounts, settings, teachers, examinations and parents
//   admin      - dashboard and attendance reports, plus the areas the super
//                admin allows (by default students, classes, subjects and parents)
// Parents only use their own /api/parent routes, so they are not in requireLogin.
function isAdmin(user) {
  return user?.role === 'admin';
}

// Above them all, the platform owner (role "owner", no academy) adds academies
// and their super admins (routes/platform.js), and sees nothing else.
const requireLogin = requireRole('superadmin', 'admin', 'teacher');
const requireSuperAdmin = requireRole('superadmin');
const requireOwner = requireRole('owner');
const requireParent = requireRole('parent');

module.exports = {
  HttpError,
  newId,
  publicUser,
  todayString,
  isValidDate,
  loadCurrentUser,
  academyPrefix,
  isAdmin,
  can,
  requireRole,
  requireArea,
  requireLogin,
  requireSuperAdmin,
  requireOwner,
  requireParent,
};
