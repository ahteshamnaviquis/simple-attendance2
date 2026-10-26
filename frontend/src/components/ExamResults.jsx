// Super admin: class result sheet for one examination. Every student's subject marks,
// total, percentage and position, with search, sorting and a summary. Totals and
// ranks come from the backend (results.js). Missing marks are never counted as 0,
// and results stay Incomplete until every subject's marks are submitted;
// incomplete results are not ranked.

import { useEffect, useState } from 'react';
import { getExamResults } from '../api';
import Icon from './Icon.jsx';
import StatusBadge from './ExamStatusBadge.jsx';
import StudentResult, { MarkCell, PassFailBadge } from './StudentResult.jsx';
import { formatLongDate, formatPercent } from '../utils';

const SORTS = {
  roll: 'Roll number',
  name: 'Student name',
  total: 'Total marks (high to low)',
  percentage: 'Percentage (high to low)',
};

function byRoll(a, b) {
  return (
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }) ||
    a.studentName.localeCompare(b.studentName)
  );
}

// Complete results first (highest first), then incomplete ones by roll number.
function byTotal(a, b) {
  if (a.complete !== b.complete) return a.complete ? -1 : 1;
  if (!a.complete) return byRoll(a, b);
  return b.totalObtained - a.totalObtained || byRoll(a, b);
}

const COMPARE = {
  roll: byRoll,
  name: (a, b) => a.studentName.localeCompare(b.studentName) || byRoll(a, b),
  total: byTotal,
  percentage: (a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1;
    if (!a.complete) return byRoll(a, b);
    return b.percentage - a.percentage || byRoll(a, b);
  },
};

function ResultBadge({ row }) {
  if (row.complete) return <PassFailBadge result={row.result} />;
  if (row.allEntered) {
    return (
      <span className="badge late" title="All marks entered, waiting for a teacher to submit">
        Awaiting submission
      </span>
    );
  }
  return (
    <span className="badge warning" title={`${row.missingCount} subject marks not entered`}>
      Incomplete · {row.missingCount} missing
    </span>
  );
}

