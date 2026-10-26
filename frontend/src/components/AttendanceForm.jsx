// The daily attendance form. Used in two ways:
//
// 1. New attendance (teacher): pick a class and date. If a report already
//    exists for that class and date, it is loaded so you edit it instead of
//    creating a duplicate.
// 2. Editing a report from the reports list (`report` prop given): the class
//    and date are fixed; only the counts and absent students can change.
//
// `initialClassId` / `initialDate` pre-select a class and date (used when a
// day is clicked in the submission tracker).
//
// When the class has students, they are listed as a roster: click a student to
// switch them between present and absent, and give absent students a reason.
// Total, present and absent are then counted from the roster automatically.
// Classes without a student list fall back to typing the counts by hand.

import { useEffect, useState } from 'react';
import { getReports, getStudents, createReport, updateReport } from '../api';
import { todayString, formatDateTime } from '../utils';

const EMPTY_COUNTS = {
  totalStudents: '',
  present: '',
  absent: '',
  addedToday: '0',
  leftToday: '0',
};

const COUNT_LABELS = {
  totalStudents: 'Total students',
  present: 'Present',
  absent: 'Absent',
  addedToday: 'Added today',
  leftToday: 'Left today',
};

const COMMON_REASONS = ['Sick', 'Family reason', 'Travelling', 'Appointment', 'Unknown'];

function countsFrom(report) {
  const counts = {};
  for (const field of Object.keys(EMPTY_COUNTS)) {
    counts[field] = String(report[field]);
  }
  return counts;
}

