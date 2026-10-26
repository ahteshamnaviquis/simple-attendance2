// List, add and edit teachers. The super admin can also disable a teacher
// (they can't log in until enabled again) or remove them.

import { useEffect, useState } from 'react';
import {
  getTeachers,
  getClasses,
  createTeacher,
  updateTeacher,
  setTeacherDisabled,
  deleteTeacher,
} from '../../api';
import { getSavedUser } from '../../session';

const EMPTY_FORM = { name: '', username: '', password: '' };

export default function TeachersManager() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new teacher
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isSuper = getSavedUser()?.role === 'superadmin';

  function load() {
    Promise.all([getTeachers(), getClasses()])
      .then(([teacherList, classList]) => {
        setTeachers(teacherList);
        setClasses(classList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function classNamesFor(teacherId) {
    const names = classes.filter((c) => c.teacherId === teacherId).map((c) => c.name);
    return names.length ? names.join(', ') : '—';
  }

  function startEdit(teacher) {
    setEditingId(teacher.id);
    setForm({ name: teacher.name, username: teacher.username, password: '' });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleToggle(teacher) {
    const disable = !teacher.disabled;
    if (
      disable &&
      !window.confirm(
        `Disable ${teacher.name}?

They won't be able to log in until you enable them again. Their classes and subjects stay assigned.`
      )
    ) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await setTeacherDisabled(teacher.id, disable);
      setMessage(disable ? `Disabled ${teacher.name}.` : `Enabled ${teacher.name}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(teacher) {
    const ok = window.confirm(
      `Remove ${teacher.name}?

Their account is deleted and their classes and subjects become unassigned. Old attendance reports and marks keep their name. This can't be undone.`
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      await deleteTeacher(teacher.id);
      if (editingId === teacher.id) resetForm();
      setMessage(`Removed ${teacher.name}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
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
        await updateTeacher(editingId, form);
        setMessage(`Saved changes to ${form.name}.`);
      } else {
        await createTeacher(form);
        setMessage(`Added teacher ${form.name}.`);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Teachers</h1>
          <p className="subtitle">Teacher accounts and the classes they teach</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit teacher' : 'Add teacher'}</h2>
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
          <button type="submit">{editingId ? 'Save changes' : 'Add teacher'}</button>
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
            <th>Classes</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {teachers.map((t) => (
            <tr key={t.id} className={t.disabled ? 'disabled-row' : ''}>
              <td>{t.name}</td>
              <td>{t.username}</td>
              <td>{classNamesFor(t.id)}</td>
              <td>
                {t.disabled ? (
                  <span className="badge muted">Disabled</span>
                ) : (
                  <span className="badge good">Active</span>
                )}
              </td>
              <td className="nowrap">
                <button className="secondary small" onClick={() => startEdit(t)}>
                  Edit
                </button>
                {isSuper && (
                  <>
                    {' '}
                    <button className="secondary small" onClick={() => handleToggle(t)}>
                      {t.disabled ? 'Enable' : 'Disable'}
                    </button>{' '}
                    <button className="danger small" onClick={() => handleRemove(t)}>
                      Remove
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {teachers.length === 0 && (
            <tr>
              <td colSpan="5">No teachers yet.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </>
  );
}
