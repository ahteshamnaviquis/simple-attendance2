// Super admin: examinations, teachers, the admin accounts, and the settings
// (the website's theme and what admins may manage).

import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Exams from '../components/Exams.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import AdminsManager from './admin/AdminsManager.jsx';
import SettingsManager from './admin/SettingsManager.jsx';

const MENU = [
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers' },
  { id: 'admins', label: 'Admins', icon: 'admins' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function SuperAdminHome({ user, onLogout, onSettingsSaved }) {
  const [page, setPage] = useState('exams');

  return (
    <Layout user={user} items={MENU} current={page} onNavigate={setPage} onLogout={onLogout}>
      {page === 'exams' && <Exams />}
      {page === 'teachers' && <TeachersManager />}
      {page === 'admins' && <AdminsManager />}
      {page === 'settings' && <SettingsManager onSaved={onSettingsSaved} />}
    </Layout>
  );
}
