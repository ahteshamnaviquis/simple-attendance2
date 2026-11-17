// Admin: list, add and edit classes, and assign a teacher to each class.

import { useEffect, useState } from 'react';
import { getClasses, getTeachers, createClass, updateClass } from '../../api';
import Avatar from '../../components/Avatar.jsx';
import { Chip, EntityList, EntityRow, IconTile } from '../../components/EntityList.jsx';

const EMPTY_FORM = { name: '', teacherId: '' };

export default function ClassesManager() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new class
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    Promise.all([getClasses(), getTeachers()])
      .then(([classList, teacherList]) => {
        setClasses(classList);
        setTeachers(teacherList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function startEdit(cls) {
    setEditingId(cls.id);
    setForm({ name: cls.name, teacherId: cls.teacherId || '' });
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
        await updateClass(editingId, form);
        setMessage(`Saved changes to ${form.name}.`);
      } else {
        await createClass(form);
        setMessage(`Added class ${form.name}.`);
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
          <h1>Classes</h1>
          <p className="subtitle">Classes and their assigned teachers</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit class' : 'Add class'}</h2>
        <div className="form-grid">
          <label>
            Class name
            <input name="name" value={form.name} onChange={handleChange} required />
          </label>
          <label>
            Teacher
            <select name="teacherId" value={form.teacherId} onChange={handleChange}>
              <option value="">— Not assigned —</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.disabled ? ' (disabled)' : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="note">
          Past attendance reports keep the class name and teacher they had on that day.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add class'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <p className="success">{message}</p>}

      <EntityList noun="class" summary={`${classes.length} ${classes.length === 1 ? 'class' : 'classes'}`} empty="No classes yet.">
        {classes.map((c) => (
          <EntityRow
            key={c.id}
            media={(size) => <IconTile icon="classes" size={size} />}
            title={c.name}
            subtitle={c.teacherName || 'No class teacher'}
            facts={[
              {
                label: 'Class teacher',
                value: c.teacherName ? (
                  <span className="entity-detail">
                    <Avatar name={c.teacherName} id={c.teacherId} size={28} />
                    <span className="entity-strong">{c.teacherName}</span>
                  </span>
                ) : (
                  <Chip tone="muted">Not assigned</Chip>
                ),
              },
            ]}
            actions={[{ label: 'Edit', icon: 'edit', onClick: () => startEdit(c), scrollTop: true }]}
          />
        ))}
      </EntityList>
    </>
  );
}
