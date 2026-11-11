// Each academy's usernames start with its 3-letter prefix and a dot ("gvs.sara").
// The platform owner chooses the prefix when adding the academy; it never changes.
// Keep suggestPrefix in step with backend/usernamePrefix.js.

// "Green Valley School" -> "gvs", "Daily Attendance" -> "dat", "Beaconhouse" -> "bea"
export function suggestPrefix(name) {
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

// "gvs.sara" -> "sara" (what is typed after the fixed prefix).
export function withoutPrefix(username, prefix) {
  return prefix && username.startsWith(`${prefix}.`) ? username.slice(prefix.length + 1) : username;
}
