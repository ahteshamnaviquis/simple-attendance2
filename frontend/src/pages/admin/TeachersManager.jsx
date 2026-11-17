// List, add and edit teachers. The super admin can also disable a teacher
// (they can't log in until enabled again) or remove them.

import { useEffect, useState } from 'react';
import {
  getTeachers,
  getClasses,
  getClassSubjects,
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
import { Chip, EntityList, EntityRow, Handle, Status } from '../../components/EntityList.jsx';

const EMPTY_FORM = { name: '', username: '', password: '' };

export default function TeachersManager() {
  const [teachers, setTeachers] = useState([]);
  const [classes, setClasses] = useState([]);
  const [classSubjects, setClassSubjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new teacher
  const [pendingPhoto, setPendingPhoto] = useState(null); // a new teacher's photo, uploaded after adding
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const isSuper = getSavedUser()?.role === 'superadmin';

  function load() {
    Promise.all([getTeachers(), getClasses(), getClassSubjects()])
      .then(([teacherList, classList, subjectRows]) => {
        setTeachers(teacherList);
        setClasses(classList);
        setClassSubjects(subjectRows);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  // What a teacher teaches: the classes they are class teacher of, and each
  // subject with the classes they teach it in.
  function teachingOf(teacherId) {
    const own = classes.filter((c) => c.teacherId === teacherId).map((c) => c.name);
    const classesBySubject = new Map();
    for (const row of classSubjects.filter((r) => r.teacherId === teacherId)) {
      classesBySubject.set(row.subjectName, [...(classesBySubject.get(row.subjectName) ?? []), row.className]);
    }
    return { own, classesBySubject };
  }

  const disabledCount = teachers.filter((t) => t.disabled).length;

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

      <EntityList
        noun="teacher"
        summary={`${teachers.length} ${teachers.length === 1 ? 'teacher' : 'teachers'}${disabledCount ? ` · ${disabledCount} disabled` : ''}`}
        empty="No teachers yet."
      >
        {teachers.map((t) => {
          const { own, classesBySubject } = teachingOf(t.id);
          const subjectNames = [...classesBySubject.keys()];
          return (
            <EntityRow
              key={t.id}
              muted={t.disabled}
              media={(size) => <Avatar name={t.name} id={t.id} photo={t.photo} size={size} />}
              title={t.name}
              subtitle={subjectNames.length ? subjectNames.join(', ') : own.length ? 'Class teacher' : 'No classes yet'}
              status={<Status active={!t.disabled} />}
              facts={[
                { label: 'Username', value: <Handle>{t.username}</Handle> },
                {
                  label: 'Class teacher',
                  value: own.length ? (
                    own.map((name) => (
                      <Chip key={name} tone="accent">
                        {name}
                      </Chip>
                    ))
                  ) : (
                    <span className="cell-sub">Not a class teacher</span>
                  ),
                },
                ...[...classesBySubject].map(([subject, classNames]) => ({
                  label: subject,
                  value: classNames.map((name) => <Chip key={name}>{name}</Chip>),
                })),
                subjectNames.length === 0 && { label: 'Subjects', value: <span className="cell-sub">No subjects yet</span> },
              ]}
              actions={[
                { label: 'Edit', icon: 'edit', onClick: () => startEdit(t), scrollTop: true },
                ...(isSuper
                  ? [
                      { label: t.disabled ? 'Enable login' : 'Disable login', icon: 'power', onClick: () => handleToggle(t) },
                      { label: 'Remove', icon: 'trash', danger: true, onClick: () => handleRemove(t) },
                    ]
                  : []),
              ]}
            />
          );
        })}
      </EntityList>
    </>
  );
}
