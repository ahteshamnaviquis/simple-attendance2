// Complaints & suggestions to the school office.
//   Parents and teachers: write one (a parent may say which child it is about),
//   see the office's reply and whether it is resolved, and remove one that has
//   no answer yet.
//   Admins and the super admin: read them all, reply, and mark them resolved
//   or open again. Open ones come first.
//
// childList: the parent's children. onChange: called after a reply, so the
// menu's open count can update.

import { useEffect, useState } from 'react';
import { deleteFeedback, getFeedback, replyToFeedback, sendFeedback } from '../api';
import { childLabel, formatDateTime } from '../utils';

const KIND_LABEL = { complaint: 'Complaint', suggestion: 'Suggestion' };
const ROLE_LABEL = { parent: 'Parent', teacher: 'Teacher' };

export default function Feedback({ user, childList = [], onChange }) {
  const isOffice = user.role === 'admin' || user.role === 'superadmin';
  const [items, setItems] = useState(null);
  const [filters, setFilters] = useState({ kind: '', status: isOffice ? 'open' : '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    getFeedback(filters)
      .then(setItems)
      .catch((err) => setError(err.message));
  }

  useEffect(load, [filters.kind, filters.status]); // eslint-disable-line react-hooks/exhaustive-deps

  function changed(text) {
    setMessage(text);
    setError('');
    load();
    onChange?.();
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Complaints &amp; suggestions</h1>
          <p className="subtitle">
            {isOffice
              ? 'From parents and teachers to the school office'
              : 'Tell the school office about a problem or an idea. Only the school office reads these.'}
          </p>
        </div>
      </div>

      {!isOffice && <FeedbackForm user={user} childList={childList} onSent={changed} onError={setError} />}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="filters">
        <label>
          Type
          <select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value })}>
            <option value="">Complaints and suggestions</option>
            <option value="complaint">Complaints</option>
            <option value="suggestion">Suggestions</option>
          </select>
        </label>
        <label>
          Status
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">Open and resolved</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {items && items.length === 0 && (
        <p className="card">{isOffice
            ? filters.status === 'open'
              ? 'Nothing open: every complaint and suggestion has been answered.'
              : 'Nothing here.'
            : 'You have not sent any complaints or suggestions yet.'}</p>
      )}

      <div className="leave-list">
        {items?.map((item) => (
          <FeedbackItem key={item.id} item={item} isOffice={isOffice} onChanged={changed} onError={setError} />
        ))}
      </div>
    </>
  );
}

function FeedbackForm({ user, childList, onSent, onError }) {
  const empty = { kind: 'complaint', studentId: '', subject: '', body: '' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await sendFeedback({ ...form, studentId: form.studentId || null });
      setForm({ ...empty, kind: form.kind });
      onSent(`Sent your ${form.kind} to the school office.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Write to the school</h2>
      <div className="form-grid">
        <div>
          <span className="field-label">Type</span>
          <div className="status-toggle kind-toggle">
            {Object.entries(KIND_LABEL).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                className={form.kind === kind ? 'present active' : ''}
                aria-pressed={form.kind === kind}
                onClick={() => setForm({ ...form, kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {user.role === 'parent' && childList.length > 0 && (
          <label>
            About <span className="note">(optional)</span>
            <select value={form.studentId} onChange={set('studentId')}>
              <option value="">Not about one child</option>
              {childList.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {childLabel(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Subject
          <input value={form.subject} onChange={set('subject')} maxLength={150} placeholder="In a few words" required />
        </label>
      </div>
      <label className="diary-text">
        Details
        <textarea value={form.body} onChange={set('body')} rows={4} maxLength={4000} required />
      </label>
      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Sending…' : `Send ${form.kind}`}
        </button>
      </div>
    </form>
  );
}

function FeedbackItem({ item, isOffice, onChanged, onError }) {
  const [reply, setReply] = useState(item.reply);
  const [saving, setSaving] = useState(false);

  async function save(status) {
    setSaving(true);
    try {
      await replyToFeedback(item.id, reply, status);
      onChanged(status === 'resolved' ? `Marked “${item.subject}” as resolved.` : `Saved the reply to “${item.subject}”.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove “${item.subject}”?`)) return;
    try {
      await deleteFeedback(item.id);
      onChanged('Removed.');
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <article className="panel leave-item">
      <div className="leave-head">
        <div>
          <span className={item.kind === 'complaint' ? 'badge warning' : 'badge late'}>{KIND_LABEL[item.kind]}</span>
          <h3>{item.subject}</h3>
          <p className="cell-sub">
            {isOffice && `${item.fromName} (${ROLE_LABEL[item.fromRole] ?? item.fromRole}) · `}
            {item.studentName && `About ${item.studentName} · `}
            {formatDateTime(item.createdAt)}
          </p>
        </div>
        <span className={item.status === 'open' ? 'badge warning' : 'badge good'}>
          {item.status === 'open' ? 'Open' : 'Resolved'}
        </span>
      </div>
      <p className="diary-body">{item.body}</p>

      {isOffice ? (
        <div className="feedback-reply">
          <label>
            Reply <span className="note">(the writer sees it)</span>
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={2} maxLength={4000} />
          </label>
          {item.repliedBy && (
            <p className="cell-sub">
              Last reply by {item.repliedBy} · {formatDateTime(item.repliedAt)}
            </p>
          )}
          <div className="actions">
            <button type="button" className="small" disabled={saving} onClick={() => save('resolved')}>
              {item.status === 'open' ? 'Reply and resolve' : 'Save reply'}
            </button>
            {item.status === 'open' ? (
              <button type="button" className="secondary small" disabled={saving} onClick={() => save('open')}>
                Reply, keep open
              </button>
            ) : (
              <button type="button" className="secondary small" disabled={saving} onClick={() => save('open')}>
                Open again
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          {item.reply ? (
            <div className="feedback-answer">
              <p className="field-label">Reply from {item.repliedBy}</p>
              <p className="diary-body">{item.reply}</p>
              <p className="cell-sub">{formatDateTime(item.repliedAt)}</p>
            </div>
          ) : (
            <p className="cell-sub">No reply yet.</p>
          )}
          {item.status === 'open' && !item.reply && (
            <div className="actions">
              <button type="button" className="danger small" onClick={remove}>
                Remove
              </button>
            </div>
          )}
        </>
      )}
    </article>
  );
}
