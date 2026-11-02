// Super admin: examinations, teachers, parents and messages with parents, the
// admin accounts, and the settings (the website's theme and what admins may manage).

import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Exams from '../components/Exams.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import AdminsManager from './admin/AdminsManager.jsx';
import SettingsManager from './admin/SettingsManager.jsx';
import ParentsManager from './admin/ParentsManager.jsx';
import Messages from '../components/Messages.jsx';
import { getUnreadMessageCount } from '../api';
import useUnreadCount from '../useUnreadCount';

const MENU = [
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers' },
  { id: 'parents', label: 'Parents', icon: 'parents' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'admins', label: 'Admins', icon: 'admins' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function SuperAdminHome({ user, onLogout, onSettingsSaved }) {
  const [page, setPage] = useState('exams');
  const [messageParentId, setMessageParentId] = useState(null);
  const [unread, refreshUnread] = useUnreadCount(getUnreadMessageCount);
  const items = MENU.map((item) => (item.id === 'messages' ? { ...item, badge: unread } : item));

  function openMessages(parentId) {
    setMessageParentId(parentId);
    setPage('messages');
  }

  function navigate(id) {
    setMessageParentId(null);
    setPage(id);
  }

  return (
    <Layout user={user} items={items} current={page} onNavigate={navigate} onLogout={onLogout}>
      {page === 'exams' && <Exams />}
      {page === 'teachers' && <TeachersManager />}
      {page === 'parents' && <ParentsManager onMessage={openMessages} />}
      {page === 'messages' && (
        <Messages key={messageParentId} initialParentId={messageParentId} onRead={refreshUnread} />
      )}
      {page === 'admins' && <AdminsManager />}
      {page === 'settings' && <SettingsManager onSaved={onSettingsSaved} />}
    </Layout>
  );
}
