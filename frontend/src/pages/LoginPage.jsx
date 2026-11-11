import { useEffect, useState } from 'react';
import { login, getDemoLogins, demoLogin } from '../api';
import Icon from '../components/Icon.jsx';
import Brand from '../components/Brand.jsx';
import { useSettings } from '../theme';

const FEATURES = [
  'Daily class reports with absent students and reasons',
  'A 14-day tracker of missed and late submissions',
  'Students, classes and teachers in one place',
  'Parents follow attendance and results, and message the school',
];

const ROLE_GROUPS = [
  { roles: ['superadmin', 'admin'], title: 'Admins' },
  { roles: ['teacher'], title: 'Teachers' },
  { roles: ['parent'], title: 'Parents' },
];
const ROLE_LABEL = { superadmin: 'Super admin', admin: 'Admin', teacher: 'Teacher', parent: 'Parent' };

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

export default function LoginPage({ onLogin }) {
  const { theme } = useSettings();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Demo quick login: filled only when the backend has DEMO_LOGIN=true.
  const [demoUsers, setDemoUsers] = useState([]);

  useEffect(() => {
    getDemoLogins()
      .then((data) => setDemoUsers(data?.enabled ? data.users : []))
      .catch(() => setDemoUsers([]));
  }, []);

  async function handleDemoLogin(userId) {
    setError('');
    setLoading(true);
    try {
      onLogin(await demoLogin(userId));
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <section className="login-intro">
        <Brand theme={theme} large />

        <div className="login-pitch">
          <h1>Attendance for every class, every day.</h1>
          <p>
            Teachers submit their class in a minute. Admins see who reported, who is missing, who
            was late and why students were absent.
          </p>
          <ul>
            {FEATURES.map((feature) => (
              <li key={feature}>
                <Icon name="check" size={18} strokeWidth={2.4} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="login-foot">School attendance prototype</p>
      </section>

      <main className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <h2>Sign in</h2>
            <p className="subtitle">Use the username your school gave you.</p>
          </div>
          <label>
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn-lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="note center">Demo only. Do not use real passwords.</p>

          {demoUsers.length > 0 && (
            <div className="demo-login">
              <div className="demo-login-head">
                <span>Quick demo login</span>
              </div>
              {ROLE_GROUPS.map(({ roles, title }) => {
                const users = demoUsers.filter((u) => roles.includes(u.role));
                if (!users.length) return null;
                return (
                  <div key={title} className="demo-login-group">
                    <h3>{title}</h3>
                    <div className="demo-login-list">
                      {users.map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`demo-profile role-${u.role}`}
                          onClick={() => handleDemoLogin(u.id)}
                          disabled={loading}
                          title={`Sign in as ${u.name} (${u.username})`}
                        >
                          <span className="demo-avatar">{initials(u.name)}</span>
                          <span className="demo-profile-text">
                            <strong>{u.name}</strong>
                            <small>{ROLE_LABEL[u.role] || u.role}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </form>
      </main>
    </div>
  );
}
