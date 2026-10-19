// Shows one attendance report. Also used as the printed layout.

import { formatDateTime, lateInfo } from '../utils';

export default function ReportDetails({ report }) {
  return (
    <div className="report">
      <h2>Daily Attendance Report</h2>
      <table className="details">
        <tbody>
          <tr>
            <th>Class</th>
            <td>{report.className}</td>
          </tr>
          <tr>
            <th>Date</th>
            <td>
              {report.date}
              {lateInfo(report) && (
                <>
                  {' '}
                  <span className="badge late">⏱ {lateInfo(report)}</span>
                </>
              )}
            </td>
          </tr>
          <tr>
            <th>Teacher</th>
            <td>{report.teacherName || '—'}</td>
          </tr>
        </tbody>
      </table>

      <h3>Counts</h3>
      <table>
        <thead>
          <tr>
            <th>Total</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Added today</th>
            <th>Left today</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{report.totalStudents}</td>
            <td>{report.present}</td>
            <td>{report.absent}</td>
            <td>{report.addedToday}</td>
            <td>{report.leftToday}</td>
          </tr>
        </tbody>
      </table>

      <h3>
        Absent students ({report.absentees.length} of {report.absent} named)
      </h3>
      {report.absentees.length === 0 ? (
        <p>No names recorded.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {report.absentees.map((a, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{a.name}</td>
                <td>{a.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="note">
        Created by {report.createdBy} on {formatDateTime(report.createdAt)}. Last updated by{' '}
        {report.updatedBy} on {formatDateTime(report.updatedAt)}.
      </p>
    </div>
  );
}
