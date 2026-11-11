// Remembers the logged-in user in sessionStorage (cleared when the tab closes).
// This is NOT security - it only decides which screens are shown.

const STORAGE_KEY = 'attendanceUser';

export function getSavedUser() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function saveUser(user) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser() {
  sessionStorage.removeItem(STORAGE_KEY);
}

// The academy (school) whose look the login page shows: the one last logged in
// to on this browser, or the one in the address (?academy=<id>, a link the
// platform owner can give a school). Kept in localStorage, so it outlives the tab.
const ACADEMY_KEY = 'attendanceAcademy';

export function getSavedAcademy() {
  try {
    const fromLink = new URLSearchParams(window.location.search).get('academy');
    if (fromLink) localStorage.setItem(ACADEMY_KEY, fromLink);
    return localStorage.getItem(ACADEMY_KEY) || '';
  } catch {
    return '';
  }
}

export function saveAcademy(academyId) {
  try {
    if (academyId) localStorage.setItem(ACADEMY_KEY, academyId);
  } catch {
    // storage blocked: the login page shows the first academy
  }
}
