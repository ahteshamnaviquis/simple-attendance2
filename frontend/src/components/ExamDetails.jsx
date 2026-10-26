// Super admin: one examination, shown in a panel beside the examinations list.
// Marks-entry progress for every subject and its teacher, and the actions allowed
// right now: enter marks (for subjects without a teacher, or corrections),
// reopen a submitted subject, edit, publish, unpublish and delete.
// The super admin can also disable / enable the exam and remove it even when it
// has marks or is published.

import { useEffect, useState } from 'react';
import {
  deleteExam,
  getExam,
  publishExam,
  reopenExamSubject,
  setExamDisabled,
  unpublishExam,
} from '../api';
import { getSavedUser } from '../session';
import Icon from './Icon.jsx';
import StatusBadge, { EntryStatusBadge } from './ExamStatusBadge.jsx';
import { formatDateTime, formatLongDate } from '../utils';

export default function ExamDetails({ examId, onEdit, onMarks, onResults, onChanged, onDeleted, onClose }) {
  const [exam, setExam] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getExam(examId)
      .then(setExam)
      .catch((err) => setError(err.message));
  }, [examId]);

  async function run(action, confirmText, doneText, afterDelete) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError('');
    try {
      await action();
      if (afterDelete) onDeleted(doneText);
      else onChanged(doneText);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!exam) {
    return (
      <aside className="report-panel">
        {error ? <p className="error">{error}</p> : <p className="note">Loading…</p>}
      </aside>
    );
  }

  const isOpen = exam.status === 'open';
  const isSuper = getSavedUser()?.role === 'superadmin';
  const canDelete = isSuper || (isOpen && !exam.hasMarks);
  const waiting = exam.subjects.filter((s) => s.status !== 'submitted');
  const totalMax = exam.subjects.reduce((sum, s) => sum + s.maxMarks, 0);

  return (
    <aside className="report-panel" aria-labelledby="exam-title">
      <div className="report-head">
        <div>
          <p className="eyebrow">Examination</p>
          <h2 id="exam-title">{exam.name}</h2>
          <p className="subtitle">
            {exam.className} · {formatLongDate(exam.date)}
          </p>
        </div>
        <button className="icon-button" aria-label="Close details" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>

      <p>
        <StatusBadge status={exam.status} />{' '}
        {exam.disabled && <span className="badge muted">Disabled</span>}{' '}
        <span className="note">
          {exam.studentCount} students · {exam.subjects.length} subjects · out of {totalMax}
        </span>
      </p>
      {exam.remarks && <p className="note">{exam.remarks}</p>}
      {exam.disabled && (
        <p className="info">
          This examination is disabled. Teachers can't see it or enter marks until you enable it.
        </p>
      )}

      <div className="table-box">
        <table className="clean">
          <thead>
            <tr>
              <th>Subject</th>
              <th>Teacher</th>
              <th className="num">Max</th>
              <th className="num">Pass</th>
              <th className="num">Entered</th>
              <th>Status</th>
              {isOpen && <th></th>}
            </tr>
          </thead>
          <tbody>
            {exam.subjects.map((s) => (
              <tr key={s.subjectId}>
                <td className="cell-main">{s.subjectName}</td>
                <td>{s.teacherName || <span className="note">Not assigned</span>}</td>
                <td className="num">{s.maxMarks}</td>
                <td className="num">{s.passMarks}</td>
                <td className="num nowrap">
                  {s.enteredCount} / {s.studentCount}
                </td>
                <td>
                  <EntryStatusBadge status={s.status} />
                  {s.submittedBy && <div className="cell-sub nowrap">by {s.submittedBy}</div>}
                </td>
                {isOpen && (
                  <td className="num nowrap">
                    {s.status === 'submitted' ? (
                      <button
                        className="secondary small"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => reopenExamSubject(exam.id, s.subjectId),
                            `Reopen ${s.subjectName} marks?\n\n${s.teacherName || 'The teacher'} will be able to change them again and must submit them again. No marks are deleted.`,
                            `Reopened ${s.subjectName} marks.`
                          )
                        }
                      >
                        Reopen
                      </button>
                    ) : (
                      <button className="secondary small" onClick={() => onMarks(s.subjectId)}>
                        Enter marks
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isOpen && waiting.length > 0 && (
        <div className="info">
          <strong>Waiting for marks:</strong>
          <ul className="waiting-list">
            {waiting.map((s) => (
              <li key={s.subjectId}>
                {s.subjectName} — {s.teacherName || 'no teacher assigned (enter the marks yourself)'} ·{' '}
                {s.status === 'pending' ? 'not started' : `${s.enteredCount} of ${s.studentCount} entered`}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!isOpen && (
        <p className="note">
          Published by {exam.publishedBy} on {formatDateTime(exam.publishedAt)}. Unpublish it to correct marks.
        </p>
      )}

      <p className="cell-sub">
        Created by {exam.createdBy} on {formatDateTime(exam.createdAt)}. Last updated by {exam.updatedBy} on{' '}
        {formatDateTime(exam.updatedAt)}.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button onClick={onResults}>View results</button>
        {isOpen && (
          <button
            className="secondary"
            disabled={busy || waiting.length > 0}
            title={waiting.length > 0 ? 'Every subject must be submitted first' : undefined}
            onClick={() =>
              run(
                () => publishExam(exam.id),
                `Publish the results of ${exam.name}?\n\nMarks can't be changed after publishing unless you unpublish it.`,
                `Published ${exam.name}.`
              )
            }
          >
            Publish results
          </button>
        )}
        {isOpen && (
          <button className="secondary" onClick={() => onEdit(exam)}>
            Edit exam
          </button>
        )}
        {!isOpen && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => unpublishExam(exam.id),
                `Unpublish ${exam.name}?\n\nIt goes back to Open, and you can then reopen subjects for corrections. No marks are deleted.`,
                `${exam.name} is open again.`
              )
            }
          >
            Unpublish
          </button>
        )}
        {isSuper && (
          <button
            className="secondary"
            disabled={busy}
            onClick={() =>
              run(
                () => setExamDisabled(exam.id, !exam.disabled),
                exam.disabled
                  ? null
                  : `Disable ${exam.name}?

Teachers won't see it or be able to enter marks until you enable it again. No marks are deleted.`,
                exam.disabled ? `${exam.name} is enabled again.` : `${exam.name} is disabled.`
              )
            }
          >
            {exam.disabled ? 'Enable' : 'Disable'}
          </button>
        )}
        {canDelete && (
          <button
            className="danger"
            disabled={busy}
            onClick={() =>
              run(
                () => deleteExam(exam.id),
                exam.hasMarks
                  ? `Remove ${exam.name}?

All of its marks will be deleted too. This can't be undone.`
                  : `Delete ${exam.name}? It has no marks yet.`,
                `Removed ${exam.name}.`,
                true
              )
            }
          >
            {exam.hasMarks ? 'Remove exam' : 'Delete'}
          </button>
        )}
      </div>
      {isOpen && waiting.length > 0 && (
        <p className="cell-sub">Results can be published once every subject's marks are submitted.</p>
      )}
    </aside>
  );
}
