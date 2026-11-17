// Complaints & suggestions to the school office.
//   Parents and teachers: write one (a parent may say which child it is about),
//   see the office's reply and whether it is resolved, and remove one that has
//   no answer yet.
//   Admins and the super admin: read them all, reply, and mark them resolved
//   or open again. Open ones come first.
//
// childList: the parent's children. onChange: called after a reply, so the
// menu's open count can update. showStats: the office's summary on top
// (how many complaints and suggestions, how many are still unanswered, and
// how many each admin resolved).

import { useEffect, useState } from 'react';
import { deleteFeedback, getFeedback, replyToFeedback, sendFeedback } from '../api';
import { childLabel, formatDateTime } from '../utils';

const KIND_LABEL = { complaint: 'Complaint', suggestion: 'Suggestion' };
const ROLE_LABEL = { parent: 'Parent', teacher: 'Teacher' };

export default function Feedback({ user, childList = [], onChange, showStats = false }) {
  const isOffice = user.role === 'admin' || user.role === 'superadmin';
  const [items, setItems] = useState(null);
  const [filters, setFilters] = useState({ kind: '', status: isOffice ? 'open' : '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [all, setAll] = useState(null); // every item, for the summary

  function load() {
    getFeedback(filters)
      .then(setItems)
      .catch((err) => setError(err.message));
    if (showStats) getFeedback({}).then(setAll).catch((err) => setError(err.message));
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

      {showStats && all && <FeedbackStats items={all} />}

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

// The office's summary: totals by type, what is still unanswered, and a chart
// of how many each admin resolved.
function FeedbackStats({ items }) {
  const count = (test) => items.filter(test).length;
  const unanswered = (f) => f.status === 'open' && !f.reply;
  const resolvedBy = {};
  for (const f of items.filter((f) => f.status === 'resolved')) {
    const who = f.repliedBy || 'Resolved without a reply';
    resolvedBy[who] = (resolvedBy[who] || 0) + 1;
  }
  const bars = Object.entries(resolvedBy).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div className="dashboard">
      <div className="kpi-grid">
        <StatTile
          label="Complaints"
          value={count((f) => f.kind === 'complaint')}
          caption={`${count((f) => f.kind === 'complaint' && unanswered(f))} not answered yet`}
        />
        <StatTile
          label="Suggestions"
          value={count((f) => f.kind === 'suggestion')}
          caption={`${count((f) => f.kind === 'suggestion' && unanswered(f))} not answered yet`}
        />
        <StatTile
          label="Resolved"
          value={count((f) => f.status === 'resolved')}
          caption={`of ${items.length} in total`}
        />
        <StatTile
          label="Not answered yet"
          value={count(unanswered)}
          caption={`${count((f) => f.status === 'open' && f.reply)} answered but still open`}
        />
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Resolved by each admin</h2>
        </div>
        {bars.length === 0 ? (
          <p className="cell-sub">Nothing has been resolved yet.</p>
        ) : (
          <ul className="hbars">
            {bars.map(([who, n]) => (
              <li key={who}>
                <span className="hbar-label" title={who}>
                  {who}
                </span>
                <span className="hbar-track">
                  <span className="hbar-fill" style={{ width: `${(n / bars[0][1]) * 100}%` }} />
                </span>
                <span className="hbar-value">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatTile({ label, value, caption }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-caption">{caption}</div>
    </div>
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
