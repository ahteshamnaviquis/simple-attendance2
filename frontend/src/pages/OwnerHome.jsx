// The platform owner (the "super super admin"): adds academies (schools), each
// with its username prefix (3 letters, made from the name, and only the owner
// can choose others; it never changes) and its first super admin, renames, disables and enables them, and manages
// each academy's super admins. Everything inside an academy (admins, teachers,
// students, ...) is then managed by its super admin, and belongs to that academy.

import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import UsernameInput from '../components/UsernameInput.jsx';
import { suggestPrefix, withoutPrefix } from '../usernamePrefix';
import {
  getAcademies,
  createAcademy,
  renameAcademy,
  setAcademyDisabled,
  createAcademySuperAdmin,
  updateAcademySuperAdmin,
  deleteAcademySuperAdmin,
} from '../api';

const MENU = [{ id: 'academies', label: 'Academies', icon: 'school' }];
// username: what is typed after the prefix. prefixEdited: false = the prefix follows the name.
const EMPTY_ACADEMY = { name: '', prefix: '', prefixEdited: false, adminName: '', username: '', password: '' };
const EMPTY_ACCOUNT = { name: '', username: '', password: '' };

// The login page with this academy's look (logo, colors, name).
function loginLink(academy) {
  const url = new URL(window.location.href);
  url.search = `?academy=${encodeURIComponent(academy.id)}`;
  url.hash = '';
  return url.toString();
}

