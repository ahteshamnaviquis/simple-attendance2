import { useState } from 'react';
import { login } from '../api';
import Icon from '../components/Icon.jsx';

const FEATURES = [
  'Daily class reports with absent students and reasons',
  'A 14-day tracker of missed and late submissions',
  'Students, classes and teachers in one place',
];

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        <div className="brand">
          <span className="brand-mark brand-mark-lg">
            <Icon name="check" size={22} strokeWidth={2.4} />
          </span>
          <span>Daily Attendance</span>
        </div>

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
        </form>
      </main>
    </div>
  );
}
