// Add, edit and remove students. Used by both roles:
// admins see every class, teachers only their own (the backend filters them).
//
// canManageParents: the student form also adds the student's parents (with
// their portal login), links a brother's or sister's existing parent, and edits
// their details. Everything is saved together with the student. Without it
// (teachers), the form has the simple guardian name and phone instead.

import { useEffect, useState } from 'react';
import { getClasses, getStudents, getParents, createStudent, updateStudent, deleteStudent } from '../api';
import Icon from './Icon.jsx';
import ParentFields, { EMPTY_PARENT, initials, parentToForm } from './ParentFields.jsx';

const EMPTY_STUDENT = { rollNumber: '', name: '', gender: '', classId: '', guardianName: '', phone: '' };
const GENDERS = [
  ['male', 'Boy'],
  ['female', 'Girl'],
];

let nextKey = 1;
const newParentEntry = () => ({ key: nextKey++, mode: 'new', details: { ...EMPTY_PARENT } });
const existingEntry = (parent) => ({ key: nextKey++, mode: 'existing', parentId: parent.id, editing: false, details: parentToForm(parent) });

// One entry of the form -> what the backend expects in `parents`.
function entryToPayload(entry) {
  if (entry.mode === 'existing' && !entry.editing) return { parentId: entry.parentId };
  const { usernameEdited, ...details } = entry.details;
  return entry.mode === 'existing' ? { parentId: entry.parentId, ...details } : details;
}

