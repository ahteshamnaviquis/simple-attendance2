// Admin: the dashboard and attendance reports, plus the areas the super admin
// allows in Settings (by default students, classes, subjects and parents).
// Messages with parents are always there. With the parents permission, the
// student form also adds the student's parents.

import { useState } from 'react';
import Layout from '../components/Layout.jsx';
import Dashboard from '../components/Dashboard.jsx';
import TeachersManager from './admin/TeachersManager.jsx';
import ClassesManager from './admin/ClassesManager.jsx';
import Reports from '../components/Reports.jsx';
import StudentsManager from '../components/StudentsManager.jsx';
import Exams from '../components/Exams.jsx';
import SubjectsManager from './admin/SubjectsManager.jsx';
import ParentsManager from './admin/ParentsManager.jsx';
import Messages from '../components/Messages.jsx';
import Diary from '../components/Diary.jsx';
import Leaves from '../components/Leaves.jsx';
import Feedback from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import { getOpenFeedbackCount, getPendingLeaveCount, getUnreadMessageCount } from '../api';
import useUnreadCount from '../useUnreadCount';
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
  { id: 'parents', label: 'Parents', icon: 'parents', area: 'parents' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'diary', label: 'Diary', icon: 'diary' },
  { id: 'leaves', label: 'Leaves', icon: 'leaves', badgeLabel: 'pending' },
  { id: 'feedback', label: 'Complaints & suggestions', icon: 'feedback', badgeLabel: 'open' },
  { id: 'gallery', label: 'Gallery', icon: 'gallery' },
];

export default function AdminHome({ user, onLogout }) {
  const { adminPermissions } = useSettings();
  const [unread, refreshUnread] = useUnreadCount(getUnreadMessageCount);
  const [pendingLeaves, refreshLeaves] = useUnreadCount(getPendingLeaveCount);
  const [openFeedback, refreshFeedback] = useUnreadCount(getOpenFeedbackCount);
  const badges = { messages: unread, leaves: pendingLeaves, feedback: openFeedback };
  const items = MENU.filter((item) => !item.area || adminPermissions[item.area]).map((item) => ({
    ...item,
    badge: badges[item.id],
  }));
  const [page, setPage] = useState('dashboard');
  const [messageParentId, setMessageParentId] = useState(null);

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
      {page === 'dashboard' && <Dashboard user={user} onShowReports={() => setPage('reports')} />}
      {page === 'reports' && <Reports user={user} />}
      {page === 'exams' && <Exams />}
      {page === 'students' && <StudentsManager canManageParents={adminPermissions.parents} />}
      {page === 'classes' && <ClassesManager />}
      {page === 'subjects' && <SubjectsManager />}
      {page === 'teachers' && <TeachersManager />}
      {page === 'parents' && <ParentsManager onMessage={openMessages} />}
      {page === 'messages' && (
        <Messages key={messageParentId} initialParentId={messageParentId} onRead={refreshUnread} />
      )}
      {page === 'diary' && <Diary user={user} />}
      {page === 'leaves' && <Leaves user={user} onChange={refreshLeaves} />}
      {page === 'feedback' && <Feedback user={user} onChange={refreshFeedback} />}
      {page === 'gallery' && <Gallery user={user} />}
    </Layout>
  );
}
