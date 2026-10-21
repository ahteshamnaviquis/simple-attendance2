// Enter one subject's marks for every student in the exam's class.
// Teachers only get the subjects they teach (the backend checks this on every
// request); the admin gets every subject.
//
// - "Save draft" stores the marks; they can be changed until submitted.
// - "Submit marks" saves, then submits. It needs a mark or Absent for every
//   student. Submitted marks are locked until the admin reopens them.
// - The grid is cleared and loaded again whenever the subject changes, and Save
//   sends the exam and subject the grid was loaded for, so marks can't be saved
//   against the wrong records.
// - Switching subject (or leaving the page) with unsaved changes asks first.
// - Empty marks mean "not entered yet", which is different from 0.

import { useEffect, useState } from 'react';
import { getExam, getExamMarks, saveExamMarks, submitExamSubject } from '../api';
import StatusBadge, { EntryStatusBadge } from './ExamStatusBadge.jsx';
import { formatDateTime, formatLongDate, formatPercent } from '../utils';

function toValues(rows) {
  const values = {};
  for (const row of rows) {
    values[row.studentId] = {
      obtained: row.obtained === null ? '' : String(row.obtained),
      absent: row.absent,
      remarks: row.remarks || '',
    };
  }
  return values;
}

// Returns an error message for one row, or ''.
function rowProblem(value, maxMarks) {
  const text = value.obtained.trim();
  if (text === '') return '';
  const n = Number(text);
  if (!Number.isFinite(n)) return 'Not a number';
  if (n < 0) return 'Cannot be negative';
  if (n > maxMarks) return `More than ${maxMarks}`;
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) return 'At most 2 decimals';
  if (value.absent) return 'Absent: leave marks empty';
  return '';
}

function sameValues(a, b) {
  return a.obtained.trim() === b.obtained.trim() && a.absent === b.absent && a.remarks.trim() === b.remarks.trim();
}

