// Parent accounts: add, edit, disable and remove parents, and choose which
// children (one or more students, in any class) each parent can see.
// onMessage(parentId): open the conversation with that parent.

import { useEffect, useMemo, useState } from 'react';
import {
  getParents,
  getStudents,
  getClasses,
  createParent,
  updateParent,
  setParentDisabled,
  deleteParent,
} from '../../api';

const EMPTY_FORM = { name: '', username: '', password: '', studentIds: [] };

export default function ParentsManager({ onMessage }) {
  const [parents, setParents] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new parent
  const [pickerClassId, setPickerClassId] = useState('');
  const [search, setSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    Promise.all([getParents(), getStudents(), getClasses()])
      .then(([parentList, studentList, classList]) => {
        setParents(parentList);
        setStudents(studentList);
        setClasses(classList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  // Students shown in the child picker: the chosen class and search, plus
  // everyone already chosen, so a choice never disappears from view.
  const pickable = useMemo(() => {
    const text = search.trim().toLowerCase();
    return students.filter(
      (s) =>
        form.studentIds.includes(s.id) ||
        ((!pickerClassId || s.classId === pickerClassId) &&
          (!text || s.name.toLowerCase().includes(text) || s.guardianName.toLowerCase().includes(text)))
    );
  }, [students, pickerClassId, search, form.studentIds]);

  const shownParents = parents.filter((p) => {
    const text = listSearch.trim().toLowerCase();
    return (
      !text ||
      p.name.toLowerCase().includes(text) ||
      p.username.includes(text) ||
      p.children.some((c) => c.name.toLowerCase().includes(text))
    );
  });

  function startEdit(parent) {
    setEditingId(parent.id);
    setForm({
      name: parent.name,
      username: parent.username,
      password: '',
      studentIds: parent.children.map((c) => c.studentId),
    });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function toggleChild(student, on) {
    const studentIds = on ? [...form.studentIds, student.id] : form.studentIds.filter((id) => id !== student.id);
    // A new parent's name starts as the first child's guardian, when known.
    const name = on && !form.name && student.guardianName ? student.guardianName : form.name;
    setForm({ ...form, name, studentIds });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (form.studentIds.length === 0) {
      setError('Please choose at least one child.');
      return;
    }
    try {
      if (editingId) {
        await updateParent(editingId, form);
        setMessage(`Saved changes to ${form.name}.`);
      } else {
        await createParent(form);
        setMessage(`Added parent ${form.name}. They can now log in with username “${form.username.trim().toLowerCase()}”.`);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggle(parent) {
    const disable = !parent.disabled;
    if (disable && !window.confirm(`Disable ${parent.name}?\n\nThey won't be able to log in until you enable them again.`)) {
      return;
    }
    setError('');
    setMessage('');
    try {
      await setParentDisabled(parent.id, disable);
      setMessage(disable ? `Disabled ${parent.name}.` : `Enabled ${parent.name}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(parent) {
    const ok = window.confirm(
      `Remove ${parent.name}?\n\nTheir account and their messages with the school are deleted. Their children are not changed. This can't be undone.`
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      await deleteParent(parent.id);
      if (editingId === parent.id) resetForm();
      setMessage(`Removed ${parent.name}.`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Parents</h1>
          <p className="subtitle">Parent accounts and the children each parent can follow</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Edit parent' : 'Add parent'}</h2>
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

        <fieldset className="class-picker">
          <legend>
            Children ({form.studentIds.length} chosen)
          </legend>
          <div className="form-grid">
            <label>
              Class
              <select value={pickerClassId} onChange={(e) => setPickerClassId(e.target.value)}>
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Search
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Student or guardian name"
              />
            </label>
          </div>
          <div className="class-options child-options">
            {pickable.map((s) => (
              <label key={s.id} className="check-label">
                <input
                  type="checkbox"
                  checked={form.studentIds.includes(s.id)}
                  onChange={(e) => toggleChild(s, e.target.checked)}
                />
                <span>
                  {s.name}
                  <span className="cell-sub">
                    {' '}
                    · {s.className}
                    {s.rollNumber && `, roll ${s.rollNumber}`}
                    {s.guardianName && ` · guardian ${s.guardianName}`}
                  </span>
                </span>
              </label>
            ))}
            {pickable.length === 0 && <p className="note">No students match.</p>}
          </div>
          <p className="note">A parent can have several children, in any classes.</p>
        </fieldset>

        <p className="note">Passwords are stored as plain text. This is only acceptable for a local demo.</p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add parent'}</button>
          {editingId && (
            <button type="button" className="secondary" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {message && <p className="success">{message}</p>}

      <div className="filters">
        <label>
          Find a parent
          <input
            type="search"
            value={listSearch}
            onChange={(e) => setListSearch(e.target.value)}
            placeholder="Parent, username or child"
          />
        </label>
      </div>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Children</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shownParents.map((p) => (
              <tr key={p.id} className={p.disabled ? 'disabled-row' : ''}>
                <td className="cell-main">{p.name}</td>
                <td>{p.username}</td>
                <td>
                  {p.children.length === 0 && <span className="cell-sub">None (removed students)</span>}
                  {p.children.map((c) => (
                    <div key={c.studentId}>
                      {c.name} <span className="cell-sub">· {c.className}</span>
                    </div>
                  ))}
                </td>
                <td>
                  {p.disabled ? <span className="badge muted">Disabled</span> : <span className="badge good">Active</span>}
                </td>
                <td className="nowrap">
                  <button className="secondary small" onClick={() => onMessage(p.id)}>
                    Message
                  </button>{' '}
                  <button className="secondary small" onClick={() => startEdit(p)}>
                    Edit
                  </button>{' '}
                  <button className="secondary small" onClick={() => handleToggle(p)}>
                    {p.disabled ? 'Enable' : 'Disable'}
                  </button>{' '}
                  <button className="danger small" onClick={() => handleRemove(p)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {shownParents.length === 0 && (
              <tr>
                <td colSpan="5">{parents.length ? 'No parents match.' : 'No parents yet.'}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
