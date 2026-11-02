// One child's published examination results: the list of exams, and a
// printable result card with subject-wise marks for the one chosen.

import { useEffect, useState } from 'react';
import { getChildExamResult, getChildExams } from '../../api';
import Icon from '../../components/Icon.jsx';
import { MarkCell, PassFailBadge } from '../../components/StudentResult.jsx';
import { formatLongDate, formatMediumDate, formatPercent } from '../../utils';

export default function ChildResults({ child, switcher }) {
  const [exams, setExams] = useState(null);
  const [examId, setExamId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getChildExams(child.studentId)
      .then(setExams)
      .catch((err) => setError(err.message));
  }, [child.studentId]);

  if (examId) {
    return <ResultCard child={child} examId={examId} onBack={() => setExamId(null)} />;
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Results</h1>
          <p className="subtitle">
            {child.name} · {child.className}
          </p>
        </div>
      </div>

      {switcher}
      {error && <p className="error">{error}</p>}

      {exams && (
        <div className="table-box">
          <table>
            <thead>
              <tr>
                <th>Examination</th>
                <th>Date</th>
                <th className="num">Marks</th>
                <th className="num">Percentage</th>
                <th className="num">Position</th>
                <th>Result</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.examId}>
                  <td>
                    <div className="cell-main">{e.name}</div>
                    <div className="cell-sub">{e.className}</div>
                  </td>
                  <td>{formatMediumDate(e.date)}</td>
                  <td className="num">{e.complete ? `${e.totalObtained} / ${e.totalMax}` : '—'}</td>
                  <td className="num">{formatPercent(e.percentage)}</td>
                  <td className="num">{e.rank ? `${e.rank} of ${e.rankedCount}` : '—'}</td>
                  <td>{e.complete ? <PassFailBadge result={e.result} /> : <span className="badge muted">Incomplete</span>}</td>
                  <td className="nowrap">
                    <button type="button" className="secondary small" onClick={() => setExamId(e.examId)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {exams.length === 0 && (
                <tr>
                  <td colSpan="7">No results have been published for {child.name} yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ResultCard({ child, examId, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getChildExamResult(child.studentId, examId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [child.studentId, examId]);

  return (
    <>
      <div className="page-title no-print">
        <div>
          <h1>Result card</h1>
          <p className="subtitle">{data ? `${data.exam.name} · ${child.name}` : child.name}</p>
        </div>
        <div className="actions">
          <button className="secondary" onClick={() => window.print()} disabled={!data}>
            <span className="rate-cell">
              <Icon name="print" />
              Print
            </span>
          </button>
          <button className="secondary" onClick={onBack}>
            Back to results
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {data && (
        <section className="panel result-card">
          <div className="report-head">
            <div>
              <div className="eyebrow">{data.exam.className}</div>
              <h2>{data.exam.name}</h2>
              <p className="cell-sub">{formatLongDate(data.exam.date)}</p>
            </div>
            <PassFailBadge result={data.result.result} />
          </div>

          <dl className="result-facts">
            <div>
              <dt>Student</dt>
              <dd>
                {data.student.name}
                {data.student.rollNumber && ` (roll ${data.student.rollNumber})`}
              </dd>
            </div>
            <div>
              <dt>Marks</dt>
              <dd>{data.result.complete ? `${data.result.totalObtained} / ${data.result.totalMax}` : 'Incomplete'}</dd>
            </div>
            <div>
              <dt>Percentage</dt>
              <dd>{formatPercent(data.result.percentage)}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{data.result.rank ? `${data.result.rank} of ${data.classStats.rankedCount}` : '—'}</dd>
            </div>
            <div>
              <dt>Class average</dt>
              <dd>{formatPercent(data.classStats.average)}</dd>
            </div>
            <div>
              <dt>Class highest</dt>
              <dd>{formatPercent(data.classStats.highest)}</dd>
            </div>
          </dl>

          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th className="num">Max</th>
                  <th className="num">Pass</th>
                  <th className="num">Obtained</th>
                  <th className="num">%</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.subjects.map((s) => (
                  <tr key={s.subjectId}>
                    <td className="cell-main">
                      {s.subjectName}
                      {s.mark?.remarks && <div className="cell-sub">{s.mark.remarks}</div>}
                    </td>
                    <td className="num">{s.maxMarks}</td>
                    <td className="num">{s.passMarks}</td>
                    <td className="num">
                      <MarkCell mark={s.mark} />
                    </td>
                    <td className="num">{s.mark ? formatPercent(s.mark.percentage) : '—'}</td>
                    <td>
                      {!s.mark ? (
                        <span className="badge muted">Not entered</span>
                      ) : s.mark.absent ? (
                        <span className="badge fail">Absent</span>
                      ) : s.mark.passed ? (
                        <span className="badge good">Passed</span>
                      ) : (
                        <span className="badge fail">Below pass marks</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.exam.remarks && <p className="note">Remarks: {data.exam.remarks}</p>}
        </section>
      )}
    </>
  );
}