export default function MarksEntry({ examId, initialSubjectId, onBack, onShowResults }) {
  const [exam, setExam] = useState(null);
  const [subjectId, setSubjectId] = useState('');
  const [grid, setGrid] = useState(null); // what the server has for this subject
  const [values, setValues] = useState({}); // what is typed: studentId -> { obtained, absent, remarks }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function loadExam() {
    return getExam(examId).then((data) => {
      setExam(data);
      return data;
    });
  }

  // Start with the requested subject, else the first one not yet submitted.
  useEffect(() => {
    loadExam()
      .then((data) => {
        const wanted = data.subjects.find((s) => s.subjectId === initialSubjectId);
        const todo = data.subjects.find((s) => s.status !== 'submitted');
        setSubjectId((wanted || todo || data.subjects[0])?.subjectId || '');
      })
      .catch((err) => setError(err.message));
  }, [examId]);

  function loadGrid(id) {
    return getExamMarks(examId, id).then((data) => {
      setGrid(data);
      setValues(toValues(data.rows));
      return data;
    });
  }

  useEffect(() => {
    if (!subjectId) return;
    let current = true; // ignore a slow answer for a subject that is no longer selected
    setGrid(null);
    setValues({});
    getExamMarks(examId, subjectId)
      .then((data) => {
        if (!current) return;
        setGrid(data);
        setValues(toValues(data.rows));
      })
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [examId, subjectId]);

  const editableRows = grid ? grid.rows.filter((r) => !r.leftClass) : [];
  const leftRows = grid ? grid.rows.filter((r) => r.leftClass) : [];
  const saved = grid ? toValues(grid.rows) : {};
  const dirty = editableRows.some((r) => values[r.studentId] && !sameValues(values[r.studentId], saved[r.studentId]));
  const problems = grid
    ? Object.fromEntries(
        editableRows.map((r) => [
          r.studentId,
          values[r.studentId] ? rowProblem(values[r.studentId], grid.subject.maxMarks) : '',
        ])
      )
    : {};
  const problemCount = Object.values(problems).filter(Boolean).length;
  const isSubmitted = grid?.subject.status === 'submitted';
  const isPublished = grid?.examStatus === 'published';
  const readOnly = !grid || isSubmitted || isPublished;
  const enteredCount = editableRows.filter((r) => {
    const v = values[r.studentId];
    return v && (v.absent || v.obtained.trim() !== '');
  }).length;
  const allEntered = editableRows.length > 0 && enteredCount === editableRows.length;

  // Warn before closing the tab with unsaved marks.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function confirmLeave() {
    return !dirty || window.confirm('You have unsaved marks. Leave without saving them?');
  }

  function changeSubject(event) {
    if (!confirmLeave()) return;
    setMessage('');
    setError('');
    setSubjectId(event.target.value);
  }

  function changeValue(studentId, field, value) {
    setMessage('');
    setValues((old) => {
      const row = { ...old[studentId], [field]: value };
      if (field === 'absent' && value) row.obtained = ''; // absent students have no marks
      return { ...old, [studentId]: row };
    });
  }

  // Enter moves to the next student's marks box, for fast typing.
  function handleKeyDown(event, index) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    document.querySelector(`[data-mark-row="${index + 1}"]`)?.focus();
  }

  // Save the grid (if changed). Uses the exam and subject this grid was loaded
  // for, never the current dropdown. Returns the number of students saved.
  async function save() {
    if (!dirty) return 0;
    const rows = editableRows.map((r) => {
      const v = values[r.studentId];
      return { studentId: r.studentId, obtained: v.obtained.trim(), absent: v.absent, remarks: v.remarks };
    });
    const result = await saveExamMarks(grid.examId, grid.subject.subjectId, rows);
    setGrid(result);
    setValues(toValues(result.rows));
    return result.savedCount;
  }

  async function handleSaveDraft() {
    if (problemCount > 0) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const count = await save();
      setMessage(
        count === 0
          ? 'Nothing changed.'
          : `Saved ${grid.subject.subjectName} marks for ${count} ${count === 1 ? 'student' : 'students'} as a draft.`
      );
      loadExam().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit() {
    if (problemCount > 0 || !allEntered) return;
    const ok = window.confirm(
      `Submit ${grid.subject.subjectName} marks for ${exam.className}?\n\nAfter submitting you can't change them unless the admin reopens them.`
    );
    if (!ok) return;
    setBusy(true);
    setError('');
    setMessage('');
    const { examId: gridExamId, subject } = grid;
    try {
      await save();
      await submitExamSubject(gridExamId, subject.subjectId);
      await loadGrid(subject.subjectId);
      setMessage(`Submitted ${subject.subjectName} marks.`);
      loadExam().catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const current = exam?.subjects.find((s) => s.subjectId === subjectId);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Enter marks</h1>
          {exam && (
            <p className="subtitle">
              {exam.name} · {exam.className} · {formatLongDate(exam.date)} <StatusBadge status={exam.status} />
            </p>
          )}
        </div>
        <div className="actions">
          {onShowResults && (
            <button className="secondary" onClick={() => confirmLeave() && onShowResults()}>
              View results
            </button>
          )}
          <button className="secondary" onClick={() => confirmLeave() && onBack()}>
            Back
          </button>
        </div>
      </div>

      {exam && (
        <div className="filters">
          <label>
            Subject
            <select value={subjectId} onChange={changeSubject} disabled={exam.subjects.length < 2}>
              {exam.subjects.map((s) => (
                <option key={s.subjectId} value={s.subjectId}>
                  {s.subjectName} (out of {s.maxMarks}, pass {s.passMarks})
                </option>
              ))}
            </select>
          </label>
          {grid && current && (
            <div className="marks-progress">
              <div>
                Teacher: <strong>{current.teacherName || 'Not assigned'}</strong> · Maximum marks{' '}
                <strong>{grid.subject.maxMarks}</strong> · Pass marks <strong>{grid.subject.passMarks}</strong>
              </div>
              <div className="note">
                <EntryStatusBadge status={grid.subject.status} /> {enteredCount} of {editableRows.length} students
                entered
                {grid.subject.submittedAt &&
                  ` · submitted by ${grid.subject.submittedBy} on ${formatDateTime(grid.subject.submittedAt)}`}
              </div>
            </div>
          )}
        </div>
      )}

      {grid && isPublished && <p className="info">The results of this examination are published, so marks are locked.</p>}
      {grid && !isPublished && isSubmitted && (
        <p className="info">These marks are submitted, so they are locked. The admin can reopen them for corrections.</p>
      )}

      {error && <p className="error">{error}</p>}
      {!grid && !error && <p className="note">Loading…</p>}

      {grid && editableRows.length === 0 && (
        <p className="card">There are no students in this class yet.</p>
      )}

      {grid && editableRows.length > 0 && (
        <div className="table-box">
          <table className="marks-grid">
            <thead>
              <tr>
                <th>Roll no.</th>
                <th>Student</th>
                <th className="num">Obtained</th>
                <th className="center">Absent</th>
                <th className="num">%</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {editableRows.map((r, index) => {
                const v = values[r.studentId] || { obtained: '', absent: false, remarks: '' };
                const problem = problems[r.studentId];
                const n = Number(v.obtained);
                const pct = v.absent
                  ? 0
                  : v.obtained.trim() !== '' && !problem
                    ? Math.round((n / grid.subject.maxMarks) * 10000) / 100
                    : null;
                // Below pass marks (absent counts as a fail too).
                const failing = v.absent || (pct !== null && n < grid.subject.passMarks);
                return (
                  <tr key={r.studentId}>
                    <td>{r.rollNumber || '—'}</td>
                    <td className="cell-main">{r.studentName}</td>
                    <td className="num">
                      <input
                        className={problem ? 'mark-input invalid' : 'mark-input'}
                        aria-label={`Marks for ${r.studentName}`}
                        aria-invalid={problem ? 'true' : undefined}
                        type="text"
                        inputMode="decimal"
                        placeholder={v.absent ? 'Absent' : 'Not entered'}
                        value={v.obtained}
                        disabled={readOnly || v.absent}
                        data-mark-row={index}
                        onChange={(e) => changeValue(r.studentId, 'obtained', e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                      />
                      {problem && <div className="mark-problem">{problem}</div>}
                    </td>
                    <td className="center">
                      <input
                        type="checkbox"
                        aria-label={`${r.studentName} was absent`}
                        checked={v.absent}
                        disabled={readOnly}
                        onChange={(e) => changeValue(r.studentId, 'absent', e.target.checked)}
                      />
                    </td>
                    <td className={failing ? 'num mark-fail' : 'num'}>
                      {formatPercent(pct)}
                      {failing && <div className="cell-sub">Below pass</div>}
                    </td>
                    <td>
                      <input
                        aria-label={`Remarks for ${r.studentName}`}
                        value={v.remarks}
                        maxLength={100}
                        placeholder={readOnly ? '' : 'Optional'}
                        disabled={readOnly}
                        onChange={(e) => changeValue(r.studentId, 'remarks', e.target.value)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {leftRows.length > 0 && (
        <div>
          <h3>Students who have left this class</h3>
          <p className="note">Their marks are kept for this examination but can't be changed here.</p>
          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>Roll no.</th>
                  <th>Student</th>
                  <th className="num">Obtained</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {leftRows.map((r) => (
                  <tr key={r.studentId}>
                    <td>{r.rollNumber || '—'}</td>
                    <td>{r.studentName}</td>
                    <td className="num">{r.absent ? 'Absent' : r.obtained}</td>
                    <td>{r.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {grid && editableRows.length > 0 && !readOnly && (
        <div className="actions marks-actions">
          <button className="secondary" onClick={handleSaveDraft} disabled={busy || problemCount > 0 || !dirty}>
            {busy ? 'Saving…' : 'Save draft'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || problemCount > 0 || !allEntered}
            title={allEntered ? undefined : 'Enter a mark or tick Absent for every student first'}
          >
            Submit marks
          </button>
          {problemCount > 0 && (
            <span className="error">
              Fix {problemCount} {problemCount === 1 ? 'row' : 'rows'} before saving.
            </span>
          )}
          {problemCount === 0 && !allEntered && !message && (
            <span className="note">
              {editableRows.length - enteredCount} still to enter before you can submit.
            </span>
          )}
          {message && <span className="success">{message}</span>}
        </div>
      )}
      {grid && readOnly && message && <p className="success">{message}</p>}
    </>
  );
}
