// Page frame for logged-in users: navy sidebar with navigation on the left,
// the current screen on the right. On a phone the sidebar stacks on top.
// items: [{ id, label, icon }]

import Icon from './Icon.jsx';

function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Layout({ user, items, current, onNavigate, onLogout, children }) {
  return (
    <div className="layout">
      <aside className="sidebar no-print">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="check" size={19} strokeWidth={2.4} />
          </span>
          <span>Daily Attendance</span>
        </div>

        <nav className="side-nav" aria-label="Main">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={item.id === current ? 'side-link active' : 'side-link'}
              aria-current={item.id === current ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="side-user">
          <span className="avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <span className="user-info">
            <span className="user-name">{user.name}</span>
            <span className="user-role">{user.role === 'admin' ? 'Administrator' : 'Teacher'}</span>
          </span>
          <button type="button" className="icon-button" aria-label="Log out" onClick={onLogout}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
