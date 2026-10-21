// Teacher screens: dashboard, daily attendance, past reports and students.
// Teachers only ever see their own assigned classes (the backend filters them).

import { useEffect, useState } from 'react';
import { getClasses } from '../api';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import AttendanceForm from '../components/AttendanceForm.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';
import TeacherExams from '../components/TeacherExams.jsx';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'attendance', label: 'Daily attendance', icon: 'attendance' },
  { id: 'reports', label: 'My reports', icon: 'reports' },
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'students', label: 'My students', icon: 'students' },
];

export default function TeacherHome({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');
  const [classes, setClasses] = useState(null); // null = still loading
  const [error, setError] = useState('');

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <Layout user={user} items={MENU} current={page} onNavigate={setPage} onLogout={onLogout}>
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
    </Layout>
  );
}
