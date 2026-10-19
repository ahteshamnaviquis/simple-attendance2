import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import ClassesManager from './admin/ClassesManager.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'students', label: 'Students', icon: 'students' },
  { id: 'classes', label: 'Classes', icon: 'classes' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers' },
];

export default function AdminHome({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');

  return (
    <Layout user={user} items={MENU} current={page} onNavigate={setPage} onLogout={onLogout}>
      {page === 'dashboard' && <Dashboard user={user} onShowReports={() => setPage('reports')} />}
      {page === 'reports' && <Reports user={user} />}
      {page === 'students' && <StudentsManager />}
      {page === 'classes' && <ClassesManager />}
      {page === 'teachers' && <TeachersManager />}
    </Layout>
  );
}
