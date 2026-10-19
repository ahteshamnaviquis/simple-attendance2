// Submission tracker: which classes submitted attendance on which days.
// Used on both dashboards:
//   admin   - every class, with its teacher's name, and late reports highlighted
//   teacher - only their own classes, so they can see and fill missed days
//
// Rows are classes, columns are the last 14 days ending on `endDate`.
//   ✓  submitted on the day
//   ⏱  submitted or edited after the day (shown only when showLate is true)
//   !  no report (missed)
//   –  no school: nobody in the school submitted anything that day
//
// Click a cell to open the attendance form for that class and date
// (a new report when missing, the existing report otherwise).
// Click a date to see which teachers and classes did not submit that day.

import { useState } from 'react';
import { addDays, formatLongDate, formatShortDay, lateInfo } from '../utils';

const DAYS = 14;

export default function SubmissionTracker({ classes, reports, schoolDays, endDate, showLate, onOpenCell }) {
  const [selectedDay, setSelectedDay] = useState(null);
  const isAdmin = showLate; // only the admin view shows teachers and late reports

  const days = [];
  for (let i = DAYS - 1; i >= 0; i--) days.push(addDays(endDate, -i));

  const reportFor = new Map(reports.map((r) => [`${r.classId}|${r.date}`, r]));
  const isSchoolDay = (day) => schoolDays.has(day);

  // Admin: group rows by teacher name, then class name.
  const rows = [...classes].sort(
    (a, b) =>
      (a.teacherName || '~').localeCompare(b.teacherName || '~') || a.name.localeCompare(b.name)
  );

  function cellState(cls, day) {
    const report = reportFor.get(`${cls.id}|${day}`);
    if (report) {
      const late = showLate ? lateInfo(report) : null;
      return late
        ? { kind: 'late', text: '⏱', label: late }
        : { kind: 'good', text: '✓', label: 'Submitted' };
    }
    if (!isSchoolDay(day)) return { kind: 'off', text: '–', label: 'No school (nobody submitted)' };
    return { kind: 'missing', text: '!', label: 'Not submitted - click to fill in' };
  }

  const submittedCount = (day) => classes.filter((c) => reportFor.has(`${c.id}|${day}`)).length;

  // Totals for the summary line
  const schoolDaysShown = days.filter(isSchoolDay);
  let missedTotal = 0;
  let lateTotal = 0;
  for (const day of days) {
    for (const cls of classes) {
      const kind = cellState(cls, day).kind;
      if (kind === 'missing') missedTotal++;
      if (kind === 'late') lateTotal++;
    }
  }

  // Details for the clicked date
  const missingOnDay = selectedDay
    ? rows.filter((c) => cellState(c, selectedDay).kind === 'missing')
    : [];
  const lateOnDay = selectedDay ? rows.filter((c) => cellState(c, selectedDay).kind === 'late') : [];

  let summary =
    missedTotal === 0
      ? 'No missed reports on school days.'
      : `${missedTotal} missed ${missedTotal === 1 ? 'report' : 'reports'} on ${schoolDaysShown.length} school days.`;
  if (showLate && lateTotal > 0) summary += ` ${lateTotal} submitted or edited late.`;

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{isAdmin ? 'Submission tracker' : 'My submissions'} · last 14 days</h2>
          <div className="cell-sub">
            {summary} Click a cell to open that day&apos;s attendance, or a date for details.
          </div>
        </div>
        <div className="legend">
          <span><span className="tcell good">✓</span> Submitted</span>
          {showLate && <span><span className="tcell late">⏱</span> Late / edited later</span>}
          <span><span className="tcell missing">!</span> Missing</span>
          <span><span className="tcell off">–</span> No school</span>
        </div>
      </div>

      <div className="tracker-scroll">
        <table className="tracker">
          <thead>
            <tr>
              <th className="tracker-name">Class</th>
              {days.map((day) => {
                const done = submittedCount(day);
                const complete = done === classes.length;
                return (
                  <th key={day} className={day === selectedDay ? 'selected' : ''}>
                    <button
                      type="button"
                      className="tracker-day"
                      onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                      title={`${formatLongDate(day)}: ${done} of ${classes.length} classes submitted`}
                    >
                      <span className="tracker-weekday">{formatShortDay(day).split(' ')[0]}</span>
                      <span>{Number(day.slice(8))}</span>
                      <span
                        className={`tracker-count ${!isSchoolDay(day) && done === 0 ? 'off' : complete ? 'good' : 'missing'}`}
                      >
                        {!isSchoolDay(day) && done === 0 ? '–' : `${done}/${classes.length}`}
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((cls) => (
              <tr key={cls.id}>
                <th className="tracker-name">
                  <div className="cell-main">{cls.name}</div>
                  {isAdmin && <div className="cell-sub">{cls.teacherName || 'No teacher'}</div>}
                </th>
                {days.map((day) => {
                  const state = cellState(cls, day);
                  return (
                    <td key={day} className={day === selectedDay ? 'selected' : ''}>
                      <button
                        type="button"
                        className={`tcell ${state.kind}`}
                        onClick={() => onOpenCell(cls.id, day)}
                        title={`${cls.name}, ${formatLongDate(day)}: ${state.label}`}
                        aria-label={`${cls.name}, ${day}: ${state.label}`}
                      >
                        {state.text}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={DAYS + 1}>No classes yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details for the clicked date */}
      {selectedDay && (
        <div className="tracker-detail">
          <div className="panel-head">
            <h3>
              {formatLongDate(selectedDay)} · {submittedCount(selectedDay)} of {classes.length}{' '}
              classes submitted
            </h3>
            <button className="secondary small" onClick={() => setSelectedDay(null)}>
              Close
            </button>
          </div>

          {missingOnDay.length === 0 && lateOnDay.length === 0 && (
            <p className={isSchoolDay(selectedDay) ? 'success' : 'cell-sub'}>
              {isSchoolDay(selectedDay)
                ? '✓ All classes submitted on time.'
                : 'Nobody submitted on this day (no school?).'}
            </p>
          )}

          {(missingOnDay.length > 0 || lateOnDay.length > 0) && (
            <table className="clean">
              <thead>
                <tr>
                  {isAdmin && <th>Teacher</th>}
                  <th>Class</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {[...missingOnDay, ...lateOnDay].map((cls) => {
                  const state = cellState(cls, selectedDay);
                  return (
                    <tr key={cls.id}>
                      {isAdmin && <td className="cell-main">{cls.teacherName || 'No teacher'}</td>}
                      <td>{cls.name}</td>
                      <td>
                        {state.kind === 'missing' ? (
                          <span className="badge warning">! Not submitted</span>
                        ) : (
                          <span className="badge late" title={state.label}>⏱ {state.label}</span>
                        )}
                      </td>
                      <td className="num">
                        <button className="small" onClick={() => onOpenCell(cls.id, selectedDay)}>
                          {state.kind === 'missing' ? 'Fill in' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
