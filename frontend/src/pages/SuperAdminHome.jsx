// Super admin: the dashboard, examinations, teachers, parents and messages with
// parents, complaints & suggestions (with a summary of who resolved what), the
// gallery, the admin accounts, and the settings (the website's theme and what
// admins may manage).

import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import Exams from '../components/Exams.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import AdminsManager from './admin/AdminsManager.jsx';
import SettingsManager from './admin/SettingsManager.jsx';
import ParentsManager from './admin/ParentsManager.jsx';
import Messages from '../components/Messages.jsx';
import Feedback from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import { getOpenFeedbackCount, getUnreadMessageCount } from '../api';
import useUnreadCount from '../useUnreadCount';

const MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'exams', label: 'Examinations', icon: 'exams' },
  { id: 'teachers', label: 'Teachers', icon: 'teachers' },
  { id: 'parents', label: 'Parents', icon: 'parents' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'feedback', label: 'Complaints & suggestions', icon: 'feedback', badgeLabel: 'open' },
  { id: 'gallery', label: 'Gallery', icon: 'gallery' },
  { id: 'admins', label: 'Admins', icon: 'admins' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

export default function SuperAdminHome({ user, onLogout, onSettingsSaved }) {
  const [page, setPage] = useState('dashboard');
  const [messageParentId, setMessageParentId] = useState(null);
  const [unread, refreshUnread] = useUnreadCount(getUnreadMessageCount);
  const [openFeedback, refreshFeedback] = useUnreadCount(getOpenFeedbackCount);
  const badges = { messages: unread, feedback: openFeedback };
  const items = MENU.map((item) => ({ ...item, badge: badges[item.id] }));

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
      {page === 'dashboard' && <Dashboard user={user} />}
      {page === 'exams' && <Exams />}
      {page === 'teachers' && <TeachersManager />}
      {page === 'parents' && <ParentsManager onMessage={openMessages} />}
      {page === 'messages' && (
        <Messages key={messageParentId} initialParentId={messageParentId} onRead={refreshUnread} />
      )}
      {page === 'feedback' && <Feedback user={user} onChange={refreshFeedback} showStats />}
      {page === 'gallery' && <Gallery user={user} />}
      {page === 'admins' && <AdminsManager />}
      {page === 'settings' && <SettingsManager onSaved={onSettingsSaved} />}
    </Layout>
  );
}
