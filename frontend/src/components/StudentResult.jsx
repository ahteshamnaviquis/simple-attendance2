// One student's subject-wise result for an examination. Also the printed result card.
// `data` is the class result sheet from the backend, so the numbers always match it.

import Icon from './Icon.jsx';
import StatusBadge from './ExamStatusBadge.jsx';
import { formatLongDate, formatPercent } from '../utils';

// One subject cell: the mark (red when below pass marks), "A" for absent, or a
// dash for not entered.
export function MarkCell({ mark }) {
  if (!mark) {
    return (
      <span className="mark-missing" title="Not entered yet">
        —
      </span>
    );
  }
  if (mark.absent) {
    return (
      <span className="mark-absent" title="Absent (counted as 0)">
        A
      </span>
    );
  }
  if (mark.passed === false) {
    return (
      <span className="mark-fail" title="Below pass marks">
        {mark.obtained}
      </span>
    );
  }
  return mark.obtained;
}

// Pass / Fail for a complete result.
export function PassFailBadge({ result }) {
  if (result === 'pass') return <span className="badge good">Pass</span>;
  if (result === 'fail') return <span className="badge fail">Fail</span>;
  return null;
}

export default function StudentResult({ data, studentId, onSelectStudent, onBack }) {
  const { exam, subjects, rows, stats } = data;
  const row = rows.find((r) => r.studentId === studentId);
  if (!row) return <p className="error">This student is not part of the examination.</p>;

  const missing = subjects.filter((s) => !row.marks[s.subjectId]);
  const notSubmitted = subjects.filter((s) => !s.submittedAt);
  const sorted = [...rows].sort((a, b) =>
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
  );

  return (
    <>
      <div className="page-title no-print">
        <div>
          <h1>Student result</h1>
          <p className="subtitle">
            {exam.name} · {exam.className}
          </p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => window.print()}>
            <span className="rate-cell">
              <Icon name="print" />
              Print
            </span>
          </button>
          <button className="secondary" onClick={onBack}>
            Back to result sheet
          </button>
        </div>
      </div>

      <div className="filters no-print">
        <label>
          Student
          <select value={studentId} onChange={(e) => onSelectStudent(e.target.value)}>
            {sorted.map((r) => (
              <option key={r.studentId} value={r.studentId}>
                {r.rollNumber ? `${r.rollNumber}. ` : ''}
                {r.studentName}
                {r.leftClass ? ' (left class)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="card result-card">
        <div className="report-head">
          <div>
            <p className="eyebrow">Student examination result</p>
            <h2>{row.studentName}</h2>
          </div>
          <StatusBadge status={exam.status} />
        </div>

        <dl className="result-facts">
          <div>
            <dt>Roll number</dt>
            <dd>{row.rollNumber || '—'}</dd>
          </div>
          <div>
            <dt>Class</dt>
            <dd>
              {exam.className}
              {row.leftClass && <span className="note"> (has since left)</span>}
            </dd>
          </div>
          <div>
            <dt>Examination</dt>
            <dd>{exam.name}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{formatLongDate(exam.date)}</dd>
          </div>
          <div>
            <dt>Position</dt>
            <dd>{row.rank ? `${row.rank} of ${stats.completeCount}` : '—'}</dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd>{row.result ? <PassFailBadge result={row.result} /> : 'Incomplete'}</dd>
          </div>
        </dl>
        {row.result === 'fail' && (
          <p className="error">
            Failed in{' '}
            {subjects
              .filter((s) => row.failedSubjects.includes(s.subjectId))
              .map((s) => s.subjectName)
              .join(', ')}
            . A student must reach the pass marks in every subject.
          </p>
        )}

        {!row.complete && (
          <p className="info">
            Result incomplete:{' '}
            {missing.length > 0
              ? `marks not entered yet for ${missing.map((s) => s.subjectName).join(', ')}.`
              : `marks not submitted yet for ${notSubmitted.map((s) => s.subjectName).join(', ')}.`}{' '}
            The total and percentage appear once every subject's marks are entered and submitted.
          </p>
        )}

        <div className="table-box">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Assigned teacher</th>
                <th className="num">Maximum marks</th>
                <th className="num">Pass marks</th>
                <th className="num">Obtained marks</th>
                <th className="num">Percentage</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const mark = row.marks[s.subjectId];
                return (
                  <tr key={s.subjectId}>
                    <td className="cell-main">{s.subjectName}</td>
                    <td>{s.teacherName || '—'}</td>
                    <td className="num">{s.maxMarks}</td>
                    <td className="num">{s.passMarks}</td>
                    <td className="num">
                      <MarkCell mark={mark} />
                      {!mark && <span className="cell-sub"> Not entered</span>}
                    </td>
                    <td className="num">{formatPercent(mark ? mark.percentage : null)}</td>
                    <td>
                      {mark && typeof mark.passed === 'boolean' ? (
                        <PassFailBadge result={mark.passed ? 'pass' : 'fail'} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{mark?.absent ? 'Absent' : mark?.remarks || ''}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th></th>
                <th className="num">{row.totalMax}</th>
                <th></th>
                <th className="num">{row.complete ? row.totalObtained : '—'}</th>
                <th className="num">{row.complete ? formatPercent(row.percentage) : 'Incomplete'}</th>
                <th>{row.result ? <PassFailBadge result={row.result} /> : ''}</th>
                <th></th>
              </tr>
            </tfoot>
          </table>
        </div>

        {!row.complete && row.enteredCount > 0 && (
          <p className="note">
            Entered so far: {row.enteredObtained} out of {row.enteredMax} in {row.enteredCount} of{' '}
            {subjects.length} subjects ({formatPercent(Math.round((row.enteredObtained / row.enteredMax) * 10000) / 100)}).
          </p>
        )}
      </section>
    </>
  );
}
