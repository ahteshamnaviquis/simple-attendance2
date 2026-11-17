// A teacher's own dashboard: the classes they teach (as class teacher or for a
// subject) with the number of students in each and in total, their messages
// with parents (read and unread), and the school days on which they missed
// their class's attendance. The numbers come from /api/teacher-dashboard.
//
// onTakeAttendance / onMessages: open those pages.

import { useEffect, useState } from 'react';
import { getTeacherDashboard } from '../api';
import { formatLongDate, todayString } from '../utils';
import Icon from './Icon.jsx';

const PERIODS = [7, 30, 90];

export default function TeacherDashboard({ user, onTakeAttendance, onMessages }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getTeacherDashboard({ to: todayString(), days })
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((err) => setError(err.message));
  }, [days]);

  const firstName = user.name.split(' ')[0];
  const classTeacherOf = data?.classes.filter((c) => c.isClassTeacher) ?? [];
  // Boys and girls only when the school has recorded genders.
  const showGender = data?.classes.some((c) => c.boys + c.girls > 0);
  // Missed dates, each with the classes missed that day.
  const missedByDate = [];
  for (const m of data?.missed ?? []) {
    const last = missedByDate[missedByDate.length - 1];
    if (last?.date === m.date) last.classes.push(m.className);
    else missedByDate.push({ date: m.date, classes: [m.className] });
  }

  return (
    <div className="dashboard">
      <div className="page-title">
        <div>
          <h1>Welcome, {firstName}</h1>
          <p className="subtitle">{formatLongDate(todayString())}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="note">Loading…</p>}

      {data && (
        <>
          <div className="kpi-grid">
            <Kpi
              label="My classes"
              value={data.classes.length}
              caption={`Class teacher of ${classTeacherOf.length}`}
            />
            <Kpi label="My students" value={data.totalStudents} caption="In all my classes" />
            <Kpi
              label="Unread messages"
              value={data.messages.unread}
              caption={`${data.messages.read} read · ${data.messages.received} received`}
            />
            <Kpi
              label="Missed attendance"
              value={missedByDate.length}
              caption={`${missedByDate.length === 1 ? 'day' : 'days'} in the last ${days} days`}
            />
          </div>

          {data.pendingToday.length > 0 && (
            <div className="alert warning">
              <span className="alert-icon">
                <Icon name="alert" strokeWidth={2.6} />
              </span>
              <div className="alert-body">
                <strong>Today's attendance is not submitted yet</strong>
                <div className="alert-detail">{data.pendingToday.map((p) => p.className).join(' · ')}</div>
              </div>
              <button className="small" onClick={onTakeAttendance}>
                Take attendance
              </button>
            </div>
          )}

          <div className="dash-grid">
            <div className="dash-main">
              <section className="panel">
                <div className="panel-head">
                  <h2>My classes</h2>
                </div>
                {data.classes.length === 0 ? (
                  <p className="cell-sub">No classes are assigned to you yet. Please ask the admin.</p>
                ) : (
                  <table className="clean">
                    <thead>
                      <tr>
                        <th>Class</th>
                        <th>I teach</th>
                        {showGender && <th className="num">Boys</th>}
                        {showGender && <th className="num">Girls</th>}
                        <th className="num">Students</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.classes.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div className="cell-main">{c.name}</div>
                            {c.isClassTeacher && <div className="cell-sub">Class teacher</div>}
                          </td>
                          <td>{c.subjects.length ? c.subjects.join(', ') : <span className="cell-sub">—</span>}</td>
                          {showGender && <td className="num">{c.boys}</td>}
                          {showGender && <td className="num">{c.girls}</td>}
                          <td className="num">{c.students}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th colSpan={showGender ? 4 : 2}>Total students</th>
                        <th className="num">{data.totalStudents}</th>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </section>

              <section className="panel">
                <div className="panel-head">
                  <h2>Missed attendance</h2>
                  <div className="toggle">
                    {PERIODS.map((n) => (
                      <button
                        key={n}
                        className={days === n ? 'toggle-btn active' : 'toggle-btn'}
                        onClick={() => setDays(n)}
                      >
                        {n} days
                      </button>
                    ))}
                  </div>
                </div>
                {classTeacherOf.length === 0 ? (
                  <p className="cell-sub">You are not the class teacher of any class, so you have no attendance to submit.</p>
                ) : missedByDate.length === 0 ? (
                  <p className="cell-sub">
                    Nothing missed: you submitted attendance on all {data.schoolDays} school{' '}
                    {data.schoolDays === 1 ? 'day' : 'days'} in the last {days} days.
                  </p>
                ) : (
                  <>
                    <p className="cell-sub">
                      Missed on {missedByDate.length} of {data.schoolDays} school days in the last {days} days.
                    </p>
                    <table className="clean">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Class</th>
                        </tr>
                      </thead>
                      <tbody>
                        {missedByDate.map((m) => (
                          <tr key={m.date}>
                            <td className="cell-main">{formatLongDate(m.date)}</td>
                            <td>{m.classes.join(', ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
              </section>
            </div>

            <div className="dash-side">
              <section className="panel">
                <div className="panel-head">
                  <h2>Messages</h2>
                  <button className="secondary small" onClick={onMessages}>
                    Open messages →
                  </button>
                </div>
                <MessageBars messages={data.messages} />
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Received messages split into read and unread, plus sent and conversations.
function MessageBars({ messages }) {
  const rows = [
    ['Received from parents', messages.received],
    ['Read', messages.read],
    ['Unread', messages.unread],
    ['Sent by me', messages.sent],
  ];
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return (
    <>
      <ul className="hbars">
        {rows.map(([label, n]) => (
          <li key={label}>
            <span className="hbar-label">{label}</span>
            <span className="hbar-track">
              <span className="hbar-fill" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="hbar-value">{n}</span>
          </li>
        ))}
      </ul>
      <p className="cell-sub">
        {messages.conversations} {messages.conversations === 1 ? 'conversation' : 'conversations'} with parents
      </p>
    </>
  );
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
