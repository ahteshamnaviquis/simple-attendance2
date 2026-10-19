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
        } else {
          const total = classStudents.length ? String(classStudents.length) : '';
          setCounts({ ...EMPTY_COUNTS, totalStudents: total });
          setAbsentees([]);
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

  // Click a student's name to add them to the absent list.
  function markAbsent(studentName) {
    if (absentees.some((a) => a.name === studentName)) return;
    // Reuse an empty row if there is one, otherwise add a new row.
    const emptyIndex = absentees.findIndex((a) => !a.name.trim());
    if (emptyIndex >= 0) {
      updateAbsentee(emptyIndex, 'name', studentName);
    } else {
      setAbsentees([...absentees, { name: studentName, reason: '' }]);
    }
  }

  const absentNames = new Set(absentees.map((a) => a.name));

  function removeAbsentee(index) {
    setAbsentees(absentees.filter((_, i) => i !== index));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const payload = { classId, date, ...counts, absentees };
      const saved = existing
        ? await updateReport(existing.id, payload)
        : await createReport(payload);
      setExisting(saved);
      setCounts(countsFrom(saved));
      setAbsentees(saved.absentees);
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
      {students.length > 0 && (
        <div className="student-picker">
          <span className="note">Click to mark absent:</span>
          {students.map((s) => (
            <button
              type="button"
              key={s.id}
              className={absentNames.has(s.name) ? 'chip selected' : 'chip'}
              onClick={() => markAbsent(s.name)}
              disabled={absentNames.has(s.name)}
            >
              {s.rollNumber ? `${s.rollNumber}. ` : ''}
              {s.name}
            </button>
          ))}
        </div>
      )}
      {absentees.map((a, index) => (
        <div className="absentee-row" key={index}>
          <input
            placeholder="Student name"
            list="class-students"
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
      <datalist id="class-students">
        {students.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
      <datalist id="absence-reasons">
        {COMMON_REASONS.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <button type="button" className="secondary small" onClick={addAbsentee}>
        + Add absent student
      </button>
      {tooManyNames && (
        <p className="error">
          You listed {namedCount} names, but the absent count is {absent}.
        </p>
      )}

      {existing && (
        <p className="note">
          Last updated by {existing.updatedBy} on {formatDateTime(existing.updatedAt)}.
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
