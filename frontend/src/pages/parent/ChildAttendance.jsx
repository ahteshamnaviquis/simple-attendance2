// One child's attendance, day by day, from their class's daily reports.

import { useEffect, useState } from 'react';
import { getChildAttendance } from '../../api';
import { addDays, formatLongDate, todayString } from '../../utils';

const RANGES = [30, 60, 90, 180];

export default function ChildAttendance({ child, switcher }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const to = todayString();
    setError('');
    getChildAttendance(child.studentId, { from: addDays(to, -(days - 1)), to })
      .then(setData)
      .catch((err) => setError(err.message));
  }, [child.studentId, days]);

  const summary = data?.summary;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Attendance</h1>
          <p className="subtitle">
            {child.name} · {child.className}
          </p>
        </div>
        <label className="range-select">
          Period
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {RANGES.map((n) => (
              <option key={n} value={n}>
                Last {n} days
              </option>
            ))}
          </select>
        </label>
      </div>

      {switcher}
      {error && <p className="error">{error}</p>}

      {summary && (
        <div className="kpi-grid">
          <div className="kpi">
            <div className="kpi-label">Attendance rate</div>
            <div className="kpi-value">{summary.rate === null ? '—' : `${summary.rate}%`}</div>
            <div className="kpi-caption">Present ÷ school days</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">School days</div>
            <div className="kpi-value">{summary.schoolDays}</div>
            <div className="kpi-caption">Days the class reported</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Present</div>
            <div className="kpi-value">{summary.present}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Absent</div>
            <div className="kpi-value">{summary.absent}</div>
          </div>
        </div>
      )}

      {data && (
        <div className="table-box">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.date}>
                  <td>{formatLongDate(d.date)}</td>
                  <td>
                    {d.status === 'absent' ? (
                      <span className="badge fail">Absent</span>
                    ) : (
                      <span className="badge good">Present</span>
                    )}
                  </td>
                  <td>{d.reason || <span className="cell-sub">—</span>}</td>
                </tr>
              ))}
              {data.days.length === 0 && (
                <tr>
                  <td colSpan="3">No attendance reports for {child.className} in this period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="note">
        Attendance comes from the class teacher's daily report. Days without a report (holidays, weekends) are not
        listed. If something looks wrong, please message the school.
      </p>
    </>
  );
}
