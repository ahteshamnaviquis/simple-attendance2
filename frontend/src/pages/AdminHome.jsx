import { useState } from 'react';
import Tabs from '../components/Tabs.jsx';
import Dashboard from '../components/Dashboard.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import ClassesManager from './admin/ClassesManager.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'reports', label: 'Reports' },
  { id: 'students', label: 'Students' },
  { id: 'classes', label: 'Classes' },
  { id: 'teachers', label: 'Teachers' },
];

export default function AdminHome({ user }) {
  const [tab, setTab] = useState('dashboard');

  return (
    <div>
      <Tabs tabs={TABS} current={tab} onChange={setTab} />
      {tab === 'dashboard' && <Dashboard user={user} onShowReports={() => setTab('reports')} />}
      {tab === 'reports' && <Reports user={user} />}
      {tab === 'students' && <StudentsManager />}
      {tab === 'classes' && <ClassesManager />}
      {tab === 'teachers' && <TeachersManager />}
    </div>
  );
}
