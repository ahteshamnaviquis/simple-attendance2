// The school's messages with parents: conversations on the left (newest
// first, unread ones marked), the open conversation on the right. "New message"
// sends one message to all parents, the parents of a class, or chosen parents;
// each parent gets it in their own private conversation.
//
// initialParentId: open this parent's conversation first (from the Parents page).
// onRead: called after a conversation is opened, so the menu badge can update.

import { useEffect, useMemo, useState } from 'react';
import { getClasses, getMessageThread, getMessageThreads, getParents, sendMessage } from '../api';
import Conversation from './Conversation.jsx';
import { formatDateTime } from '../utils';

const NEW = 'new';

function childrenText(children) {
  return children.length ? children.map((c) => `${c.name} (${c.className})`).join(', ') : 'No children linked';
}

export default function Messages({ initialParentId, onRead }) {
  const [threads, setThreads] = useState([]);
  const [parents, setParents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selected, setSelected] = useState(initialParentId || null); // a parent id, NEW or null
  const [thread, setThread] = useState(null); // { parent, messages }
  const [error, setError] = useState('');

  function loadThreads() {
    return getMessageThreads()
      .then(setThreads)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadThreads();
    Promise.all([getParents(), getClasses()])
      .then(([parentList, classList]) => {
        setParents(parentList);
        setClasses(classList);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    setThread(null);
    if (!selected || selected === NEW) return;
    getMessageThread(selected)
      .then((data) => {
        setThread(data);
        loadThreads(); // its unread count is now 0
        onRead?.();
      })
      .catch((err) => setError(err.message));
  }, [selected]);

  async function handleReply(body) {
    const { messages } = await sendMessage([selected], body);
    setThread({ ...thread, messages: [...thread.messages, ...messages] });
    loadThreads();
  }

  async function handleSendNew(parentIds, body) {
    const res = await sendMessage(parentIds, body);
    await loadThreads();
    if (parentIds.length === 1) setSelected(parentIds[0]);
    return res.sentCount;
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Messages</h1>
          <p className="subtitle">Conversations with parents. Every admin sees the same conversations.</p>
        </div>
        <div className="actions">
          <button type="button" className="secondary" onClick={loadThreads}>
            Refresh
          </button>
          <button type="button" onClick={() => setSelected(NEW)}>
            New message
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="inbox">
        <nav className="thread-list panel" aria-label="Conversations">
          {threads.length === 0 && <p className="note">No conversations yet. Use “New message” to write to parents.</p>}
          {threads.map((t) => (
            <button
              key={t.parentId}
              type="button"
              className={t.parentId === selected ? 'thread active' : 'thread'}
              onClick={() => setSelected(t.parentId)}
            >
              <span className="thread-top">
                <span className="cell-main">{t.parentName}</span>
                {t.unreadCount > 0 && <span className="nav-badge">{t.unreadCount}</span>}
              </span>
              <span className="cell-sub">{childrenText(t.children)}</span>
              <span className={t.unreadCount > 0 ? 'thread-preview unread' : 'thread-preview'}>
                {t.lastMessage.fromSchool ? 'You: ' : ''}
                {t.lastMessage.body}
              </span>
              <span className="cell-sub">{formatDateTime(t.lastMessage.createdAt)}</span>
            </button>
          ))}
        </nav>

        <section className="thread-view panel">
          {!selected && <p className="note">Choose a conversation, or start a new message.</p>}
          {selected === NEW && <NewMessage parents={parents} classes={classes} onSend={handleSendNew} />}
          {thread && (
            <>
              <div className="panel-head">
                <div>
                  <h2>{thread.parent.name}</h2>
                  <p className="cell-sub">{childrenText(thread.parent.children)}</p>
                </div>
                {thread.parent.disabled && <span className="badge muted">Account disabled</span>}
              </div>
              <Conversation
                messages={thread.messages}
                viewerIsSchool
                onSend={handleReply}
                placeholder={`Write to ${thread.parent.name}…`}
                emptyText="No messages yet. Write the first one below."
              />
            </>
          )}
        </section>
      </div>
    </>
  );
}

// Choose who gets the message, then write it.
function NewMessage({ parents, classes, onSend }) {
  const [audience, setAudience] = useState('choose'); // all | class | choose
  const [classId, setClassId] = useState('');
  const [chosen, setChosen] = useState([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const active = parents.filter((p) => !p.disabled);
  const recipients = useMemo(() => {
    if (audience === 'all') return active.map((p) => p.id);
    if (audience === 'class') {
      return active.filter((p) => p.children.some((c) => c.classId === classId)).map((p) => p.id);
    }
    return chosen;
  }, [audience, classId, chosen, parents]);

  function toggle(id, on) {
    setChosen(on ? [...chosen, id] : chosen.filter((x) => x !== id));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (recipients.length === 0) {
      setError('Please choose at least one parent.');
      return;
    }
    setSending(true);
    try {
      const count = await onSend(recipients, body);
      setBody('');
      setChosen([]);
      setMessage(`Sent to ${count} parent${count === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>New message</h2>
      <div className="form-grid">
        <label>
          Send to
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="choose">Chosen parents</option>
            <option value="class">Parents of a class</option>
            <option value="all">All parents</option>
          </select>
        </label>
        {audience === 'class' && (
          <label>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">Choose a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {audience === 'choose' && (
        <fieldset className="class-picker">
          <legend>Parents</legend>
          {active.length === 0 && <p className="note">No parent accounts yet. Add them on the Parents page.</p>}
          <div className="class-options">
            {active.map((p) => (
              <label key={p.id} className="check-label">
                <input type="checkbox" checked={chosen.includes(p.id)} onChange={(e) => toggle(p.id, e.target.checked)} />
                <span>
                  {p.name}
                  <span className="cell-sub"> · {p.children.map((c) => c.name).join(', ') || '—'}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="message-field">
        Message
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} required />
      </label>
      <p className="note">
        {recipients.length} parent{recipients.length === 1 ? '' : 's'} will get this message, each in their own
        conversation. Disabled accounts are left out.
      </p>
      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="actions">
        <button type="submit" disabled={sending || !body.trim()}>
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
