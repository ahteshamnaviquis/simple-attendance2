// Admin: the dashboard and attendance reports, plus the areas the super admin
// allows in Settings (by default students, classes and subjects).

import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import ClassesManager from './admin/ClassesManager.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';
import Exams from '../components/Exams.jsx';
import SubjectsManager from './admin/SubjectsManager.jsx';
import { useSettings } from '../theme';

// area: the admin permission the item needs (none = always shown).
const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'exams', label: 'Examinations', icon: 'exams', area: 'exams' },
  { id: 'students', label: 'Students', icon: 'students', area: 'students' },
  { id: 'classes', label: 'Classes', icon: 'classes', area: 'classes' },
  { id: 'subjects', label: 'Subjects', icon: 'subjects', area: 'subjects' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers', area: 'teachers' },
];

export default function AdminHome({ user, onLogout }) {
  const { adminPermissions } = useSettings();
  const items = MENU.filter((item) => !item.area || adminPermissions[item.area]);
  const [page, setPage] = useState('dashboard');

  return (
    <Layout user={user} items={items} current={page} onNavigate={setPage} onLogout={onLogout}>
      {page === 'dashboard' && <Dashboard user={user} onShowReports={() => setPage('reports')} />}
      {page === 'reports' && <Reports user={user} />}
      {page === 'exams' && <Exams />}
      {page === 'students' && <StudentsManager />}
      {page === 'classes' && <ClassesManager />}
      {page === 'subjects' && <SubjectsManager />}
      {page === 'teachers' && <TeachersManager />}
    </Layout>
  );
}
