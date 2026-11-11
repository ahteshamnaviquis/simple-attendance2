// Leave applications for students.
//   Parents: apply for leave for one of their children, see the decision, and
//   withdraw an application while it is pending.
//   The class teacher, admins and the super admin: approve or reject, with an
//   optional note. Pending applications come first.
//
// childList: the parent's children. onChange: called after a decision, so the
// menu's pending count can update.

import { useEffect, useState } from 'react';
import { applyForLeave, getLeaves, reviewLeave, withdrawLeave } from '../api';
import { childLabel, formatDateTime, todayString } from '../utils';
import Icon from './Icon.jsx';

const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

const asDate = (text) => new Date(`${text}T00:00:00`);
const DAY_MS = 24 * 60 * 60 * 1000;

// "Thu, 12 Nov" (with the year when it isn't this year).
function shortDate(text) {
  const d = asDate(text);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(d.getFullYear() !== new Date().getFullYear() && { year: 'numeric' }),
  });
}

// "8 Nov, 20:15"
function shortDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

// When the leave is, compared with today: "Starts in 2 days", "On leave now", ...
function timing(leave) {
  if (leave.status === 'rejected') return null;
  const today = todayString();
  if (leave.toDate < today) return null;
  if (leave.fromDate <= today) return { text: 'On leave now', tone: 'now' };
  const days = Math.round((asDate(leave.fromDate) - asDate(today)) / DAY_MS);
  return { text: days === 1 ? 'Starts tomorrow' : `Starts in ${days} days`, tone: 'soon' };
}

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

// One leave application, the same card for parents and for the school.
// `footer` holds the buttons; `children` (optional) replaces the decision box,
// used while a teacher or admin is deciding.
function LeaveCard({ leave, sender, footer, children }) {
  const from = asDate(leave.fromDate);
  const when = timing(leave);
  const decided = leave.status !== 'pending';
  return (
    <article className={`leave-card status-${leave.status}`}>
      <div className="leave-date" aria-hidden="true">
        <span className="leave-date-month">{from.toLocaleDateString(undefined, { month: 'short' })}</span>
        <span className="leave-date-day">{from.getDate()}</span>
        <span className="leave-date-len">
          {leave.days} {leave.days === 1 ? 'day' : 'days'}
        </span>
      </div>

      <div className="leave-main">
        <header className="leave-top">
          <div className="leave-who">
            <h3>{leave.studentName}</h3>
            {leave.className && <span className="leave-class">{leave.className}</span>}
          </div>
          <span className={`leave-status ${leave.status}`}>
            <span className="leave-status-dot" />
            {STATUS_LABEL[leave.status]}
          </span>
        </header>

        <p className="leave-range">
          <Icon name="leaves" size={15} />
          <span>
            {leave.fromDate === leave.toDate
              ? shortDate(leave.fromDate)
              : `${shortDate(leave.fromDate)} → ${shortDate(leave.toDate)}`}
          </span>
          {when && <span className={`leave-when ${when.tone}`}>{when.text}</span>}
        </p>

        <blockquote className="leave-reason">{leave.reason}</blockquote>

        {children ??
          (decided && (
            <div className={`leave-verdict ${leave.status}`}>
              <span className="leave-verdict-icon">
                <Icon name={leave.status === 'approved' ? 'check' : 'close'} size={14} strokeWidth={2.6} />
              </span>
              <div>
                <p className="leave-verdict-title">
                  {STATUS_LABEL[leave.status]} by <strong>{leave.reviewedBy || 'the school'}</strong>
                  <span className="leave-verdict-time"> · {shortDateTime(leave.reviewedAt)}</span>
                </p>
                {leave.reviewNote && <p className="leave-verdict-note">“{leave.reviewNote}”</p>}
              </div>
            </div>
          ))}

        <footer className="leave-foot">
          <span className="leave-sender" title={formatDateTime(leave.createdAt)}>
            {sender && <span className="leave-avatar">{initials(sender)}</span>}
            <span>
              {sender ? (
                <>
                  <strong>{sender}</strong> · sent {shortDateTime(leave.createdAt)}
                </>
              ) : (
                <>Sent {shortDateTime(leave.createdAt)}</>
              )}
            </span>
          </span>
          {footer && <div className="leave-actions">{footer}</div>}
        </footer>
      </div>
    </article>
  );
}