export default function OwnerHome({ user, onLogout }) {
  const [academies, setAcademies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_ACADEMY);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return getAcademies()
      .then(setAcademies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const selected = academies.find((a) => a.id === selectedId) ?? null;

  function handleChange(event) {
    const { name, value } = event.target;
    const next = { ...form, [name]: value };
    if (name === 'name' && !form.prefixEdited) next.prefix = value.trim() ? suggestPrefix(value) : '';
    if (name === 'prefix') {
      next.prefix = value.toLowerCase().replace(/[^a-z]/g, '').slice(0, 3);
      next.prefixEdited = true;
    }
    setForm(next);
  }

  const prefixOwner = academies.find((a) => a.prefix === form.prefix);
  const prefixReady = /^[a-z]{3}$/.test(form.prefix);

  async function handleCreate(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const created = await createAcademy({
        name: form.name,
        prefix: form.prefix,
        superAdmin: { name: form.adminName, username: form.username, password: form.password },
      });
      setMessage(`Added ${created.name}. ${form.adminName} can now log in as "${created.superAdmins[0].username}".`);
      setForm(EMPTY_ACADEMY);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleDisabled(academy) {
    const disable = !academy.disabled;
    if (
      disable &&
      !window.confirm(
        `Disable ${academy.name}?\n\nNobody from this academy can log in until you enable it again. Its data is kept.`
      )
    ) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await setAcademyDisabled(academy.id, disable);
      setMessage(disable ? `Disabled ${academy.name}.` : `Enabled ${academy.name}.`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Layout user={user} items={MENU} current="academies" onNavigate={() => setSelectedId(null)} onLogout={onLogout}>
      <div className="page-title">
        <div>
          <h1>Academies</h1>
          <p className="subtitle">
            Each academy has its own super admin, admins, teachers, students, parents and settings
          </p>
        </div>
      </div>

      {selected ? (
        <AcademyDetails
          key={selected.id}
          academy={selected}
          onBack={() => setSelectedId(null)}
          onChanged={load}
        />
      ) : (
        <>
          <form className="card" onSubmit={handleCreate}>
            <h2>Add academy</h2>
            <div className="form-grid">
              <label>
                Academy name
                <input name="name" value={form.name} onChange={handleChange} maxLength={100} required />
              </label>
              <label>
                Username prefix
                <input
                  name="prefix"
                  className="prefix-input"
                  value={form.prefix}
                  onChange={handleChange}
                  minLength={3}
                  maxLength={3}
                  pattern="[A-Za-z]{3}"
                  title="3 letters"
                  required
                  autoComplete="off"
                />
              </label>
            </div>
            {prefixOwner ? (
              <p className="error">
                {form.prefix.toUpperCase()} is already used by {prefixOwner.name}. Choose any other 3 letters.
              </p>
            ) : (
              <p className="note">
                Every username in this academy will start with{' '}
                <strong>{prefixReady ? `${form.prefix}.` : 'these 3 letters and a dot'}</strong>, such as{' '}
                {prefixReady ? `${form.prefix}.sara` : 'abc.sara'}. Made from the name; you can choose other
                letters. It can&apos;t be changed later.
              </p>
            )}
            <h3>Its super admin</h3>
            <div className="form-grid">
              <label>
                Name
                <input name="adminName" value={form.adminName} onChange={handleChange} required />
              </label>
              <label>
                Username
                <UsernameInput
                  prefix={prefixReady ? form.prefix : ''}
                  value={form.username && prefixReady ? `${form.prefix}.${form.username}` : form.username}
                  onChange={(username) => setForm({ ...form, username: withoutPrefix(username, form.prefix) })}
                  required
                />
              </label>
              <label>
                Password
                <input name="password" value={form.password} onChange={handleChange} required />
              </label>
            </div>
            <p className="note">
              Usernames are unique across all academies. Passwords are stored as plain text. This is
              only acceptable for a local demo.
            </p>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button type="submit" disabled={Boolean(prefixOwner)}>
                Add academy
              </button>
            </div>
          </form>

          {message && <p className="success">{message}</p>}

          <div className="table-box">
            <table>
              <thead>
                <tr>
                  <th>Academy</th>
                  <th>Prefix</th>
                  <th>Super admins</th>
                  <th>Admins</th>
                  <th>Teachers</th>
                  <th>Classes</th>
                  <th>Students</th>
                  <th>Parents</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {academies.map((a) => (
                  <tr key={a.id} className={a.disabled ? 'disabled-row' : ''}>
                    <td>{a.name}</td>
                    <td className="nowrap">{a.prefix?.toUpperCase()}</td>
                    <td>{a.superAdmins.map((s) => `${s.name} (${s.username})`).join(', ') || '–'}</td>
                    <td>{a.counts.admins}</td>
                    <td>{a.counts.teachers}</td>
                    <td>{a.counts.classes}</td>
                    <td>{a.counts.students}</td>
                    <td>{a.counts.parents}</td>
                    <td>
                      {a.disabled ? (
                        <span className="badge muted">Disabled</span>
                      ) : (
                        <span className="badge good">Active</span>
                      )}
                    </td>
                    <td className="nowrap">
                      <button className="secondary small" onClick={() => setSelectedId(a.id)}>
                        Manage
                      </button>{' '}
                      <button className={a.disabled ? 'secondary small' : 'danger small'} onClick={() => toggleDisabled(a)}>
                        {a.disabled ? 'Enable' : 'Disable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && academies.length === 0 && (
                  <tr>
                    <td colSpan="10">No academies yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  );
}

// One academy: its name, its login page link, and its super admins.
function AcademyDetails({ academy, onBack, onChanged }) {
  const [name, setName] = useState(academy.name);
  const [form, setForm] = useState(EMPTY_ACCOUNT);
  const [editingId, setEditingId] = useState(null); // null = adding a super admin
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const link = loginLink(academy);

  async function run(action, success) {
    setError('');
    setMessage('');
    try {
      await action();
      setMessage(success);
      await onChanged();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  }

  function handleRename(event) {
    event.preventDefault();
    run(() => renameAcademy(academy.id, name), `Renamed to ${name.trim()}.`);
  }

  function startEdit(account) {
    setEditingId(account.id);
    setForm({ name: account.name, username: account.username, password: '' });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_ACCOUNT);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const saved = await run(
      () => (editingId ? updateAcademySuperAdmin(editingId, form) : createAcademySuperAdmin(academy.id, form)),
      editingId ? `Saved changes to ${form.name}.` : `Added super admin ${form.name}.`
    );
    if (saved) resetForm();
  }

  function handleRemove(account) {
    const ok = window.confirm(
      `Remove super admin ${account.name}?\n\nThey will no longer be able to log in. Their past work is not changed.`
    );
    if (!ok) return;
    if (editingId === account.id) resetForm();
    run(() => deleteAcademySuperAdmin(account.id), `Removed ${account.name}.`);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Copied the login page link.');
    } catch {
      setError('Could not copy. Select the link and copy it instead.');
    }
  }

  return (
    <>
      <div className="actions">
        <button type="button" className="secondary" onClick={onBack}>
          ← All academies
        </button>
      </div>

      <form className="card" onSubmit={handleRename}>
        <h2>
          {academy.name}{' '}
          {academy.disabled ? <span className="badge muted">Disabled</span> : <span className="badge good">Active</span>}
        </h2>
        <div className="form-grid">
          <label>
            Academy name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
          </label>
        </div>
        <p className="note">
          This is the name you see here. The school name shown on its pages is set by its super admin in
          Settings.
        </p>
        <p className="note">
          Username prefix: <strong>{academy.prefix?.toUpperCase()}</strong>. Every username here starts with{' '}
          <code>{academy.prefix}.</code> It can&apos;t be changed.
        </p>
        <div className="actions">
          <button type="submit">Save name</button>
        </div>
        <p className="note">
          Login page with this academy&apos;s logo and colors: <code>{link}</code>{' '}
          <button type="button" className="secondary small" onClick={copyLink}>
            Copy link
          </button>
        </p>
      </form>

      {message && <p className="success">{message}</p>}

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit super admin' : 'Add super admin'}</h2>
        <div className="form-grid">
          <label>
            Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Username
            <UsernameInput
              prefix={academy.prefix}
              value={form.username}
              onChange={(username) => setForm({ ...form, username })}
              saved={academy.superAdmins.find((s) => s.id === editingId)?.username}
              required
            />
          </label>
          <label>
            Password
            <input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required={!editingId}
              placeholder={editingId ? 'Leave blank to keep current' : ''}
            />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add super admin'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Super admin</th>
              <th>Username</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {academy.superAdmins.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>{s.username}</td>
                <td className="nowrap">
                  <button className="secondary small" onClick={() => startEdit(s)}>
                    Edit
                  </button>{' '}
                  <button
                    className="danger small"
                    onClick={() => handleRemove(s)}
                    disabled={academy.superAdmins.length <= 1}
                    title={academy.superAdmins.length <= 1 ? 'An academy needs at least one super admin' : undefined}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
