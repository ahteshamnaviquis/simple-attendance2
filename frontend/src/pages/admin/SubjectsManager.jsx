// Admin: the academy's list of subjects, and (below it) which subjects each class
// studies and who teaches them. Subjects can be renamed but not deleted.

import { useEffect, useState } from 'react';
import { getSubjects, createSubject, updateSubject } from '../../api';
import ClassSubjectsManager from './ClassSubjectsManager.jsx';

export default function SubjectsManager() {
  const [subjects, setSubjects] = useState([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState(null); // null = adding a new subject
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    getSubjects()
      .then(setSubjects)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function startEdit(subject) {
    setEditingId(subject.id);
    setName(subject.name);
    setError('');
    setMessage('');
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      if (editingId) {
        await updateSubject(editingId, { name });
        setMessage(`Saved changes to ${name.trim()}.`);
      } else {
        await createSubject({ name });
        setMessage(`Added ${name.trim()}.`);
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
          <h1>Subjects</h1>
          <p className="subtitle">The subjects taught at the academy, and who teaches them in each class</p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>{editingId ? 'Rename subject' : 'Add subject'}</h2>
        <div className="form-grid">
          <label>
            Subject name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mathematics"
              maxLength={60}
              required
            />
          </label>
        </div>
        <p className="note">
          Examinations keep the subject names they were created with. Subjects can't be deleted.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit">{editingId ? 'Save changes' : 'Add subject'}</button>
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
              <th>Subject</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td className="num">
                  <button className="secondary small" onClick={() => startEdit(s)}>
                    Rename
                  </button>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan="2">No subjects yet. Add the subjects taught at the academy.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ClassSubjectsManager subjects={subjects} />
    </>
  );
}
