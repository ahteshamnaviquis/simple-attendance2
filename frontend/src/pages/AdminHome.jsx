import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import ClassesManager from './admin/ClassesManager.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';
import Exams from '../components/Exams.jsx';
import SubjectsManager from './admin/SubjectsManager.jsx';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'students', label: 'Students', icon: 'students' },
  { id: 'classes', label: 'Classes', icon: 'classes' },
  { id: 'subjects', label: 'Subjects', icon: 'subjects' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers' },
];

export default function AdminHome({ user, onLogout }) {
  const [page, setPage] = useState('dashboard');

  return (
    <Layout user={user} items={MENU} current={page} onNavigate={setPage} onLogout={onLogout}>
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
