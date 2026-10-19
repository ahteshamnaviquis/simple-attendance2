// Settings the browser code can read (from frontend/.env, see .env.example).
// Only variables starting with VITE_ reach the browser - never put secrets here.

export const APP_TITLE = import.meta.env.VITE_APP_TITLE || 'Daily Attendance';
