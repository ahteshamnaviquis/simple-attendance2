// Super admin: list, add, edit and remove admins.
// Admins look after students, classes, subjects and attendance; examinations
// and teachers stay with the super admin.

import { useEffect, useState } from 'react';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from '../../api';
import Avatar from '../../components/Avatar.jsx';
import { EntityList, EntityRow, Handle } from '../../components/EntityList.jsx';
import UsernameInput from '../../components/UsernameInput.jsx';

const EMPTY_FORM = { name: '', username: '', password: '' };

export default function AdminsManager() {
  const [admins, setAdmins] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new admin
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    getAdmins()
      .then(setAdmins)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function startEdit(admin) {
    setEditingId(admin.id);
    setForm({ name: admin.name, username: admin.username, password: '' });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingId) {
        await updateAdmin(editingId, form);
        setMessage(`Saved changes to ${form.name}.`);
      } else {
        await createAdmin(form);
        setMessage(`Added admin ${form.name}.`);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(admin) {
    const ok = window.confirm(
      `Remove admin ${admin.name}?\n\nThey will no longer be able to log in. Their past work is not changed.`
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      await deleteAdmin(admin.id);
      setMessage(`Removed ${admin.name}.`);
      if (editingId === admin.id) resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Admins</h1>
          <p className="subtitle">
            Admins manage students, classes, subjects and attendance reports
          </p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit admin' : 'Add admin'}</h2>
        <div className="form-grid">
          <label>
            Name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Username
            <UsernameInput
              name="username"
              value={form.username}
              onChange={(username) => setForm({ ...form, username })}
              saved={admins.find((a) => a.id === editingId)?.username}
              required
            />
          </label>
          <label>
            Password
            <input
              name="password"
              value={form.password}
              onChange={handleChange}
              required={!editingId}
              placeholder={editingId ? 'Leave blank to keep current' : ''}
            />
          </label>
        </div>
        <p className="note">
          Passwords are stored as plain text. This is only acceptable for a local demo.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add admin'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <p className="success">{message}</p>}

      <EntityList noun="admin" summary={`${admins.length} ${admins.length === 1 ? 'admin' : 'admins'}`} empty="No admins yet.">
        {admins.map((a) => (
          <EntityRow
            key={a.id}
            media={(size) => <Avatar name={a.name} id={a.id} photo={a.photo} size={size} />}
            title={a.name}
            subtitle={a.username}
            facts={[
              { label: 'Username', value: <Handle>{a.username}</Handle> },
              { label: 'Role', value: 'Admin' },
            ]}
            actions={[
              { label: 'Edit', icon: 'edit', onClick: () => startEdit(a), scrollTop: true },
              { label: 'Remove', icon: 'trash', danger: true, onClick: () => handleRemove(a) },
            ]}
          />
        ))}
      </EntityList>
    </>
  );
}
