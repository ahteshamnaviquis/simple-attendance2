// One attendance report, shown in a panel beside the reports list.
// Also the printed layout when "Print" is used on a single report.

import { formatDateTime, formatLongDate, lateInfo } from '../utils';
import Icon from './Icon.jsx';

export default function ReportDetails({ report, showLate, onEdit, onPrint, onClose }) {
  const late = showLate && lateInfo(report);
  const counts = [
    ['Total', report.totalStudents],
    ['Present', report.present],
    ['Absent', report.absent],
    ['Added today', report.addedToday],
    ['Left today', report.leftToday],
  ];

  return (
    <aside className="report-panel" aria-labelledby="report-title">
      <div className="report-head">
        <div>
          <p className="eyebrow">Daily attendance report</p>
          <h2 id="report-title">{report.className}</h2>
          <p className="subtitle">
            {formatLongDate(report.date)} · {report.teacherName || 'No teacher'}
          </p>
        </div>
        {onClose && (
          <button className="icon-button no-print" aria-label="Close report" onClick={onClose}>
            <Icon name="close" />
          </button>
        )}
      </div>

      {late && (
        <div className="late-banner">
          <Icon name="clock" size={16} strokeWidth={2.4} />
          {late}
        </div>
      )}

      <div className="count-grid">
        {counts.map(([label, value]) => (
          <div className="count-box" key={label}>
            {label}
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div>
        <h3>
          Absent students{' '}
          <span className="note">
            · {report.absentees.length} of {report.absent} named
          </span>
        </h3>
        {report.absentees.length === 0 ? (
          <p className="cell-sub">No names recorded.</p>
        ) : (
          <ol className="absent-list">
            {report.absentees.map((a, i) => (
              <li key={i}>
                <span className="cell-main">{a.name}</span>
                <span className="note">{a.reason || 'No reason given'}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="cell-sub">
        Created by {report.createdBy} on {formatDateTime(report.createdAt)}. Last updated by{' '}
        {report.updatedBy} on {formatDateTime(report.updatedAt)}.
      </p>

      {(onEdit || onPrint) && (
        <div className="actions no-print">
          {onEdit && <button onClick={onEdit}>Edit report</button>}
          {onPrint && (
            <button className="secondary" onClick={onPrint}>
              Print
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