export default function AttendanceForm({
  classes,
  report,
  initialClassId,
  initialDate,
  onSaved,
  onCancel,
}) {
  const fixed = Boolean(report); // class and date cannot be changed

  const [classId, setClassId] = useState(
    report?.classId || initialClassId || (classes.length === 1 ? classes[0].id : '')
  );
  const [date, setDate] = useState(report?.date || initialDate || todayString());
  const [counts, setCounts] = useState(report ? countsFrom(report) : EMPTY_COUNTS);
  const [absentees, setAbsentees] = useState(report?.absentees || []);
  const [existing, setExisting] = useState(report || null); // the saved report being edited
  const [students, setStudents] = useState([]); // students of the selected class
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [justMarked, setJustMarked] = useState(''); // student just marked absent
  // Names the teacher marked present. null = a saved report, where everyone
  // not absent was present. A new report starts with nobody marked.
  const [presentNames, setPresentNames] = useState(report ? null : []);

  // Load the class's students (used for name suggestions and the total).
  useEffect(() => {
    if (!classId) {
      setStudents([]);
      return;
    }
    let cancelled = false;
    getStudents({ classId })
      .then((list) => !cancelled && setStudents(list))
      .catch(() => !cancelled && setStudents([]));
    return () => {
      cancelled = true;
    };
  }, [classId]);

  // When the class or date changes, check whether a report already exists.
  // For a new report, the total starts as the number of students in the class.
  useEffect(() => {
    if (fixed || !classId || !date) return;
    let cancelled = false;
    setError('');
    setMessage('');
    Promise.all([getReports({ classId, date }), getStudents({ classId })])
      .then(([list, classStudents]) => {
        if (cancelled) return;
        const found = list[0] || null;
        setExisting(found);
        if (found) {
          setCounts(countsFrom(found));
          setAbsentees(found.absentees);
          setPresentNames(null);
        } else {
          const total = classStudents.length ? String(classStudents.length) : '';
          setCounts({ ...EMPTY_COUNTS, totalStudents: total });
          setAbsentees([]);
          setPresentNames([]);
        }
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [fixed, classId, date]);

  // Live checks shown while typing (the backend checks again when saving).
  const total = Number(counts.totalStudents);
  const present = Number(counts.present);
  const absent = Number(counts.absent);
  const countsFilled = counts.totalStudents !== '' && counts.present !== '' && counts.absent !== '';
  const sumMismatch = countsFilled && present + absent !== total;
  const namedCount = absentees.filter((a) => a.name.trim()).length;
  const tooManyNames = counts.absent !== '' && namedCount > absent;

  // Roster mode: counts come from the student list and the absent names.
  const rosterMode = students.length > 0;
  const rosterNames = new Set(students.map((s) => s.name));
  // Absent students who are not in the class list (e.g. removed since).
  const otherAbsentees = absentees
    .map((a, index) => ({ ...a, index }))
    .filter((a) => !rosterNames.has(a.name));
  const rosterTotal = students.length + otherAbsentees.filter((a) => a.name.trim()).length;
  const rosterAbsent = namedCount;

  function handleCountChange(event) {
    setCounts({ ...counts, [event.target.name]: event.target.value });
  }

  function fillAbsent() {
    if (counts.totalStudents !== '' && counts.present !== '' && total >= present) {
      setCounts({ ...counts, absent: String(total - present) });
    }
  }

  function updateAbsentee(index, field, value) {
    setAbsentees(absentees.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function addAbsentee() {
    setAbsentees([...absentees, { name: '', reason: '' }]);
  }

  const absentNames = new Set(absentees.map((a) => a.name));

  // Each student is 'present', 'absent' or '' (not marked yet).
  function statusOf(name) {
    if (absentNames.has(name)) return 'absent';
    if (presentNames === null || presentNames.includes(name)) return 'present';
    return '';
  }
  const rosterPresent = students.filter((s) => statusOf(s.name) === 'present').length;
  const unmarked = students.filter((s) => statusOf(s.name) === '').length;

  function removeAbsentee(index) {
    setAbsentees(absentees.filter((_, i) => i !== index));
  }

  // Roster: mark a student present or absent.
  function setAbsent(studentName, isAbsent) {
    if (isAbsent) {
      if (absentNames.has(studentName)) return;
      setAbsentees([...absentees, { name: studentName, reason: '' }]);
      setJustMarked(studentName); // focus their reason box
      if (presentNames) setPresentNames(presentNames.filter((n) => n !== studentName));
    } else {
      setAbsentees(absentees.filter((a) => a.name !== studentName));
      if (presentNames && !presentNames.includes(studentName)) {
        setPresentNames([...presentNames, studentName]);
      }
    }
  }

  function setReason(studentName, reason) {
    setAbsentees(absentees.map((a) => (a.name === studentName ? { ...a, reason } : a)));
  }

  // Marks the students not marked yet as present (absent ones stay absent).
  function markRestPresent() {
    if (presentNames) setPresentNames(students.map((s) => s.name).filter((n) => !absentNames.has(n)));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (rosterMode && unmarked > 0) {
      setError(`Please mark all students. ${unmarked} not marked yet.`);
      return;
    }
    setSaving(true);
    try {
      const finalCounts = rosterMode
        ? { ...counts, totalStudents: rosterTotal, present: rosterPresent, absent: rosterAbsent }
        : counts;
      const payload = { classId, date, ...finalCounts, absentees };
      const saved = existing
        ? await updateReport(existing.id, payload)
        : await createReport(payload);
      setExisting(saved);
      setCounts(countsFrom(saved));
      setAbsentees(saved.absentees);
      setPresentNames(null);
      setMessage(existing ? 'Report updated.' : 'Report saved.');
      if (onSaved) onSaved(saved);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{existing ? 'Edit attendance report' : 'New attendance report'}</h2>

      <div className="form-grid">
        <label>
          Class
          {fixed ? (
            <input value={report.className} disabled />
          ) : (
            <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">— Choose a class —</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </label>
        <label>
          Date
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(e) => setDate(e.target.value)}
            disabled={fixed}
            required
          />
        </label>
      </div>

      {existing && !fixed && (
        <p className="info">
          A report already exists for this class on this date. Saving will update it.
        </p>
      )}

      {rosterMode ? (
        <>
          <div className="roster-summary">
            <div className="roster-stats">
              <div className="roster-stat">
                <span>Total students</span>
                <strong>{rosterTotal}</strong>
              </div>
              <div className="roster-stat present">
                <span>Present</span>
                <strong>{rosterPresent}</strong>
              </div>
              <div className="roster-stat absent">
                <span>Absent</span>
                <strong>{rosterAbsent}</strong>
              </div>
              <div className={unmarked ? 'roster-stat unmarked' : 'roster-stat'}>
                <span>Not marked</span>
                <strong>{unmarked}</strong>
              </div>
              <div className="roster-stat rate">
                <span>Attendance</span>
                <strong>{rosterTotal ? Math.round((rosterPresent / rosterTotal) * 100) : 0}%</strong>
                <div className="roster-meter">
                  <div
                    style={{ width: `${rosterTotal ? (rosterPresent / rosterTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="roster-movement">
              {['addedToday', 'leftToday'].map((field) => (
                <label key={field}>
                  {COUNT_LABELS[field]}
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name={field}
                    value={counts[field]}
                    onChange={handleCountChange}
                    required
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="roster-head">
            <div>
              <h3>Students</h3>
              <span className="note">
                Mark every student present or absent. Add a reason for absent students.
              </span>
            </div>
            <button
              type="button"
              className="secondary small"
              onClick={markRestPresent}
              disabled={unmarked === 0}
            >
              Mark remaining present
            </button>
          </div>
          <div className="roster" role="table" aria-label="Students">
            <div className="roster-row roster-header" role="row">
              <span role="columnheader">Roll</span>
              <span role="columnheader">Student</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">Reason</span>
            </div>
            {students.map((s) => {
              const entry = absentees.find((a) => a.name === s.name);
              const status = statusOf(s.name);
              return (
                <div key={s.id} className={`roster-row ${status || 'unmarked'}`} role="row">
                  <span className="roster-roll" role="cell">
                    {s.rollNumber || '–'}
                  </span>
                  <span className="roster-name" role="cell">
                    {s.name}
                  </span>
                  <span className="status-toggle" role="cell">
                    <button
                      type="button"
                      className={status === 'present' ? 'present active' : 'present'}
                      aria-pressed={status === 'present'}
                      onClick={() => setAbsent(s.name, false)}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      className={status === 'absent' ? 'absent active' : 'absent'}
                      aria-pressed={status === 'absent'}
                      onClick={() => setAbsent(s.name, true)}
                    >
                      Absent
                    </button>
                  </span>
                  <span className="roster-reason" role="cell">
                    {entry ? (
                      <input
                        placeholder="Reason for absence"
                        aria-label={`Reason ${s.name} is absent`}
                        list="absence-reasons"
                        value={entry.reason}
                        onChange={(e) => setReason(s.name, e.target.value)}
                        autoFocus={s.name === justMarked}
                      />
                    ) : (
                      <span className="roster-dash">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>

          {otherAbsentees.length > 0 && (
            <>
              <h3>Other absent students</h3>
              <p className="note">
                These names are not in the class list. They are counted as absent.
              </p>
              {otherAbsentees.map((a) => (
                <div className="absentee-row" key={a.index}>
                  <input
                    placeholder="Student name"
                    value={a.name}
                    onChange={(e) => updateAbsentee(a.index, 'name', e.target.value)}
                  />
                  <input
                    placeholder="Reason"
                    list="absence-reasons"
                    value={a.reason}
                    onChange={(e) => updateAbsentee(a.index, 'reason', e.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary small"
                    onClick={() => removeAbsentee(a.index)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </>
          )}
        </>
      ) : (
        <>
          <h3>Student counts</h3>
          <div className="form-grid counts">
            {Object.entries(COUNT_LABELS).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  type="number"
                  min="0"
                  step="1"
                  name={field}
                  value={counts[field]}
                  onChange={handleCountChange}
                  required
                />
              </label>
            ))}
          </div>
          <button type="button" className="secondary small" onClick={fillAbsent}>
            Absent = Total − Present
          </button>
          {sumMismatch && (
            <p className="error">
              Present ({present}) + Absent ({absent}) = {present + absent}, but Total is {total}.
            </p>
          )}

          <h3>Absent students</h3>
          <p className="note">
            {namedCount} of {counts.absent === '' ? '?' : absent} absent students named. Add a row for
            each absent student you know.
          </p>
          {absentees.map((a, index) => (
            <div className="absentee-row" key={index}>
              <input
                placeholder="Student name"
                value={a.name}
                onChange={(e) => updateAbsentee(index, 'name', e.target.value)}
              />
              <input
                placeholder="Reason"
                list="absence-reasons"
                value={a.reason}
                onChange={(e) => updateAbsentee(index, 'reason', e.target.value)}
              />
              <button type="button" className="secondary small" onClick={() => removeAbsentee(index)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="secondary small" onClick={addAbsentee}>
            + Add absent student
          </button>
          {tooManyNames && (
            <p className="error">
              You listed {namedCount} names, but the absent count is {absent}.
            </p>
          )}
        </>
      )}
      <datalist id="absence-reasons">
        {COMMON_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {existing && (
        <p className="note">
          Last updated by {existing.updatedBy} on {formatDateTime(existing.updatedAt)}.
        </p>
      )}
      {rosterMode && unmarked > 0 && !error && (
        <p className="note">
          {unmarked} of {students.length} students not marked yet.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="actions">
        <button type="submit" disabled={saving || !classId}>
          {saving ? 'Saving...' : existing ? 'Save changes' : 'Save report'}
        </button>
        {onCancel && (
          <button type="button" className="secondary" onClick={onCancel}>
            {message ? 'Back' : 'Cancel'}
          </button>
        )}
      </div>
    </form>
  );
}
