// Dashboard for one chosen day. Used by both roles:
// - admin:   all classes, students and teachers
// - teacher: only their own classes and students (the backend filters the data)
//
// Shows:
// - key numbers (students, classes, present, absent, rate, reports submitted)
// - a warning listing classes that have not submitted attendance
// - a per-class overview
// - attendance rate for the last 7 or 14 days
// - absence reasons for the day
// - students absent most often in the last 14 days
// - which classes submitted on which days (SubmissionTracker). Clicking a day
//   there opens the attendance form for that class and date right here.
//
// All numbers are calculated here from the lists the API returns -
// the dataset is small, so no special API is needed.

import { useEffect, useState } from 'react';
import { getClasses, getTeachers, getStudents, getReports, getSchoolDays } from '../api';
import { todayString, addDays, formatLongDate, formatShortDay, attendanceRate } from '../utils';
import SubmissionTracker from './SubmissionTracker.jsx';
import AttendanceForm from './AttendanceForm.jsx';

export default function Dashboard({ user, onShowReports, onTakeAttendance }) {
  const isAdmin = user.role === 'admin';
  const [date, setDate] = useState(todayString());
  const [chartDays, setChartDays] = useState(7);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [reports, setReports] = useState([]);
  const [schoolDays, setSchoolDays] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // { classId, date } when the attendance form is open from the tracker
  const [fillTarget, setFillTarget] = useState(null);

  function load() {
    Promise.all([
      getClasses(),
      getStudents(),
      getReports(),
      getSchoolDays(),
      isAdmin ? getTeachers() : Promise.resolve([]),
    ])
      .then(([classList, studentList, reportList, dayList, teacherList]) => {
        setClasses(classList);
        setStudents(studentList);
        setReports(reportList);
        setSchoolDays(new Set(dayList));
        setTeachers(teacherList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [isAdmin]);

  function closeForm() {
    setFillTarget(null);
    load(); // show the new or changed report
  }

  // The attendance form for one class and date, opened from the tracker.
  if (fillTarget) {
    return (
      <div>
        <div className="actions">
          <button className="secondary" onClick={closeForm}>
            ← Back to dashboard
          </button>
        </div>
        <AttendanceForm
          key={`${fillTarget.classId}|${fillTarget.date}`}
          classes={classes}
          initialClassId={fillTarget.classId}
          initialDate={fillTarget.date}
          onCancel={closeForm}
        />
      </div>
    );
  }

  // --- Numbers for the chosen day ---
  const dayReports = reports.filter((r) => r.date === date);
  const present = sum(dayReports, 'present');
  const absent = sum(dayReports, 'absent');
  const rate = attendanceRate(present, absent);
  const addedToday = sum(dayReports, 'addedToday');
  const leftToday = sum(dayReports, 'leftToday');

  const reportByClass = new Map(dayReports.map((r) => [r.classId, r]));
  const missing = classes.filter((c) => !reportByClass.has(c.id));
  const studentCount = (classId) => students.filter((s) => s.classId === classId).length;

  // --- Chart: the last 7 or 14 days, ending on the chosen day ---
  const days = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const day = addDays(date, -i);
    const list = reports.filter((r) => r.date === day);
    const p = sum(list, 'present');
    const a = sum(list, 'absent');
    days.push({ day, present: p, absent: a, reports: list.length, rate: attendanceRate(p, a) });
  }

  // --- Absence reasons for the chosen day ---
  const reasonCounts = new Map();
  let namedAbsentees = 0;
  for (const r of dayReports) {
    for (const a of r.absentees) {
      namedAbsentees++;
      const reason = a.reason || 'No reason given';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
    }
  }
  if (absent > namedAbsentees) {
    reasonCounts.set('Not identified', absent - namedAbsentees);
  }
  const reasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]);

  // --- Students absent most often in the 14 days ending on the chosen day ---
  const fromDate = addDays(date, -13);
  const absentCounts = new Map(); // "name|class" -> { name, className, count }
  for (const r of reports) {
    if (r.date < fromDate || r.date > date) continue;
    for (const a of r.absentees) {
      const key = `${a.name}|${r.className}`;
      const entry = absentCounts.get(key) || { name: a.name, className: r.className, count: 0 };
      entry.count++;
      absentCounts.set(key, entry);
    }
  }
  const frequentAbsentees = [...absentCounts.values()]
    .filter((e) => e.count >= 2)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, 6);

  const firstName = user.name.split(' ')[0];

  return (
    <div className="dashboard">
      <div className="page-title">
        <div>
          <h1>{isAdmin ? 'Dashboard' : `Welcome, ${firstName}`}</h1>
          <p className="subtitle">{formatLongDate(date)}</p>
        </div>
        <div className="date-controls">
          <button className="secondary small" onClick={() => setDate(addDays(date, -1))}>
            ‹ Prev
          </button>
          <input
            type="date"
            value={date}
            max={todayString()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
          />
          <button
            className="secondary small"
            onClick={() => setDate(addDays(date, 1))}
            disabled={date >= todayString()}
          >
            Next ›
          </button>
          <button className="small" onClick={() => setDate(todayString())}>
            Today
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="note">Loading…</p>}

      {/* Key numbers */}
      <div className="kpi-grid">
        <Kpi
          label={isAdmin ? 'Students enrolled' : 'My students'}
          value={students.length}
          caption={`in ${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`}
        />
        {isAdmin ? (
          <Kpi
            label="Teachers"
            value={teachers.length}
            caption={`${classes.filter((c) => c.teacherId).length} classes assigned`}
          />
        ) : (
          <Kpi
            label="My classes"
            value={classes.length}
            caption={classes.map((c) => c.name).join(', ') || 'None assigned'}
          />
        )}
        <Kpi
          label="Reports submitted"
          value={`${dayReports.length} / ${classes.length}`}
          caption={missing.length ? `${missing.length} pending` : 'All classes reported'}
        />
        <Kpi label="Present" value={present} caption={`of ${present + absent} reported students`} />
        <Kpi label="Absent" value={absent} caption={`+${addedToday} joined · −${leftToday} left`} />
        <div className="kpi">
          <div className="kpi-label">Attendance rate</div>
          <div className="kpi-value">{rate === null ? '—' : `${rate}%`}</div>
          <div className="meter" aria-hidden="true">
            <div className="meter-fill" style={{ width: `${rate || 0}%` }} />
          </div>
        </div>
      </div>

      {/* Pending reports warning */}
      {!loading && missing.length > 0 && (
        <div className="alert warning">
          <span className="alert-icon" aria-hidden="true">!</span>
          <div className="alert-body">
            <strong>
              {isAdmin
                ? `${missing.length} ${missing.length === 1 ? 'class has' : 'classes have'} not submitted attendance`
                : `You have not submitted attendance for ${missing.length} ${missing.length === 1 ? 'class' : 'classes'}`}
            </strong>
            <div className="alert-detail">
              {missing
                .map((c) => (isAdmin ? `${c.name} (${c.teacherName || 'no teacher'})` : c.name))
                .join(' · ')}
            </div>
          </div>
          {onTakeAttendance && (
            <button className="small" onClick={onTakeAttendance}>
              Take attendance
            </button>
          )}
        </div>
      )}

      {!loading && (
        <SubmissionTracker
          classes={classes}
          reports={reports}
          schoolDays={schoolDays}
          endDate={date}
          showLate={isAdmin}
          onOpenCell={(classId, day) => {
            setFillTarget({ classId, date: day });
            window.scrollTo({ top: 0 });
          }}
        />
      )}

      <div className="dash-grid">
        <div className="dash-main">
          {/* Per-class overview */}
          <section className="panel">
            <div className="panel-head">
              <h2>{isAdmin ? 'Class overview' : 'My classes'}</h2>
              <button className="secondary small" onClick={onShowReports}>
                {isAdmin ? 'All reports →' : 'My reports →'}
              </button>
            </div>
            <table className="clean">
              <thead>
                <tr>
                  <th>Class</th>
                  <th className="num">Enrolled</th>
                  <th className="num">Present</th>
                  <th className="num">Absent</th>
                  <th>Rate</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const r = reportByClass.get(c.id);
                  const classRate = r ? attendanceRate(r.present, r.absent) : null;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="cell-main">{c.name}</div>
                        {isAdmin && <div className="cell-sub">{c.teacherName || 'No teacher'}</div>}
                      </td>
                      <td className="num">{studentCount(c.id)}</td>
                      <td className="num">{r ? r.present : '—'}</td>
                      <td className="num">{r ? r.absent : '—'}</td>
                      <td>
                        {classRate === null ? (
                          <span className="cell-sub">—</span>
                        ) : (
                          <div className="rate-cell">
                            <div className="meter small" aria-hidden="true">
                              <div className="meter-fill" style={{ width: `${classRate}%` }} />
                            </div>
                            <span>{classRate}%</span>
                          </div>
                        )}
                      </td>
                      <td>
                        {r ? (
                          <span className="badge good">✓ Submitted</span>
                        ) : (
                          <span className="badge warning">! Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {classes.length === 0 && (
                  <tr>
                    <td colSpan="6">No classes yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Frequently absent students */}
          <section className="panel">
            <div className="panel-head">
              <h2>Frequently absent · last 14 days</h2>
            </div>
            {frequentAbsentees.length === 0 ? (
              <p className="cell-sub">No student was absent more than once in this period.</p>
            ) : (
              <table className="clean">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th className="num">Days absent</th>
                  </tr>
                </thead>
                <tbody>
                  {frequentAbsentees.map((e) => (
                    <tr key={`${e.name}|${e.className}`}>
                      <td className="cell-main">{e.name}</td>
                      <td>{e.className}</td>
                      <td className="num">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="dash-side">
          {/* Attendance chart */}
          <section className="panel">
            <div className="panel-head">
              <h2>Attendance rate</h2>
              <div className="toggle">
                {[7, 14].map((n) => (
                  <button
                    key={n}
                    className={chartDays === n ? 'toggle-btn active' : 'toggle-btn'}
                    onClick={() => setChartDays(n)}
                  >
                    {n} days
                  </button>
                ))}
              </div>
            </div>
            <DaysChart days={days} selected={date} onSelect={setDate} />
          </section>

          {/* Absence reasons */}
          <section className="panel">
            <div className="panel-head">
              <h2>Absence reasons</h2>
            </div>
            {reasons.length === 0 ? (
              <p className="cell-sub">No absences recorded for this day.</p>
            ) : (
              <ul className="hbars">
                {reasons.map(([reason, count]) => (
                  <li key={reason}>
                    <span className="hbar-label">{reason}</span>
                    <span className="hbar-track">
                      <span
                        className="hbar-fill"
                        style={{ width: `${(count / reasons[0][1]) * 100}%` }}
                      />
                    </span>
                    <span className="hbar-value">{count}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function sum(list, field) {
  return list.reduce((total, item) => total + item[field], 0);
}

function Kpi({ label, value, caption }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-caption">{caption}</div>
    </div>
  );
}

// Simple bar chart (0-100%) built from divs. Hover a day to see its numbers;
// click a day to open it on the dashboard.
function DaysChart({ days, selected, onSelect }) {
  const [hovered, setHovered] = useState(null);
  const shown =
    (hovered !== null && days[hovered]) || days.find((d) => d.day === selected) || days[days.length - 1];
  const compact = days.length > 7; // short labels when there are many bars
  const columns = { gridTemplateColumns: `repeat(${days.length}, 1fr)` };

  return (
    <div className="week-chart">
      <div className="week-readout">
        <strong>{formatShortDay(shown.day)}</strong>{' '}
        {shown.rate === null
          ? 'No reports'
          : `${shown.rate}% · ${shown.present} present · ${shown.absent} absent · ${shown.reports} ${
              shown.reports === 1 ? 'report' : 'reports'
            }`}
      </div>
      <div className="week-plot" style={columns}>
        <div className="gridline" style={{ bottom: '100%' }}>
          <span>100%</span>
        </div>
        <div className="gridline" style={{ bottom: '50%' }}>
          <span>50%</span>
        </div>
        <div className="gridline base" style={{ bottom: 0 }} />
        {days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            className={`week-col${d.day === selected ? ' selected' : ''}`}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(i)}
            onBlur={() => setHovered(null)}
            onClick={() => onSelect(d.day)}
            aria-label={`${d.day}: ${d.rate === null ? 'no reports' : `${d.rate}%`}`}
          >
            {d.rate === null ? (
              <span className="week-empty" />
            ) : (
              <span className="week-bar" style={{ height: `${Math.max(d.rate, 2)}%` }} />
            )}
          </button>
        ))}
      </div>
      <div className="week-labels" style={columns}>
        {days.map((d) => (
          <span key={d.day} className={d.day === selected ? 'selected' : ''}>
            {compact ? Number(d.day.slice(8)) : formatShortDay(d.day)}
          </span>
        ))}
      </div>
    </div>
  );
}
