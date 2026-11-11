// Each academy has a 3-letter prefix (such as "gvs" for Green Valley School),
// chosen once by the platform owner when the academy is added and never changed.
// Every username made in the academy starts with it and a dot: "gvs.sara".
// Only the platform owner chooses it; everyone else just types the part after the dot.
// (Keep suggestPrefix in step with frontend/src/usernamePrefix.js.)

// (Not helpers.js's HttpError: store.js uses this file, and helpers.js uses store.js.)
function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

// "Green Valley School" -> "gvs", "Daily Attendance" -> "dat", "Beaconhouse" -> "bea"
function suggestPrefix(name) {
  const words = String(name ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .split(' ')
    .filter(Boolean);
  let letters;
  if (words.length >= 3) letters = words.slice(0, 3).map((w) => w[0]).join('');
  else if (words.length === 2) letters = words[0][0] + words[1].slice(0, 2);
  else letters = words.join('').slice(0, 3);
  return (letters + 'xxx').slice(0, 3);
}

// The suggestion, or when another academy has it, the first free one like it.
function freePrefix(name, taken) {
  const base = suggestPrefix(name);
  if (!taken.has(base)) return base;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  for (const c of alphabet) if (!taken.has(base.slice(0, 2) + c)) return base.slice(0, 2) + c;
  for (const b of alphabet) for (const c of alphabet) if (!taken.has(base[0] + b + c)) return base[0] + b + c;
  throw new Error('No free username prefix');
}

function cleanPrefix(value) {
  const prefix = String(value ?? '').trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(prefix)) throw badRequest('The username prefix must be exactly 3 letters');
  return prefix;
}

// The username to save: the academy's prefix, a dot, and what was typed (a
// typed prefix is not doubled). `current` is the account's username when
// editing: left as it is when not changed, so accounts made before prefixes
// keep working until their username is changed.
function withPrefix(prefix, typed, current) {
  const username = String(typed ?? '').trim().toLowerCase();
  if (current && username === current.toLowerCase()) return current;
  if (!prefix) return username;
  const rest = username.startsWith(`${prefix}.`) ? username.slice(prefix.length + 1) : username;
  if (!rest) throw badRequest('Username is required');
  return `${prefix}.${rest}`;
}

module.exports = { suggestPrefix, freePrefix, cleanPrefix, withPrefix };
