// Teacher screens: dashboard, daily attendance, past reports, students, and
// messages with the parents of their students.
// Teachers only ever see their own assigned classes (the backend filters them).

import { useEffect, useState } from 'react';
import { getClasses, getPendingLeaveCount, getUnreadMessageCount } from '../api';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import AttendanceForm from '../components/AttendanceForm.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';
import TeacherExams from '../components/TeacherExams.jsx';
import Messages from '../components/Messages.jsx';
import Diary from '../components/Diary.jsx';
import Leaves from '../components/Leaves.jsx';
import Feedback from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import useUnreadCount from '../useUnreadCount';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'attendance', label: 'Daily attendance', icon: 'attendance' },
  { id: 'reports', label: 'My reports', icon: 'reports' },
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'students', label: 'My students', icon: 'students' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'diary', label: 'Diary', icon: 'diary' },
  { id: 'leaves', label: 'Leaves', icon: 'leaves', badgeLabel: 'pending' },
  { id: 'feedback', label: 'Complaints & suggestions', icon: 'feedback', badgeLabel: 'open' },
  { id: 'gallery', label: 'Gallery', icon: 'gallery' },
];

export default function TeacherHome({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');
  const [classes, setClasses] = useState(null); // null = still loading
  const [error, setError] = useState('');
  const [unread, refreshUnread] = useUnreadCount(getUnreadMessageCount);
  const [pendingLeaves, refreshLeaves] = useUnreadCount(getPendingLeaveCount);
  const badges = { messages: unread, leaves: pendingLeaves };
  const items = MENU.map((item) => ({ ...item, badge: badges[item.id] }));

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Layout user={user} items={items} current={page} onNavigate={setPage} onLogout={onLogout}>
      {error && <p className="error">{error}</p>}

      {page === 'dashboard' && (
        <Dashboard
          user={user}
          onShowReports={() => setPage('reports')}
          onTakeAttendance={() => setPage('attendance')}
        />
      )}

      {page === 'attendance' && (
        <>
          <div className="page-title">
            <div>
              <h1>Daily attendance</h1>
              {classes && (
                <p className="subtitle">
                  My classes: {classes.length ? classes.map((c) => c.name).join(', ') : 'none'}
                </p>
              )}
            </div>
          </div>
          {classes && classes.length === 0 && (
            <p className="card">No classes are assigned to you yet. Please ask the admin.</p>
          )}
          {classes && classes.length > 0 && <AttendanceForm classes={classes} />}
        </>
      )}

      {page === 'reports' && <Reports user={user} />}
      {page === 'exams' && <TeacherExams />}
      {page === 'students' && <StudentsManager />}
      {page === 'messages' && <Messages onRead={refreshUnread} />}
      {page === 'diary' && <Diary user={user} />}
      {page === 'leaves' && <Leaves user={user} onChange={refreshLeaves} />}
      {page === 'feedback' && <Feedback user={user} />}
      {page === 'gallery' && <Gallery user={user} />}
    </Layout>
  );
}
