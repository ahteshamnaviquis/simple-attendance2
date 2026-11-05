// Parent screens: an overview of each child, their attendance, their published
// exam results, messages with the school office and their children's teachers,
// the class diary, leave applications, complaints & suggestions and the gallery. A parent only ever sees their own
// children (the backend checks every request).

import { useEffect, useState } from 'react';
import { getMyChildren, getMyUnreadCount } from '../api';
import Layout from '../components/Layout.jsx';
import ChildOverview from './parent/ChildOverview.jsx';
import ChildAttendance from './parent/ChildAttendance.jsx';
import ChildResults from './parent/ChildResults.jsx';
import ParentMessages from './parent/ParentMessages.jsx';
import Diary from '../components/Diary.jsx';
import Leaves from '../components/Leaves.jsx';
import Feedback from '../components/Feedback.jsx';
import Gallery from '../components/Gallery.jsx';
import useUnreadCount from '../useUnreadCount';
import { childWord } from '../utils';

const MENU = [
  { id: 'overview', label: 'My children', icon: 'dashboard' },
  { id: 'attendance', label: 'Attendance', icon: 'attendance' },
  { id: 'results', label: 'Results', icon: 'results' },
  { id: 'messages', label: 'Messages', icon: 'messages' },
  { id: 'diary', label: 'Diary', icon: 'diary' },
  { id: 'leaves', label: 'Leaves', icon: 'leaves' },
  { id: 'feedback', label: 'Complaints & suggestions', icon: 'feedback' },
  { id: 'gallery', label: 'Gallery', icon: 'gallery' },
];

export default function ParentHome({ user, onLogout }) {
  const [page, setPage] = useState('overview');
  const [children, setChildren] = useState(null); // null = still loading
  const [childId, setChildId] = useState('');
  const [error, setError] = useState('');
  const [unread, refreshUnread] = useUnreadCount(getMyUnreadCount);
  const items = MENU.map((item) => (item.id === 'messages' ? { ...item, badge: unread } : item));

  useEffect(() => {
    getMyChildren()
      .then((list) => {
        setChildren(list);
        setChildId(list[0]?.studentId ?? '');
      })
      .catch((err) => setError(err.message));
  }, []);

  // From a child's card: open one of their pages.
  function openChildPage(studentId, target) {
    setChildId(studentId);
    setPage(target);
  }

  const child = children?.find((c) => c.studentId === childId);
  const switcher = children && <ChildSwitcher childList={children} childId={childId} setChildId={setChildId} />;

  return (
    <Layout user={user} items={items} current={page} onNavigate={setPage} onLogout={onLogout}>
      {error && <p className="error">{error}</p>}
      {children && children.length === 0 && !['messages', 'feedback', 'gallery'].includes(page) && (
        <p className="card">No children are linked to your account yet. Please message the school.</p>
      )}

      {page === 'overview' && children?.length > 0 && (
        <ChildOverview
          user={user}
          childList={children}
          unread={unread}
          onOpen={openChildPage}
          onMessages={() => setPage('messages')}
        />
      )}
      {page === 'attendance' && child && (
        <ChildAttendance key={child.studentId} child={child} switcher={switcher} />
      )}
      {page === 'results' && child && (
        <ChildResults key={child.studentId} child={child} switcher={switcher} />
      )}
      {page === 'messages' && <ParentMessages childList={children ?? []} onRead={refreshUnread} />}
      {page === 'diary' && child && <Diary key={child.studentId} user={user} child={child} switcher={switcher} />}
      {page === 'leaves' && children?.length > 0 && <Leaves user={user} childList={children} />}
      {page === 'feedback' && <Feedback user={user} childList={children ?? []} />}
      {page === 'gallery' && <Gallery user={user} />}
    </Layout>
  );
}

// Tabs to switch between children (hidden with only one child).
function ChildSwitcher({ childList, childId, setChildId }) {
  if (childList.length < 2) return null;
  return (
    <div className="child-tabs no-print" role="tablist" aria-label="Child">
      {childList.map((c) => (
        <button
          key={c.studentId}
          type="button"
          role="tab"
          aria-selected={c.studentId === childId}
          className={c.studentId === childId ? 'child-tab active' : 'child-tab'}
          onClick={() => setChildId(c.studentId)}
        >
          {c.name}
          <span className="cell-sub">
            {childWord(c.gender)} · {c.className}
          </span>
        </button>
      ))}
    </div>
  );
}
