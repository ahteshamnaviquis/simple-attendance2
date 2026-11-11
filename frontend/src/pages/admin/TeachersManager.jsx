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
  setPhoto,
} from '../../api';
import UsernameInput from '../../components/UsernameInput.jsx';
import Avatar from '../../components/Avatar.jsx';
import PhotoEditor from '../../components/PhotoEditor.jsx';
import { getSavedUser } from '../../session';

const EMPTY_FORM = { name: '', username: '', password: '' };

export default function TeachersManager() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new teacher
  const [pendingPhoto, setPendingPhoto] = useState(null); // a new teacher's photo, uploaded after adding
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

  // A teacher's photo was changed (saved straight away).
  function handlePhotoSaved(teacher) {
    setTeachers((list) => list.map((t) => (t.id === teacher.id ? teacher : t)));
    setMessage(teacher.photo ? `Saved the photo of ${teacher.name}.` : `Removed the photo of ${teacher.name}.`);
  }

  function startEdit(teacher) {
    setEditingId(teacher.id);
    setPendingPhoto(null);
    setForm({ name: teacher.name, username: teacher.username, password: '' });
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setPendingPhoto(null);
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
        const created = await createTeacher(form);
        if (pendingPhoto) await setPhoto('teachers', created.id, pendingPhoto);
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
        <PhotoEditor
          kind="teachers"
          id={editingId}
          name={form.name}
          photo={teachers.find((t) => t.id === editingId)?.photo}
          onSaved={handlePhotoSaved}
          pending={pendingPhoto}
          onPendingChange={setPendingPhoto}
        />
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
              saved={teachers.find((t) => t.id === editingId)?.username}
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
          Changing a password logs them out everywhere; they log in again with the new one.
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
              <td>
                <span className="person-cell">
                  <Avatar name={t.name} id={t.id} photo={t.photo} size={32} />
                  {t.name}
                </span>
              </td>
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
