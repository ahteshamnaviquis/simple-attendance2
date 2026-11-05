// The class diary: homework and notes for a class on a day.
//   Staff: write entries for the classes and subjects they may (the backend says
//   which, in getDiaryOptions), and read their classes' diary. Admins and the
//   super admin see and write for every class.
//   Parents: read the diary of one child's class (child tabs above).
//
// child / switcher: for parents, the chosen child and the tabs to change it.

import { useEffect, useState } from 'react';
import { createDiaryEntry, deleteDiaryEntry, getDiary, getDiaryOptions, updateDiaryEntry } from '../api';
import { addDays, formatDateTime, formatLongDate, todayString } from '../utils';

const EMPTY = { classId: '', subjectId: '', date: todayString(), title: '', body: '' };

export default function Diary({ user, child, switcher }) {
  const isParent = user.role === 'parent';
  const [options, setOptions] = useState([]); // what this user may write
  const [range, setRange] = useState({ from: addDays(todayString(), -13), to: addDays(todayString(), 7) });
  const [classId, setClassId] = useState('');
  const [data, setData] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isParent) return;
    getDiaryOptions()
      .then((list) => {
        setOptions(list);
        if (list.length === 1) setForm((f) => ({ ...f, classId: list[0].classId }));
      })
      .catch((err) => setError(err.message));
  }, [isParent]);

  function load() {
    setError('');
    getDiary({ ...range, classId, studentId: child?.studentId })
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(load, [range.from, range.to, classId, child?.studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const option = options.find((o) => o.classId === form.classId);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  function startEdit(entry) {
    setEditingId(entry.id);
    setForm({
      classId: entry.classId,
      subjectId: entry.subjectId ?? '',
      date: entry.date,
      title: entry.title,
      body: entry.body,
    });
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...EMPTY, classId: options.length === 1 ? options[0].classId : form.classId, date: form.date });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const entry = { ...form, subjectId: form.subjectId || null };
      if (editingId) {
        await updateDiaryEntry(editingId, entry);
        setMessage('Saved the diary entry.');
      } else {
        await createDiaryEntry(entry);
        setMessage(`Added to ${option?.className ?? 'the'} diary for ${formatLongDate(form.date)}.`);
      }
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(entry) {
    if (!window.confirm(`Remove this diary entry for ${entry.className} on ${formatLongDate(entry.date)}?`)) return;
    try {
      await deleteDiaryEntry(entry.id);
      if (editingId === entry.id) resetForm();
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  // Entries grouped by date: [[date, entries], ...], newest first.
  const days = [];
  for (const entry of data?.entries ?? []) {
    const last = days[days.length - 1];
    if (last?.[0] === entry.date) last[1].push(entry);
    else days.push([entry.date, [entry]]);
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Diary</h1>
          <p className="subtitle">
            {isParent ? `Homework and notes for ${child.name} · ${child.className}` : 'Homework and notes for each class'}
          </p>
        </div>
      </div>

      {switcher}

      {!isParent && options.length > 0 && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>{editingId ? 'Edit diary entry' : 'Write in the diary'}</h2>
          <div className="form-grid">
            <label>
              Class
              <select
                value={form.classId}
                onChange={(e) => setForm({ ...form, classId: e.target.value, subjectId: '' })}
                disabled={Boolean(editingId)}
                required
              >
                <option value="">Choose a class</option>
                {options.map((o) => (
                  <option key={o.classId} value={o.classId}>
                    {o.className}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Subject
              <select value={form.subjectId} onChange={set('subjectId')} required={option && !option.general}>
                {(!option || option.general) && <option value="">General (no subject)</option>}
                {option && !option.general && <option value="">Choose a subject</option>}
                {option?.subjects.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>
                    {s.subjectName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input type="date" value={form.date} onChange={set('date')} required />
            </label>
            <label>
              Title <span className="note">(optional)</span>
              <input value={form.title} onChange={set('title')} maxLength={150} placeholder="e.g. Homework" />
            </label>
          </div>
          <label className="diary-text">
            Diary
            <textarea
              value={form.body}
              onChange={set('body')}
              rows={4}
              maxLength={4000}
              placeholder="e.g. Learn the poem on page 42. Exercise 4.1, questions 1 to 5."
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add to diary'}</button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {(isParent || options.length === 0) && error && <p className="error">{error}</p>}

      <div className="filters">
        {!isParent && (
          <label>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">All my classes</option>
              {options.map((o) => (
                <option key={o.classId} value={o.classId}>
                  {o.className}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          From
          <input type="date" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </label>
      </div>

      {data && days.length === 0 && <p className="card">Nothing in the diary for these dates.</p>}

      {days.map(([date, entries]) => (
        <section key={date} className="diary-day">
          <h2 className="diary-date">
            {formatLongDate(date)}
            {date === todayString() && <span className="badge good">Today</span>}
          </h2>
          {entries.map((entry) => (
            <article key={entry.id} className="panel diary-entry">
              <div className="diary-entry-head">
                <div>
                  <span className="badge muted">{entry.subjectName || 'General'}</span>
                  {!isParent && <span className="diary-class">{entry.className}</span>}
                  {entry.title && <h3>{entry.title}</h3>}
                </div>
                {entry.canEdit && (
                  <div className="actions">
                    <button type="button" className="secondary small" onClick={() => startEdit(entry)}>
                      Edit
                    </button>
                    <button type="button" className="danger small" onClick={() => handleDelete(entry)}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
              <p className="diary-body">{entry.body}</p>
              <p className="cell-sub">
                {entry.createdBy} · {formatDateTime(entry.updatedAt)}
              </p>
            </article>
          ))}
        </section>
      ))}
    </>
  );
}
