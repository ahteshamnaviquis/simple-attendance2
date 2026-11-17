// The parent directory: every parent with their relation, contacts and
// children. Edit a parent's details and login, disable or remove them, or open
// their messages. Parents are added on the Students page, with their child.
// onMessage(parentId): open the conversation with that parent.

import { useEffect, useState } from 'react';
import { getParents, updateParent, setParentDisabled, deleteParent } from '../../api';
import ParentFields, { initials, parentToForm } from '../../components/ParentFields.jsx';
import Avatar from '../../components/Avatar.jsx';
import { Chip, Detail, EntityList, EntityRow, Handle, Status } from '../../components/EntityList.jsx';
import PhotoEditor from '../../components/PhotoEditor.jsx';
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

  // A parent's photo was changed (saved straight away).
  function handlePhotoSaved(parent) {
    setParents((list) => list.map((p) => (p.id === parent.id ? parent : p)));
    setMessage(parent.photo ? `Saved the photo of ${parent.name}.` : `Removed the photo of ${parent.name}.`);
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
            <PhotoEditor
              kind="parents"
              id={editing.id}
              name={editing.details.name}
              photo={parents.find((p) => p.id === editing.id)?.photo}
              onSaved={handlePhotoSaved}
            />
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

      <EntityList
        noun="parent"
        summary={
          search
            ? `${shown.length} of ${parents.length} parents`
            : `${parents.length} ${parents.length === 1 ? 'parent' : 'parents'}${
                parents.some((p) => p.disabled) ? ` · ${parents.filter((p) => p.disabled).length} disabled` : ''
              }`
        }
        empty={parents.length ? 'No parents match.' : 'No parents yet. Add them with their child on the Students page.'}
      >
        {shown.map((p) => (
          <EntityRow
            key={p.id}
            muted={p.disabled}
            media={(size) => <Avatar name={p.name} id={p.id} photo={p.photo} size={size} />}
            title={p.name}
            subtitle={
              p.children.length
                ? `${p.relation ? `${p.relation} of ` : ''}${p.children.map((c) => c.name).join(', ')}`
                : 'No children linked'
            }
            status={<Status active={!p.disabled} />}
            facts={[
              {
                label: 'Children',
                value: p.children.length ? (
                  p.children.map((c) => (
                    <Chip key={c.studentId} tone={c.gender === 'male' ? 'boy' : c.gender === 'female' ? 'girl' : ''}>
                      <b>{c.name}</b> · {c.gender ? `${childWord(c.gender)}, ` : ''}
                      {c.className}
                    </Chip>
                  ))
                ) : (
                  <span className="cell-sub">No children linked</span>
                ),
              },
              { label: 'Relation', value: p.relation },
              { label: 'Username', value: <Handle>{p.username}</Handle> },
              { label: 'Phone', value: p.phone && <Detail icon="phone">{p.phone}</Detail> },
              { label: 'Other phone', value: p.altPhone && <Detail icon="phone">{p.altPhone}</Detail> },
              { label: 'Email', value: p.email && <Detail icon="mail">{p.email}</Detail> },
              { label: 'Occupation', value: p.occupation },
            ]}
            actions={[
              { label: 'Message', icon: 'messages', onClick: () => onMessage(p.id) },
              { label: 'Edit', icon: 'edit', onClick: () => startEdit(p) },
              { label: p.disabled ? 'Enable login' : 'Disable login', icon: 'power', onClick: () => handleToggle(p) },
              { label: 'Remove', icon: 'trash', danger: true, onClick: () => handleRemove(p) },
            ]}
          />
        ))}
      </EntityList>
    </>
  );
}