export default function Leaves({ user, childList = [], onChange }) {
  const isParent = user.role === 'parent';
  const [leaves, setLeaves] = useState(null);
  const [status, setStatus] = useState(isParent ? '' : 'pending');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    getLeaves({ status })
      .then(setLeaves)
      .catch((err) => setError(err.message));
  }

  useEffect(load, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <h1>Leaves</h1>
          <p className="subtitle">
            {isParent
              ? 'Ask for leave for your child; the class teacher or school office decides'
              : user.role === 'teacher'
                ? 'Leave applications for the classes you are class teacher of'
                : 'Leave applications from parents, for every class'}
          </p>
        </div>
      </div>

      {isParent && childList.length > 0 && <LeaveForm childList={childList} onApplied={changed} onError={setError} />}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="status-filter" role="tablist" aria-label="Status">
        {['pending', 'approved', 'rejected', ''].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            role="tab"
            aria-selected={status === s}
            className={status === s ? 'chip active' : 'chip'}
            onClick={() => setStatus(s)}
          >
            {s ? STATUS_LABEL[s] : 'All'}
          </button>
        ))}
      </div>

      {leaves && leaves.length === 0 && (
        <p className="card">
          {status === 'pending' ? 'No applications are waiting for a decision.' : 'No leave applications here.'}
        </p>
      )}

      <div className="leave-list">
        {leaves?.map((leave) =>
          isParent ? (
            <ParentLeave key={leave.id} leave={leave} onWithdrawn={changed} onError={setError} />
          ) : (
            <ReviewLeave key={leave.id} leave={leave} onReviewed={changed} onError={setError} />
          )
        )}
      </div>
    </>
  );
}

function LeaveForm({ childList, onApplied, onError }) {
  const today = todayString();
  const [form, setForm] = useState({ studentId: childList[0].studentId, fromDate: today, toDate: today, reason: '' });
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await applyForLeave(form);
      const child = childList.find((c) => c.studentId === form.studentId);
      setForm({ ...form, reason: '' });
      onApplied(`Sent the leave application for ${child.name}. You'll see the decision here.`);
    } catch (err) {
      onError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Apply for leave</h2>
      <div className="form-grid">
        {childList.length > 1 && (
          <label>
            Child
            <select value={form.studentId} onChange={set('studentId')}>
              {childList.map((c) => (
                <option key={c.studentId} value={c.studentId}>
                  {childLabel(c)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          First day
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => {
              const fromDate = e.target.value;
              setForm({ ...form, fromDate, toDate: form.toDate < fromDate ? fromDate : form.toDate });
            }}
            required
          />
        </label>
        <label>
          Last day
          <input type="date" value={form.toDate} min={form.fromDate} onChange={set('toDate')} required />
        </label>
      </div>
      <label className="diary-text">
        Reason
        <textarea
          value={form.reason}
          onChange={set('reason')}
          rows={3}
          maxLength={1000}
          placeholder="e.g. Fever, the doctor advised two days' rest."
          required
        />
      </label>
      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Sending…' : 'Send application'}
        </button>
      </div>
    </form>
  );
}

function ParentLeave({ leave, onWithdrawn, onError }) {
  async function withdraw() {
    if (!window.confirm('Withdraw this leave application?')) return;
    try {
      await withdrawLeave(leave.id);
      onWithdrawn('The application was withdrawn.');
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <LeaveCard
      leave={leave}
      footer={
        leave.status === 'pending' && (
          <button type="button" className="danger small" onClick={withdraw}>
            Withdraw
          </button>
        )
      }
    >
      {leave.status === 'pending' ? (
        <p className="leave-waiting">
          <Icon name="clock" size={15} /> Waiting for the class teacher or the school office to decide.
        </p>
      ) : undefined}
    </LeaveCard>
  );
}

function ReviewLeave({ leave, onReviewed, onError }) {
  const [note, setNote] = useState(leave.reviewNote);
  const [changing, setChanging] = useState(leave.status === 'pending');
  const [saving, setSaving] = useState(false);

  async function decide(status) {
    setSaving(true);
    try {
      await reviewLeave(leave.id, status, note);
      onReviewed(`${STATUS_LABEL[status]} the leave for ${leave.studentName}.`);
    } catch (err) {
      onError(err.message);
      setSaving(false);
    }
  }

  return (
    <LeaveCard
      leave={leave}
      sender={leave.parentName}
      footer={
        changing ? (
          <>
            {leave.status !== 'pending' && (
              <button type="button" className="secondary small" onClick={() => setChanging(false)}>
                Cancel
              </button>
            )}
            <button type="button" className="danger small" disabled={saving} onClick={() => decide('rejected')}>
              Reject
            </button>
            <button type="button" className="small" disabled={saving} onClick={() => decide('approved')}>
              Approve
            </button>
          </>
        ) : (
          <button type="button" className="secondary small" onClick={() => setChanging(true)}>
            Change decision
          </button>
        )
      }
    >
      {changing ? (
        <label className="leave-note-field">
          <span>Note for the parent (optional)</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="e.g. Approved. Please complete the missed class work."
          />
        </label>
      ) : undefined}
    </LeaveCard>
  );
}
