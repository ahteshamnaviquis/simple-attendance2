// Admin: the subjects each class studies, and the teacher of each subject.
// Shown on the Subjects page. The subject teacher enters that subject's exam
// marks; the class teacher (Classes page) still takes attendance.

import { useEffect, useState } from 'react';
import { getClasses, getClassSubjects, getTeachers, setClassSubjects } from '../../api';

export default function ClassSubjectsManager({ subjects }) {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [classId, setClassId] = useState('');
  const [rows, setRows] = useState(null); // [{ subjectId, teacherId }] for the chosen class
  const [savedRows, setSavedRows] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([getClasses(), getTeachers()])
      .then(([classList, teacherList]) => {
        setClasses(classList);
        setTeachers(teacherList);
        if (classList.length > 0) setClassId(classList[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!classId) return;
    let current = true;
    setRows(null);
    getClassSubjects({ classId })
      .then((list) => {
        if (!current) return;
        const loaded = list.map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || '' }));
        setRows(loaded);
        setSavedRows(loaded);
      })
      .catch((err) => current && setError(err.message));
    return () => {
      current = false;
    };
  }, [classId]);

  const dirty = rows !== null && JSON.stringify(rows) !== JSON.stringify(savedRows);

  function changeClass(event) {
    if (dirty && !window.confirm('You have unsaved changes for this class. Leave without saving them?')) return;
    setMessage('');
    setError('');
    setClassId(event.target.value);
  }

  function changeRow(index, field, value) {
    setMessage('');
    setRows(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setMessage('');
    setRows([...rows, { subjectId: '', teacherId: '' }]);
  }

  function removeRow(index) {
    setMessage('');
    setRows(rows.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setError('');
    setMessage('');
    if (rows.some((r) => !r.subjectId)) {
      setError('Please choose a subject for every row, or remove the empty row');
      return;
    }
    setSaving(true);
    try {
      const saved = await setClassSubjects(
        classId,
        rows.map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || null }))
      );
      const loaded = saved.map((r) => ({ subjectId: r.subjectId, teacherId: r.teacherId || '' }));
      setRows(loaded);
      setSavedRows(loaded);
      const name = classes.find((c) => c.id === classId)?.name;
      setMessage(`Saved the subjects of ${name}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const unassigned = rows ? rows.filter((r) => r.subjectId && !r.teacherId).length : 0;

  return (
    <section className="card">
      <h2>Subjects and teachers by class</h2>
      <p className="note">
        Choose the subjects each class studies and who teaches each one. The subject teacher enters that
        subject's examination marks. Existing examinations keep their subjects and marks if you change this.
      </p>

      {classes.length === 0 ? (
        <p className="note">No classes yet. Add classes first.</p>
      ) : (
        <div className="form-grid">
          <label>
            Class
            <select value={classId} onChange={changeClass}>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {subjects.length === 0 && <p className="info">Add subjects above first.</p>}

      {rows && subjects.length > 0 && (
        <>
          <div className="table-box assign-table">
            <table className="subject-rows">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Subject teacher</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const chosenElsewhere = rows.filter((_, i) => i !== index).map((r) => r.subjectId);
                  return (
                    <tr key={index}>
                      <td>
                        <select
                          aria-label="Subject"
                          value={row.subjectId}
                          onChange={(e) => changeRow(index, 'subjectId', e.target.value)}
                        >
                          <option value="">— Choose a subject —</option>
                          {subjects.map((s) => (
                            <option key={s.id} value={s.id} disabled={chosenElsewhere.includes(s.id)}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label="Subject teacher"
                          value={row.teacherId}
                          onChange={(e) => changeRow(index, 'teacherId', e.target.value)}
                        >
                          <option value="">— Not assigned —</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}{t.disabled ? ' (disabled)' : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <button type="button" className="secondary small" onClick={() => removeRow(index)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="3">This class has no subjects yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {unassigned > 0 && (
            <p className="note">
              {unassigned} {unassigned === 1 ? 'subject has' : 'subjects have'} no teacher. The super admin enters
              those marks.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="secondary" onClick={addRow} disabled={rows.length >= subjects.length}>
              + Add subject
            </button>
            <button type="button" onClick={handleSave} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save class subjects'}
            </button>
            {message && <span className="success">{message}</span>}
          </div>
        </>
      )}
      {!rows && error && <p className="error">{error}</p>}
    </section>
  );
}
