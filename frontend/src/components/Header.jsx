function initials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Header({ user, onLogout }) {
  return (
    <header className="header no-print">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✓</span>
        <span>Daily Attendance</span>
      </div>
      <div className="header-right">
        <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
        <span className="user-info">
          <span className="user-name">{user.name}</span>
          <span className="user-role">{user.role === 'admin' ? 'Administrator' : 'Teacher'}</span>
        </span>
        <button className="secondary small" onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
