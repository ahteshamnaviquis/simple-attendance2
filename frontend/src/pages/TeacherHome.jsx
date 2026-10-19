// Teacher screens: dashboard, daily attendance, past reports and students.
// Teachers only ever see their own assigned classes (the backend filters them).

import { useEffect, useState } from 'react';
import { getClasses } from '../api';
import Tabs from '../components/Tabs.jsx';
import Dashboard from '../components/Dashboard.jsx';
import AttendanceForm from '../components/AttendanceForm.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'attendance', label: 'Daily attendance' },
  { id: 'reports', label: 'My reports' },
  { id: 'students', label: 'My students' },
];

export default function TeacherHome({ user }) {
  const [tab, setTab] = useState('dashboard');
  const [classes, setClasses] = useState(null); // null = still loading
  const [error, setError] = useState('');

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div>
      <Tabs tabs={TABS} current={tab} onChange={setTab} />
      {error && <p className="error">{error}</p>}

      {tab === 'dashboard' && (
        <Dashboard
          user={user}
          onShowReports={() => setTab('reports')}
          onTakeAttendance={() => setTab('attendance')}
        />
      )}

      {tab === 'attendance' && (
        <>
          <h1>Daily attendance</h1>
          {classes && (
            <p className="note">
              My classes: {classes.length ? classes.map((c) => c.name).join(', ') : 'none'}
            </p>
          )}
          {classes && classes.length === 0 && (
            <p>No classes are assigned to you yet. Please ask the admin.</p>
          )}
          {classes && classes.length > 0 && <AttendanceForm classes={classes} />}
        </>
      )}

      {tab === 'reports' && <Reports user={user} />}
      {tab === 'students' && <StudentsManager />}
    </div>
  );
}