export default function StudentsManager({ canManageParents = false }) {
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [parents, setParents] = useState([]); // all parent accounts (for linking siblings)
  const [classFilter, setClassFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_STUDENT);
  const [entries, setEntries] = useState([]); // the student's parents on the form
  const [editingId, setEditingId] = useState(null); // null = adding a new student
  const [showForm, setShowForm] = useState(false);
  const [linking, setLinking] = useState(false); // the "link an existing parent" search is open
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    Promise.all([getClasses(), getStudents(), canManageParents ? getParents() : []])
      .then(([classList, studentList, parentList]) => {
        setClasses(classList);
        setStudents(studentList);
        setParents(parentList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openForm(studentForm, parentEntries, id) {
    setEditingId(id);
    setForm(studentForm);
    setEntries(parentEntries);
    setLinking(false);
    setShowForm(true);
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startAdd() {
    // Pre-select the filtered class (or the only class) to save a click.
    const classId = classFilter || (classes.length === 1 ? classes[0].id : '');
    openForm({ ...EMPTY_STUDENT, classId }, canManageParents ? [newParentEntry()] : [], null);
  }

  function startEdit(student) {
    const linked = student.parents
      .map((p) => parents.find((x) => x.id === p.parentId))
      .filter(Boolean)
      .map(existingEntry);
    openForm(
      {
        rollNumber: student.rollNumber,
        name: student.name,
        gender: student.gender ?? '',
        classId: student.classId,
        guardianName: student.guardianName,
        phone: student.phone,
      },
      linked,
      student.id
    );
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_STUDENT);
    setEntries([]);
    setError('');
  }

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function updateEntry(key, changes) {
    setEntries(entries.map((e) => (e.key === key ? { ...e, ...changes } : e)));
  }

  function removeEntry(key) {
    setEntries(entries.filter((e) => e.key !== key));
  }

  function linkParent(parent) {
    setEntries([...entries, existingEntry(parent)]);
    setLinking(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    const payload = canManageParents ? { ...form, parents: entries.map(entryToPayload) } : form;
    setSaving(true);
    try {
      if (editingId) {
        await updateStudent(editingId, payload);
        setMessage(`Saved changes to ${form.name}.`);
        closeForm();
      } else {
        const saved = await createStudent(payload);
        const added = entries.filter((e) => e.mode === 'new').map((e) => e.details);
        // Keep the form open with the same class for quick entry.
        openForm({ ...EMPTY_STUDENT, classId: form.classId }, canManageParents ? [newParentEntry()] : [], null);
        setMessage(
          added.length
            ? `Added ${saved.name}. Parent login${added.length > 1 ? 's' : ''} created: ${added
                .map((p) => `${p.name} (username “${p.username.trim().toLowerCase()}”)`)
                .join(', ')}.`
            : `Added ${saved.name}. You can add the next student.`
        );
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(student) {
    const ok = window.confirm(
      `Remove ${student.name} from ${student.className}?\n\nPast attendance reports are not changed. Their parents keep their accounts.`
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
        s.rollNumber.toLowerCase().includes(searchText) ||
        s.parents.some((p) => p.name.toLowerCase().includes(searchText) || p.phone.includes(searchText)))
  );

  return (
    <>
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

      {message && <p className="success">{message}</p>}

      {showForm && (
        <form className="card student-form" onSubmit={handleSubmit}>
          <div className="form-hero">
            <span className="form-hero-icon" aria-hidden="true">
              <Icon name="students" size={22} />
            </span>
            <div>
              <h2>{editingId ? `Edit ${form.name || 'student'}` : 'Add a new student'}</h2>
              <p className="subtitle">
                {canManageParents
                  ? 'Student details and their parents, with a login for the parent portal, in one step.'
                  : 'The student’s details and a guardian to contact.'}
              </p>
            </div>
          </div>

          <section className="form-section">
            <div className="section-head">
              <span className="section-num">1</span>
              <div>
                <h3>Student</h3>
                <p className="cell-sub">Class, roll number and name</p>
              </div>
            </div>
            <div className="form-grid">
              <label>
                Class <span className="required">*</span>
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
                <input name="rollNumber" value={form.rollNumber} onChange={handleChange} placeholder="Optional" />
              </label>
              <label className="span-2">
                Student name <span className="required">*</span>
                <input name="name" value={form.name} onChange={handleChange} required autoFocus placeholder="e.g. Zara Khan" />
              </label>
              <div className="span-2">
                <span className="field-label">Boy or girl</span>
                <div className="relation-pills" role="radiogroup" aria-label="Boy or girl">
                  {GENDERS.map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={form.gender === value}
                      className={form.gender === value ? 'pill selected' : 'pill'}
                      onClick={() => setForm({ ...form, gender: form.gender === value ? '' : value })}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="cell-sub">Parents see them as their son or daughter.</span>
              </div>
              {!canManageParents && (
                <>
                  <label>
                    Guardian name
                    <input name="guardianName" value={form.guardianName} onChange={handleChange} />
                  </label>
                  <label>
                    Phone
                    <input name="phone" value={form.phone} onChange={handleChange} />
                  </label>
                </>
              )}
            </div>
          </section>

          {canManageParents && (
            <section className="form-section">
              <div className="section-head">
                <span className="section-num">2</span>
                <div>
                  <h3>Parents and guardians</h3>
                  <p className="cell-sub">
                    Each parent gets their own login to follow attendance and results and to message the school. A
                    brother or sister already here? Link their parent instead of adding them again.
                  </p>
                </div>
              </div>

              {entries.length === 0 && (
                <p className="empty-parents">No parent yet. You can save the student and add a parent later.</p>
              )}

              {entries.map((entry, i) => (
                <ParentEntry
                  key={entry.key}
                  entry={entry}
                  number={i + 1}
                  parent={parents.find((p) => p.id === entry.parentId)}
                  editingStudentId={editingId}
                  onChange={(changes) => updateEntry(entry.key, changes)}
                  onRemove={() => removeEntry(entry.key)}
                />
              ))}

              {linking ? (
                <LinkParent
                  parents={parents.filter((p) => !entries.some((e) => e.parentId === p.id))}
                  onLink={linkParent}
                  onCancel={() => setLinking(false)}
                />
              ) : (
                entries.length < 4 && (
                  <div className="add-parent-row">
                    <button type="button" className="secondary" onClick={() => setEntries([...entries, newParentEntry()])}>
                      + Add a new parent
                    </button>
                    <button type="button" className="secondary" onClick={() => setLinking(true)} disabled={parents.length === 0}>
                      Link an existing parent
                    </button>
                  </div>
                )
              )}
            </section>
          )}

          {error && <p className="error">{error}</p>}
          <div className="form-footer">
            <button type="submit" className="btn-lg" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add student'}
            </button>
            <button type="button" className="secondary btn-lg" onClick={closeForm}>
              {editingId ? 'Cancel' : 'Close'}
            </button>
          </div>
        </form>
      )}

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
            placeholder="Name, roll number, parent or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Roll no.</th>
              <th>Name</th>
              <th>Class</th>
              <th>Parents</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id}>
                <td>{s.rollNumber || '—'}</td>
                <td>
                  <div className="cell-main">{s.name}</div>
                  {s.gender && <div className="cell-sub">{s.gender === 'male' ? 'Boy' : 'Girl'}</div>}
                </td>
                <td>{s.className}</td>
                <td>
                  {s.parents.map((p) => (
                    <div key={p.parentId}>
                      {p.name}
                      <span className="cell-sub">
                        {p.relation && ` · ${p.relation}`}
                        {p.phone && ` · ${p.phone}`}
                      </span>
                    </div>
                  ))}
                  {s.parents.length === 0 &&
                    (s.guardianName || s.phone ? (
                      <div>
                        {s.guardianName || '—'}
                        {s.phone && <span className="cell-sub"> · {s.phone}</span>}
                      </div>
                    ) : (
                      <span className="cell-sub">—</span>
                    ))}
                </td>
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
                <td colSpan="5">No students found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// One parent on the student form: a new parent's full form, or an existing
// parent's summary card that can open their details for editing.
function ParentEntry({ entry, number, parent, editingStudentId, onChange, onRemove }) {
  const isNew = entry.mode === 'new';
  const name = entry.details.name || (isNew ? `New parent` : parent?.name);
  const otherChildren = (parent?.children ?? []).filter((c) => c.studentId !== editingStudentId);

  return (
    <div className={isNew ? 'parent-card new' : 'parent-card'}>
      <div className="parent-card-head">
        <span className="avatar parent-avatar" aria-hidden="true">
          {initials(entry.details.name || '')}
        </span>
        <div className="parent-card-title">
          <span className="cell-main">
            {name}
            {entry.details.relation && <span className="badge muted">{entry.details.relation}</span>}
            {isNew && <span className="badge good">New login</span>}
          </span>
          <span className="cell-sub">
            {isNew
              ? `Parent ${number}`
              : [entry.details.phone, `username ${entry.details.username}`].filter(Boolean).join(' · ')}
            {otherChildren.length > 0 && ` · Also parent of ${otherChildren.map((c) => c.name).join(', ')}`}
          </span>
        </div>
        <div className="parent-card-actions">
          {!isNew && (
            <button type="button" className="secondary small" onClick={() => onChange({ editing: !entry.editing })}>
              {entry.editing ? 'Keep as is' : 'Edit details'}
            </button>
          )}
          <button type="button" className="icon-button light" aria-label={`Remove ${name} from this student`} onClick={onRemove}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      {(isNew || entry.editing) && (
        <ParentFields
          value={entry.details}
          isNew={isNew}
          idPrefix={`parent-${entry.key}`}
          onChange={(details) => onChange({ details })}
        />
      )}
    </div>
  );
}

// Search the existing parents (by name, phone, username or child) and link one.
function LinkParent({ parents, onLink, onCancel }) {
  const [query, setQuery] = useState('');
  const text = query.trim().toLowerCase();
  const matches = text
    ? parents.filter(
        (p) =>
          p.name.toLowerCase().includes(text) ||
          p.username.includes(text) ||
          p.phone.includes(text) ||
          p.children.some((c) => c.name.toLowerCase().includes(text))
      )
    : parents;

  return (
    <div className="link-parent">
      <div className="link-parent-head">
        <label>
          Find the parent
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Parent name, phone, username, or a brother's or sister's name"
            autoFocus
          />
        </label>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
      <ul className="link-results">
        {matches.slice(0, 8).map((p) => (
          <li key={p.id}>
            <span className="avatar parent-avatar" aria-hidden="true">
              {initials(p.name)}
            </span>
            <span className="link-result-text">
              <span className="cell-main">
                {p.name}
                {p.relation && <span className="cell-sub"> · {p.relation}</span>}
              </span>
              <span className="cell-sub">
                {[p.phone, p.children.map((c) => `${c.name} (${c.className})`).join(', ') || 'No children'].filter(Boolean).join(' · ')}
              </span>
            </span>
            <button type="button" className="small" onClick={() => onLink(p)}>
              Link
            </button>
          </li>
        ))}
        {matches.length === 0 && <li className="note">No parent matches “{query}”.</li>}
        {matches.length > 8 && <li className="note">Type more to narrow down {matches.length} parents.</li>}
      </ul>
    </div>
  );
}
