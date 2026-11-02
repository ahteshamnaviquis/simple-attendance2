// A parent's home page: one card per child with their class, attendance over
// the last 30 days, latest published result, and who teaches them.

import Icon from '../../components/Icon.jsx';
import { PassFailBadge } from '../../components/StudentResult.jsx';
import { formatMediumDate, formatPercent } from '../../utils';

export default function ChildOverview({ user, childList: children, unread, onOpen, onMessages }) {
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Welcome, {user.name.split(' ')[0]}</h1>
          <p className="subtitle">
            {children.length === 1 ? 'Your child' : `Your ${children.length} children`} at a glance
          </p>
        </div>
      </div>

      {unread > 0 && (
        <div className="alert warning">
          <span className="alert-icon" aria-hidden="true">
            <Icon name="messages" />
          </span>
          <div className="alert-body">
            <strong>
              {unread} new message{unread === 1 ? '' : 's'} from the school
            </strong>
          </div>
          <button type="button" onClick={onMessages}>
            Read messages
          </button>
        </div>
      )}

      {children.map((child) => (
        <ChildCard key={child.studentId} child={child} onOpen={onOpen} />
      ))}
    </>
  );
}

function ChildCard({ child, onOpen }) {
  const { attendance, latestExam } = child;
  const rateTone = attendance.rate === null ? '' : attendance.rate >= 90 ? 'good' : attendance.rate >= 75 ? 'warning' : 'fail';

  return (
    <section className="panel child-card">
      <div className="panel-head">
        <div>
          <h2>{child.name}</h2>
          <p className="cell-sub">
            {child.className}
            {child.rollNumber && ` · Roll ${child.rollNumber}`}
            {child.classTeacher && ` · Class teacher: ${child.classTeacher}`}
          </p>
        </div>
        <div className="actions">
          <button type="button" className="secondary small" onClick={() => onOpen(child.studentId, 'attendance')}>
            Attendance
          </button>
          <button type="button" className="secondary small" onClick={() => onOpen(child.studentId, 'results')}>
            Results
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">Attendance</div>
          <div className="kpi-value">{attendance.rate === null ? '—' : `${attendance.rate}%`}</div>
          <div className="kpi-caption">
            {attendance.schoolDays ? (
              <>
                {attendance.present} of {attendance.schoolDays} school days, last {child.attendanceDays} days{' '}
                {rateTone && <span className={`badge ${rateTone}`}>{rateTone === 'good' ? 'Good' : rateTone === 'warning' ? 'Watch' : 'Low'}</span>}
              </>
            ) : (
              'No class reports in the last 30 days'
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Days absent</div>
          <div className="kpi-value">{attendance.absent}</div>
          <div className="kpi-caption">Last {child.attendanceDays} days</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Latest result</div>
          {latestExam ? (
            <>
              <div className="kpi-value">{formatPercent(latestExam.percentage)}</div>
              <div className="kpi-caption">
                {latestExam.name} · {formatMediumDate(latestExam.date)} <PassFailBadge result={latestExam.result} />
                {latestExam.rank && (
                  <div>
                    Position {latestExam.rank} of {latestExam.rankedCount}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="kpi-value">—</div>
              <div className="kpi-caption">No results published yet</div>
            </>
          )}
        </div>
      </div>

      {child.subjects.length > 0 && (
        <>
          <h3>Subjects and teachers</h3>
          <div className="table-box">
            <table className="clean">
              <tbody>
                {child.subjects.map((s) => (
                  <tr key={s.subjectId}>
                    <td className="cell-main">{s.subjectName}</td>
                    <td>{s.teacherName || <span className="cell-sub">Not assigned yet</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
