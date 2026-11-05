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
import { childLabel, formatDateTime, formatMediumDate, todayString } from '../utils';

const STATUS_BADGE = { pending: 'warning', approved: 'good', rejected: 'bad' };
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

function Status({ status }) {
  return <span className={`badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>;
}

function dates(leave) {
  const range =
    leave.fromDate === leave.toDate
      ? formatMediumDate(leave.fromDate)
      : `${formatMediumDate(leave.fromDate)} – ${formatMediumDate(leave.toDate)}`;
  return `${range} · ${leave.days} ${leave.days === 1 ? 'day' : 'days'}`;
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
    <article className="panel leave-item">
      <div className="leave-head">
        <div>
          <h3>
            {leave.studentName} <span className="cell-sub">{leave.className}</span>
          </h3>
          <p className="cell-sub">{dates(leave)}</p>
        </div>
        <Status status={leave.status} />
      </div>
      <p className="diary-body">{leave.reason}</p>
      {leave.status !== 'pending' && (
        <p className="leave-decision">
          {STATUS_LABEL[leave.status]} by {leave.reviewedBy} · {formatDateTime(leave.reviewedAt)}
          {leave.reviewNote && <span className="leave-note">“{leave.reviewNote}”</span>}
        </p>
      )}
      <p className="cell-sub">Sent {formatDateTime(leave.createdAt)}</p>
      {leave.status === 'pending' && (
        <div className="actions">
          <button type="button" className="danger small" onClick={withdraw}>
            Withdraw
          </button>
        </div>
      )}
    </article>
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
    <article className="panel leave-item">
      <div className="leave-head">
        <div>
          <h3>
            {leave.studentName} <span className="cell-sub">{leave.className}</span>
          </h3>
          <p className="cell-sub">{dates(leave)}</p>
        </div>
        <Status status={leave.status} />
      </div>
      <p className="diary-body">{leave.reason}</p>
      <p className="cell-sub">
        From {leave.parentName} · {formatDateTime(leave.createdAt)}
      </p>
      {leave.status !== 'pending' && !changing && (
        <p className="leave-decision">
          {STATUS_LABEL[leave.status]} by {leave.reviewedBy} · {formatDateTime(leave.reviewedAt)}
          {leave.reviewNote && <span className="leave-note">“{leave.reviewNote}”</span>}
        </p>
      )}
      {changing ? (
        <div className="leave-review">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Note for the parent (optional)"
            aria-label="Note for the parent"
          />
          <button type="button" className="small" disabled={saving} onClick={() => decide('approved')}>
            Approve
          </button>
          <button type="button" className="danger small" disabled={saving} onClick={() => decide('rejected')}>
            Reject
          </button>
          {leave.status !== 'pending' && (
            <button type="button" className="secondary small" onClick={() => setChanging(false)}>
              Cancel
            </button>
          )}
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="secondary small" onClick={() => setChanging(true)}>
            Change decision
          </button>
        </div>
      )}
    </article>
  );
}
