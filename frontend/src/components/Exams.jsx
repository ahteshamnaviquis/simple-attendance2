// Admin: examinations. The list with filters and marks-entry progress, and the
// screens for one exam (details panel, create/edit form, marks entry, result
// sheet, one student's result). Teachers use TeacherExams instead.

import { useEffect, useState } from 'react';
import { getClasses, getExams, getSubjects } from '../api';
import ExamDetails from './ExamDetails.jsx';
import ExamForm from './ExamForm.jsx';
import MarksEntry from './MarksEntry.jsx';
import ExamResults from './ExamResults.jsx';
import StatusBadge from './ExamStatusBadge.jsx';
import { formatMediumDate } from '../utils';

const EMPTY_FILTERS = { classId: '', name: '', subjectId: '', from: '', to: '', status: '' };

export default function Exams() {
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [exams, setExams] = useState(null); // null = still loading
  const [mode, setMode] = useState('list'); // 'list' | 'form' | 'marks' | 'results'
  const [selectedId, setSelectedId] = useState(null); // exam open in the details panel
  const [marksSubjectId, setMarksSubjectId] = useState(''); // subject opened in marks entry
  const [editing, setEditing] = useState(null); // exam in the form, null = new exam
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([getClasses(), getSubjects()])
      .then(([classList, subjectList]) => {
        setClasses(classList);
        setSubjects(subjectList);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    getExams(filters)
      .then(setExams)
      .catch((err) => setError(err.message));
  }, [filters, refreshKey]);

  function reload() {
    setRefreshKey((k) => k + 1);
  }

  function handleFilterChange(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  function open(examId, newMode) {
    setSelectedId(examId);
    setMode(newMode);
    setMessage('');
    setError('');
  }

  function backToList(text = '') {
    setMode('list');
    setMessage(text);
    reload();
  }

  if (mode === 'form') {
    return (
      <ExamForm
        exam={editing}
        classes={classes}
        onSaved={(saved, isNew) => {
          // Creating returns one exam per class.
          const list = isNew ? saved : [saved];
          setSelectedId(list.length === 1 ? list[0].id : null);
          backToList(
            !isNew
              ? `Saved changes to ${saved.name}.`
              : list.length === 1
                ? `Created ${list[0].name} for ${list[0].className}. The subject teachers can now enter marks.`
                : `Created ${list[0].name} for ${list.length} classes. The subject teachers can now enter marks.`
          );
        }}
        onCancel={() => backToList()}
      />
    );
  }
  if (mode === 'marks' && selectedId) {
    return (
      <MarksEntry
        examId={selectedId}
        initialSubjectId={marksSubjectId}
        onBack={() => backToList()}
        onShowResults={() => setMode('results')}
      />
    );
  }
  if (mode === 'results' && selectedId) {
    return <ExamResults examId={selectedId} onBack={() => backToList()} />;
  }

  const list = exams || [];
  const published = list.filter((e) => e.status === 'published');
  const waiting = list.filter((e) => e.status === 'open' && e.pendingCount > 0);
  const pendingSubjects = waiting.reduce((sum, e) => sum + e.pendingCount, 0);
  const ready = list.filter((e) => e.readyToPublish);
  const completedResults = published.reduce((sum, e) => sum + e.stats.completeCount, 0);
  const showPanel = Boolean(selectedId) && list.some((e) => e.id === selectedId);

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Examinations</h1>
          <p className="subtitle">Every examination in the academy, newest first</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setMode('form');
            setMessage('');
          }}
        >
          + Create examination
        </button>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Examinations</div>
          <div className="kpi-value">{list.length}</div>
          <div className="kpi-caption">Matching the filters</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Waiting for marks</div>
          <div className="kpi-value">{waiting.length}</div>
          <div className="kpi-caption">
            {pendingSubjects} {pendingSubjects === 1 ? 'subject' : 'subjects'} not submitted yet
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Ready to publish</div>
          <div className="kpi-value">{ready.length}</div>
          <div className="kpi-caption">All subject marks submitted</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Published</div>
          <div className="kpi-value">{published.length}</div>
          <div className="kpi-caption">{completedResults} completed student results</div>
        </div>
      </div>

      <div className="filters">
        <label>
          Class
          <select name="classId" value={filters.classId} onChange={handleFilterChange}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Exam name
          <input
            name="name"
            placeholder="e.g. Monthly Test"
            value={filters.name}
            onChange={handleFilterChange}
          />
        </label>
        <label>
          Subject
          <select name="subjectId" value={filters.subjectId} onChange={handleFilterChange}>
            <option value="">All subjects</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          From
          <input type="date" name="from" value={filters.from} onChange={handleFilterChange} />
        </label>
        <label>
          To
          <input type="date" name="to" value={filters.to} onChange={handleFilterChange} />
        </label>
        <label>
          Status
          <select name="status" value={filters.status} onChange={handleFilterChange}>
            <option value="">Any status</option>
            <option value="open">Open (marks entry)</option>
            <option value="published">Published</option>
          </select>
        </label>
        <button className="secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
          Clear filters
        </button>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="reports-layout">
        <div className="reports-list table-box">
          <table>
            <thead>
              <tr>
                <th>Examination</th>
                <th>Class</th>
                <th>Date</th>
                <th className="num">Subjects</th>
                <th className="num">Students</th>
                <th className="num" title="Subjects whose marks the teacher has submitted">
                  Submitted
                </th>
                <th className="num">Pending</th>
                <th>Status</th>
                <th>Created by</th>
                <th className="num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className={showPanel && selectedId === e.id ? 'selected-row' : ''}>
                  <td>
                    <div className="cell-main">{e.name}</div>
                    {e.remarks && <div className="cell-sub">{e.remarks}</div>}
                  </td>
                  <td>{e.className}</td>
                  <td className="nowrap">{formatMediumDate(e.date)}</td>
                  <td className="num">{e.subjectCount}</td>
                  <td className="num">{e.stats.studentCount}</td>
                  <td className="num">{e.submittedCount}</td>
                  <td className="num">
                    {e.pendingCount > 0 ? <strong>{e.pendingCount}</strong> : '0'}
                  </td>
                  <td className="nowrap">
                    <StatusBadge status={e.status} />
                    {e.readyToPublish && <div className="cell-sub">Ready to publish</div>}
                  </td>
                  <td>{e.createdBy}</td>
                  <td className="nowrap num">
                    <button className="secondary small" onClick={() => open(e.id, 'list')}>
                      View details
                    </button>{' '}
                    <button className="secondary small" onClick={() => open(e.id, 'results')}>
                      Results
                    </button>
                  </td>
                </tr>
              ))}
              {exams && list.length === 0 && (
                <tr>
                  <td colSpan="10">No examinations found. Use “Create examination” to add one.</td>
                </tr>
              )}
              {!exams && (
                <tr>
                  <td colSpan="10">Loading…</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showPanel && (
          <ExamDetails
            key={`${selectedId}-${refreshKey}`}
            examId={selectedId}
            onEdit={(exam) => {
              setEditing(exam);
              setMode('form');
              setMessage('');
            }}
            onMarks={(subjectId) => {
              setMarksSubjectId(subjectId);
              setMode('marks');
            }}
            onResults={() => setMode('results')}
            onChanged={(text) => {
              setMessage(text);
              reload();
            }}
            onDeleted={(text) => {
              setSelectedId(null);
              backToList(text);
            }}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </>
  );
}
