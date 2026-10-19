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
