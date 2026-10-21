// Teacher: the exam subjects they teach (one row per exam + subject), with the
// marks-entry status, and the marks-entry screen for one of them. Teachers don't
// create or publish examinations; the admin does.

import { useEffect, useState } from 'react';
import { getMyExamSubjects } from '../api';
import MarksEntry from './MarksEntry.jsx';
import StatusBadge, { EntryStatusBadge } from './ExamStatusBadge.jsx';
import { formatMediumDate } from '../utils';

export default function TeacherExams() {
  const [rows, setRows] = useState(null); // null = still loading
  const [open, setOpen] = useState(null); // { examId, subjectId } in marks entry
  const [show, setShow] = useState('todo'); // 'todo' | 'all'
  const [error, setError] = useState('');

  function load() {
    getMyExamSubjects()
      .then(setRows)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  if (open) {
    return (
      <MarksEntry
        examId={open.examId}
        initialSubjectId={open.subjectId}
        onBack={() => {
          setOpen(null);
          load();
        }}
      />
    );
  }

  const list = rows || [];
  const todo = list.filter((r) => r.examStatus === 'open' && r.status !== 'submitted');
  const visible = show === 'todo' ? todo : list;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Examinations</h1>
          <p className="subtitle">Enter and submit marks for the subjects you teach</p>
        </div>
        <div className="toggle" role="group" aria-label="Show">
          <button
            type="button"
            className={show === 'todo' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setShow('todo')}
          >
            To do ({todo.length})
          </button>
          <button
            type="button"
            className={show === 'all' ? 'toggle-btn active' : 'toggle-btn'}
            onClick={() => setShow('all')}
          >
            All ({list.length})
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Examination</th>
              <th>Class</th>
              <th>Date</th>
              <th>Subject</th>
              <th className="num">Max marks</th>
              <th className="num">Pass marks</th>
              <th className="num">Entered</th>
              <th>Marks entry</th>
              <th className="num"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const canEdit = r.examStatus === 'open' && r.status !== 'submitted';
              return (
                <tr key={`${r.examId}-${r.subjectId}`}>
                  <td>
                    <div className="cell-main">{r.examName}</div>
                    {r.examStatus === 'published' && <StatusBadge status="published" />}
                  </td>
                  <td>{r.className}</td>
                  <td className="nowrap">{formatMediumDate(r.date)}</td>
                  <td className="cell-main">{r.subjectName}</td>
                  <td className="num">{r.maxMarks}</td>
                  <td className="num">{r.passMarks}</td>
                  <td className="num nowrap">
                    {r.enteredCount} / {r.studentCount}
                  </td>
                  <td>
                    <EntryStatusBadge status={r.status} />
                  </td>
                  <td className="num nowrap">
                    <button
                      className={canEdit ? 'small' : 'secondary small'}
                      onClick={() => setOpen({ examId: r.examId, subjectId: r.subjectId })}
                    >
                      {canEdit ? 'Enter marks' : 'View marks'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows && visible.length === 0 && (
              <tr>
                <td colSpan="9">
                  {show === 'todo' && list.length > 0
                    ? 'All your marks are submitted.'
                    : 'No examinations for your subjects yet. The admin creates examinations.'}
                </td>
              </tr>
            )}
            {!rows && (
              <tr>
                <td colSpan="9">Loading…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
