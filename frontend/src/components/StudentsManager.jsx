// Add, edit and remove students. Used by both roles:
// admins see every class, teachers only their own (the backend filters them).

import { useEffect, useState } from 'react';
import { getClasses, getStudents, createStudent, updateStudent, deleteStudent } from '../api';

const EMPTY_FORM = { rollNumber: '', name: '', classId: '', guardianName: '', phone: '' };

export default function StudentsManager() {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null); // null = adding a new student
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    Promise.all([getClasses(), getStudents()])
      .then(([classList, studentList]) => {
        setClasses(classList);
        setStudents(studentList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function startAdd() {
    setEditingId(null);
    // Pre-select the filtered class (or the only class) to save a click.
    const classId = classFilter || (classes.length === 1 ? classes[0].id : '');
    setForm({ ...EMPTY_FORM, classId });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function startEdit(student) {
    setEditingId(student.id);
    setForm({
      rollNumber: student.rollNumber,
      name: student.name,
      classId: student.classId,
      guardianName: student.guardianName,
      phone: student.phone,
    });
    setShowForm(true);
    setError('');
    setMessage('');
  }

  function closeForm() {
    setShowForm(false);
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
        await updateStudent(editingId, form);
        setMessage(`Saved changes to ${form.name}.`);
        closeForm();
      } else {
        await createStudent(form);
        setMessage(`Added ${form.name}. You can add the next student.`);
        // Keep the form open with the same class for quick entry.
        setForm({ ...EMPTY_FORM, classId: form.classId });
      }
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(student) {
    const ok = window.confirm(
      `Remove ${student.name} from ${student.className}?\n\nPast attendance reports are not changed.`
    );
    if (!ok) return;
    setError('');
    try {
      await deleteStudent(student.id);
      setMessage(`Removed ${student.name}.`);
      if (editingId === student.id) closeForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const searchText = search.trim().toLowerCase();
  const visible = students.filter(
    (s) =>
      (!classFilter || s.classId === classFilter) &&
      (!searchText ||
        s.name.toLowerCase().includes(searchText) ||
        s.rollNumber.toLowerCase().includes(searchText))
  );

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Students</h1>
          <p className="subtitle">
            {students.length} students in {classes.length} {classes.length === 1 ? 'class' : 'classes'}
          </p>
        </div>
        {!showForm && classes.length > 0 && <button onClick={startAdd}>+ Add student</button>}
      </div>

      {classes.length === 0 && <p>No classes available. Students belong to a class.</p>}

      {showForm && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Edit student' : 'Add student'}</h2>
          <div className="form-grid">
            <label>
              Class
              <select name="classId" value={form.classId} onChange={handleChange} required>
                <option value="">— Choose a class —</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Roll number
              <input name="rollNumber" value={form.rollNumber} onChange={handleChange} />
            </label>
            <label>
              Student name
              <input name="name" value={form.name} onChange={handleChange} required autoFocus />
            </label>
            <label>
              Guardian name
              <input name="guardianName" value={form.guardianName} onChange={handleChange} />
            </label>
            <label>
              Phone
              <input name="phone" value={form.phone} onChange={handleChange} />
            </label>
          </div>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add student'}</button>
            <button type="button" className="secondary" onClick={closeForm}>
              {editingId ? 'Cancel' : 'Close'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {!showForm && error && <p className="error">{error}</p>}

      <div className="filters">
        <label>
          Class
          <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
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
            placeholder="Name or roll number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <table>
        <thead>
          <tr>
            <th>Roll no.</th>
            <th>Name</th>
            <th>Class</th>
            <th>Guardian</th>
            <th>Phone</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s) => (
            <tr key={s.id}>
              <td>{s.rollNumber || '—'}</td>
              <td>{s.name}</td>
              <td>{s.className}</td>
              <td>{s.guardianName || '—'}</td>
              <td>{s.phone || '—'}</td>
              <td className="nowrap">
                <button className="secondary small" onClick={() => startEdit(s)}>
                  Edit
                </button>{' '}
                <button className="danger small" onClick={() => handleRemove(s)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr>
              <td colSpan="6">No students found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
