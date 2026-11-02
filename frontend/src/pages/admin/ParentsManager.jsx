// The parent directory: every parent with their relation, contacts and
// children. Edit a parent's details and login, disable or remove them, or open
// their messages. Parents are added on the Students page, with their child.
// onMessage(parentId): open the conversation with that parent.

import { useEffect, useState } from 'react';
import { getParents, updateParent, setParentDisabled, deleteParent } from '../../api';
import ParentFields, { initials, parentToForm } from '../../components/ParentFields.jsx';
import { childWord } from '../../utils';

export default function ParentsManager({ onMessage }) {
  const [parents, setParents] = useState([]);
  const [editing, setEditing] = useState(null); // { id, details } while editing a parent
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    getParents()
      .then(setParents)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  const text = search.trim().toLowerCase();
  const shown = parents.filter(
    (p) =>
      !text ||
      p.name.toLowerCase().includes(text) ||
      p.username.includes(text) ||
      p.phone.includes(text) ||
      p.children.some((c) => c.name.toLowerCase().includes(text))
  );

  function startEdit(parent) {
    setEditing({ id: parent.id, details: parentToForm(parent) });
    setError('');
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    try {
      const { usernameEdited, ...details } = editing.details;
      await updateParent(editing.id, details);
      setMessage(`Saved changes to ${details.name}.`);
      setEditing(null);
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
      `Remove ${parent.name}?\n\nTheir login and their messages with the school are deleted. Their children are not changed. This can't be undone.`
    );
    if (!ok) return;
    setError('');
    setMessage('');
    try {
      await deleteParent(parent.id);
      if (editing?.id === parent.id) setEditing(null);
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
          <p className="subtitle">
            {parents.length} parent{parents.length === 1 ? '' : 's'}. New parents are added on the Students page,
            together with their child.
          </p>
        </div>
      </div>

      {editing && (
        <form className="card student-form" onSubmit={handleSave}>
          <div className="form-hero">
            <span className="form-hero-icon" aria-hidden="true">
              {initials(editing.details.name)}
            </span>
            <div>
              <h2>Edit {editing.details.name || 'parent'}</h2>
              <p className="subtitle">Contact details and portal login. Children are changed on the student form.</p>
            </div>
          </div>
          <section className="form-section">
            <ParentFields
              value={editing.details}
              isNew={false}
              idPrefix="edit-parent"
              onChange={(details) => setEditing({ ...editing, details })}
            />
          </section>
          {error && <p className="error">{error}</p>}
          <div className="form-footer">
            <button type="submit" className="btn-lg">
              Save changes
            </button>
            <button type="button" className="secondary btn-lg" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {message && <p className="success">{message}</p>}
      {!editing && error && <p className="error">{error}</p>}

      <div className="filters">
        <label>
          Find a parent
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, phone, username or child"
          />
        </label>
      </div>

      <div className="table-box">
        <table>
          <thead>
            <tr>
              <th>Parent</th>
              <th>Contact</th>
              <th>Children</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className={p.disabled ? 'disabled-row' : ''}>
                <td>
                  <div className="cell-main">{p.name}</div>
                  <div className="cell-sub">
                    {[p.relation, `username ${p.username}`, p.occupation].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td>
                  <div>{p.phone || '—'}</div>
                  <div className="cell-sub">{[p.altPhone, p.email].filter(Boolean).join(' · ')}</div>
                </td>
                <td>
                  {p.children.length === 0 && <span className="cell-sub">None</span>}
                  {p.children.map((c) => (
                    <div key={c.studentId}>
                      {c.name}{' '}
                      <span className="cell-sub">
                        · {c.gender ? `${childWord(c.gender)}, ` : ''}
                        {c.className}
                      </span>
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
            {shown.length === 0 && (
              <tr>
                <td colSpan="5">
                  {parents.length ? 'No parents match.' : 'No parents yet. Add them with their child on the Students page.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
