// A parent's home page: tabs for their children (with more than one), and the
// chosen child's class, attendance over the last 30 days, latest published
// result, and who teaches them.

import Icon from '../../components/Icon.jsx';
import { PassFailBadge } from '../../components/StudentResult.jsx';
import { childWord, formatMediumDate, formatPercent } from '../../utils';

export default function ChildOverview({ user, childList: children, child, switcher, unread, onOpen, onMessages }) {
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
              {unread} new message{unread === 1 ? '' : 's'} from the school or a teacher
            </strong>
          </div>
          <button type="button" onClick={onMessages}>
            Read messages
          </button>
        </div>
      )}

      {/* With several children, the tabs and the chosen child's card are one unit. */}
      {child && (
        <div className={`child-folder kid-${child.gender ?? 'unknown'}${switcher ? ' with-tabs' : ''}`}>
          {switcher}
          <ChildCard key={child.studentId} child={child} withTabs={Boolean(switcher)} onOpen={onOpen} />
        </div>
      )}
    </>
  );
}

function ChildCard({ child, withTabs, onOpen }) {
  const { attendance, latestExam } = child;
  const rateTone = attendance.rate === null ? '' : attendance.rate >= 90 ? 'good' : attendance.rate >= 75 ? 'warning' : 'fail';

  return (
    <section className="panel child-card">
      <div className="panel-head">
        <div>
          {/* The tab already shows the name, son/daughter and class. */}
          {!withTabs && (
            <>
              <h2>{child.name}</h2>
              <p className="cell-sub">
                {child.gender && `Your ${childWord(child.gender).toLowerCase()} · `}
                {child.className}
              </p>
            </>
          )}
          <div className="child-facts">
            {child.rollNumber && (
              <span className="fact-chip">
                <span className="fact-label">Roll no.</span> {child.rollNumber}
              </span>
            )}
            <span className="fact-chip">
              <span className="fact-label">Class teacher</span> {child.classTeacher || 'Not assigned yet'}
            </span>
            <span className="fact-chip">
              <span className="fact-label">Subjects</span> {child.subjects.length}
            </span>
          </div>
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
        <div className="subjects-block">
          <div className="subjects-head">
            <h3>Subjects and teachers</h3>
            <span className="cell-sub">
              {child.subjects.length} subject{child.subjects.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="subject-grid">
            {child.subjects.map((s) => (
              <SubjectCard key={s.subjectId} subject={s} classTeacher={child.classTeacher} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// Each subject gets its own color, the same every time (from its name).
const SUBJECT_TONES = ['blue', 'violet', 'green', 'amber', 'rose', 'teal', 'indigo', 'orange'];

function subjectTone(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return SUBJECT_TONES[hash % SUBJECT_TONES.length];
}

// "Pakistan Studies" -> "PS", "English" -> "En"
function subjectMark(name) {
  const words = name.split(/\s+/).filter(Boolean);
  return words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2);
}

const initialsOf = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

function SubjectCard({ subject, classTeacher }) {
  const tone = subjectTone(subject.subjectName);
  const teacher = subject.teacherName;
  return (
    <div className={`subject-card tone-${tone}`}>
      <div className="subject-card-top">
        <span className="subject-mark" aria-hidden="true">
          {subjectMark(subject.subjectName)}
        </span>
        <span className="subject-name">{subject.subjectName}</span>
      </div>
      <div className="subject-teacher">
        {teacher ? (
          <>
            <span className="subject-avatar" aria-hidden="true">
              {initialsOf(teacher)}
            </span>
            <span className="subject-teacher-text">
              <span className="subject-teacher-name">{teacher}</span>
              <span className="subject-teacher-role">
                {teacher === classTeacher ? 'Subject & class teacher' : 'Subject teacher'}
              </span>
            </span>
          </>
        ) : (
          <span className="subject-teacher-none">Teacher not assigned yet</span>
        )}
      </div>
    </div>
  );
}
