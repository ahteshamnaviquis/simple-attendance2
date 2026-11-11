// Password hashing with scrypt (built into Node.js, no extra package).
// A saved password looks like "scrypt$<salt>$<hash>" (base64). The plain
// password is never stored: store.js hashes any plain password before saving
// a user, and upgrades plain passwords left from older versions on start.

const crypto = require('crypto');

const PREFIX = 'scrypt$';
const KEY_LENGTH = 64;

function isHashed(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, KEY_LENGTH);
  return `${PREFIX}${salt.toString('base64')}$${hash.toString('base64')}`;
}

// True when `password` matches the saved hash. Takes the same time whether or
// not it matches, so timing doesn't give anything away.
function verifyPassword(password, saved) {
  if (!isHashed(saved)) return false;
  const [salt, hash] = saved.slice(PREFIX.length).split('$');
  const expected = Buffer.from(hash ?? '', 'base64');
  if (!salt || expected.length !== KEY_LENGTH) return false;
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, 'base64'), KEY_LENGTH);
  return crypto.timingSafeEqual(actual, expected);
}

// A short fingerprint of a saved hash. A session remembers it, so changing the
// password logs out every other session of that user (sessions.js).
function passwordTag(saved) {
  return crypto.createHash('sha256').update(String(saved)).digest('base64').slice(0, 16);
}

module.exports = { isHashed, hashPassword, verifyPassword, passwordTag };
