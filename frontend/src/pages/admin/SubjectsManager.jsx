// Admin: the academy's list of subjects, and (below it) which subjects each class
// studies and who teaches them. Subjects can be renamed but not deleted.

import { useEffect, useState } from 'react';
import { getSubjects, createSubject, updateSubject } from '../../api';
import { EntityList, EntityRow, IconTile } from '../../components/EntityList.jsx';
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

      <EntityList
        noun="subject"
        summary={`${subjects.length} ${subjects.length === 1 ? 'subject' : 'subjects'}`}
        empty="No subjects yet. Add the subjects taught at the academy."
      >
        {subjects.map((s) => (
          <EntityRow
            key={s.id}
            media={(size) => <IconTile icon="subjects" size={size} />}
            title={s.name}
            facts={[{ label: 'Subject', value: s.name }]}
            actions={[{ label: 'Rename', icon: 'edit', onClick: () => startEdit(s), scrollTop: true }]}
          />
        ))}
      </EntityList>

      <ClassSubjectsManager subjects={subjects} />
    </>
  );
}