export default function ExamResults({ examId, onBack }) {
  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('roll');
  const [show, setShow] = useState('all'); // 'all' | 'complete' | 'incomplete'
  const [studentId, setStudentId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getExamResults(examId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [examId]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="note">Loading…</p>;

  const { exam, subjects, rows, stats } = data;

  if (studentId) {
    return (
      <StudentResult
        data={data}
        studentId={studentId}
        onSelectStudent={setStudentId}
        onBack={() => setStudentId('')}
      />
    );
  }

  const searchText = search.trim().toLowerCase();
  const matches = (r) =>
    (!searchText ||
      r.studentName.toLowerCase().includes(searchText) ||
      r.rollNumber.toLowerCase().includes(searchText)) &&
    (show === 'all' || (show === 'complete') === r.complete);
  const inClass = rows.filter((r) => !r.leftClass && matches(r)).sort(COMPARE[sort]);
  const leftClass = rows.filter((r) => r.leftClass && matches(r)).sort(COMPARE[sort]);
  const columnCount = subjects.length + 7;

  function renderRow(r) {
    return (
      <tr key={r.studentId}>
        <td className="num">{r.rank ?? '—'}</td>
        <td>{r.rollNumber || '—'}</td>
        <td>
          <button type="button" className="link-button" onClick={() => setStudentId(r.studentId)}>
            {r.studentName}
          </button>
        </td>
        {subjects.map((s) => (
          <td key={s.subjectId} className="num">
            <MarkCell mark={r.marks[s.subjectId]} />
          </td>
        ))}
        <td className="num">
          {r.complete ? (
            <strong>{r.totalObtained}</strong>
          ) : (
            <>
              —<div className="cell-sub nowrap">{r.enteredObtained}/{r.enteredMax} so far</div>
            </>
          )}
        </td>
        <td className="num">{r.totalMax}</td>
        <td className="num">
          <strong>{formatPercent(r.percentage)}</strong>
        </td>
        <td className="no-print">
          <ResultBadge row={r} />
        </td>
      </tr>
    );
  }

  return (
    <>
      <div className="page-title">
        <div>
          <p className="eyebrow">Result sheet</p>
          <h1>{exam.name}</h1>
          <p className="subtitle">
            {exam.className} · {formatLongDate(exam.date)} <StatusBadge status={exam.status} />
          </p>
        </div>
        <div className="actions no-print">
          <button className="secondary" onClick={() => window.print()}>
            <span className="rate-cell">
              <Icon name="print" />
              Print
            </span>
          </button>
          <button className="secondary" onClick={onBack}>
            Back to examinations
          </button>
        </div>
      </div>

      {!stats.allSubmitted && (
        <p className="info no-print">
          Not submitted yet:{' '}
          {subjects
            .filter((s) => !s.submittedAt)
            .map((s) => `${s.subjectName} (${s.teacherName || 'no teacher'})`)
            .join(', ')}
          . Results stay Incomplete until every subject is submitted.
        </p>
      )}
      {stats.allSubmitted && exam.status === 'open' && (
        <p className="info no-print">All marks are submitted. The results are not published yet.</p>
      )}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Students</div>
          <div className="kpi-value">{stats.studentCount}</div>
          <div className="kpi-caption">In {exam.className}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Completed results</div>
          <div className="kpi-value">{stats.completeCount}</div>
          <div className="kpi-caption">
            {stats.incompleteCount > 0 ? `${stats.incompleteCount} incomplete` : 'All marks entered'}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Class average</div>
          <div className="kpi-value">{formatPercent(stats.average)}</div>
          <div className="kpi-caption">Of completed results, out of {stats.totalMax}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Highest</div>
          <div className="kpi-value">{formatPercent(stats.highest)}</div>
          <div className="kpi-caption">Best completed result</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Lowest</div>
          <div className="kpi-value">{formatPercent(stats.lowest)}</div>
          <div className="kpi-caption">Lowest completed result</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Passed</div>
          <div className="kpi-value">{stats.passCount}</div>
          <div className="kpi-caption">
            {stats.failCount} failed · pass marks needed in every subject
          </div>
        </div>
      </div>

      <div className="filters no-print">
        <label>
          Search
          <input
            placeholder="Name or roll number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {Object.entries(SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Show
          <select value={show} onChange={(e) => setShow(e.target.value)}>
            <option value="all">All students</option>
            <option value="complete">Complete results only</option>
            <option value="incomplete">Incomplete results only</option>
          </select>
        </label>
        <label>
          Student result
          <select value="" onChange={(e) => setStudentId(e.target.value)}>
            <option value="">— Open one student —</option>
            {[...rows].sort(byRoll).map((r) => (
              <option key={r.studentId} value={r.studentId}>
                {r.rollNumber ? `${r.rollNumber}. ` : ''}
                {r.studentName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="table-box">
        <table className="result-sheet">
          <thead>
            <tr>
              <th className="num" title="Position among completed results">Pos.</th>
              <th>Roll no.</th>
              <th>Student</th>
              {subjects.map((s) => (
                <th key={s.subjectId} className="num">
                  {s.subjectName}
                  <div className="th-sub">
                    /{s.maxMarks} · pass {s.passMarks}
                  </div>
                </th>
              ))}
              <th className="num">Obtained</th>
              <th className="num">Total</th>
              <th className="num">%</th>
              <th className="no-print">Result</th>
            </tr>
          </thead>
          <tbody>
            {inClass.map(renderRow)}
            {inClass.length === 0 && (
              <tr>
                <td colSpan={columnCount}>No students match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="note">
        — means marks not entered yet. A means absent (counted as 0). A result is Incomplete until every
        subject's marks are entered and submitted; incomplete results have no total or position.
      </p>

      {leftClass.length > 0 && (
        <div>
          <h3>Students who have left the class</h3>
          <p className="note">
            Their marks for this examination are kept. They are not ranked or counted in the class average.
          </p>
          <div className="table-box">
            <table className="result-sheet">
              <tbody>{leftClass.map(renderRow)}</tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
