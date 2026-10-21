const pad = (n) => String(n).padStart(2, '0');

// A Date -> "YYYY-MM-DD" in local time (what <input type="date"> uses).
function toDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// "YYYY-MM-DD" -> a local Date at midnight.
function fromDateString(text) {
  return new Date(`${text}T00:00:00`);
}

// Today's date as YYYY-MM-DD in local time.
export function todayString() {
  return toDateString(new Date());
}

// addDays("2026-10-19", -1) -> "2026-10-18"
export function addDays(dateText, days) {
  const d = fromDateString(dateText);
  d.setDate(d.getDate() + days);
  return toDateString(d);
}

// "2026-10-19" -> "Monday, 19 October 2026" (in the computer's language)
export function formatLongDate(dateText) {
  return fromDateString(dateText).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// "2026-10-19" -> "19 Oct 2026"
export function formatMediumDate(dateText) {
  return fromDateString(dateText).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// "2026-10-19" -> "Monday"
export function weekdayName(dateText) {
  return fromDateString(dateText).toLocaleDateString(undefined, { weekday: 'long' });
}

// "2026-10-19" -> "Mon 19"
export function formatShortDay(dateText) {
  const d = fromDateString(dateText);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
}

// "2026-10-19T07:48:57.344Z" -> local date and time, e.g. "19/10/2026, 12:48"
export function formatDateTime(isoText) {
  if (!isoText) return '';
  return new Date(isoText).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// The local calendar date (YYYY-MM-DD) of a saved timestamp.
export function localDateOf(isoText) {
  return toDateString(new Date(isoText));
}

// Was this report submitted or last edited after its attendance date?
// Returns a short description, or null when it was done on the day.
export function lateInfo(report) {
  const created = localDateOf(report.createdAt);
  const updated = localDateOf(report.updatedAt);
  if (created > report.date) return `Submitted late, on ${created}`;
  if (updated > report.date) return `Edited later, on ${updated}`;
  return null;
}

// present / (present + absent) as a whole percent, or null when there is no data.
export function attendanceRate(present, absent) {
  const total = present + absent;
  return total > 0 ? Math.round((present / total) * 100) : null;
}

// 73.33 -> "73.33%", null -> "—" (the backend already rounds to 2 decimals)
export function formatPercent(value) {
  return value === null || value === undefined ? '—' : `${value}%`;
}

// Default pass marks: 33% of the maximum, rounded up (100 -> 33, 50 -> 17).
// Same rule as the backend (results.js).
export function defaultPassMarks(maxMarks) {
  return Math.ceil(maxMarks * 0.33 - 1e-9);
}
