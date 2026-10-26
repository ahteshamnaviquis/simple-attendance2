// Super admin: list, add, edit and remove admins.
// Admins look after students, classes, subjects and attendance; examinations
// and teachers stay with the super admin.

import { useEffect, useState } from 'react';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin } from '../../api';

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
            <input name="username" value={form.username} onChange={handleChange} required />
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

      <div className="table-box">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id}>
              <td>{a.name}</td>
              <td>{a.username}</td>
              <td className="nowrap">
                <button className="secondary small" onClick={() => startEdit(a)}>
                  Edit
                </button>{' '}
                <button className="danger small" onClick={() => handleRemove(a)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {admins.length === 0 && (
            <tr>
              <td colSpan="3">No admins yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
