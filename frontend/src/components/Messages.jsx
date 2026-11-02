// Messages with parents, for staff.
//   Admins and the super admin: the school office conversations, shared by all of them.
//   Teachers: their own conversations with the parents of the students they teach.
// The list shows each conversation (newest first, unread marked); "New message"
// writes to one parent, the parents of a class, or all parents, each in their
// own private conversation.
//
// initialParentId: open this parent's conversation first (from the Parents page).
// onRead: called after a conversation is opened, so the menu badge can update.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getMessageRecipients, getMessageThread, getMessageThreads, sendMessage } from '../api';
import { getSavedUser } from '../session';
import Icon from './Icon.jsx';
import { Avatar, ChatHeader, ChatShell, ContactItem, Conversation } from './Chat.jsx';
import { childLabel } from '../utils';

const NEW = 'new';

const REFRESH_MS = 10000;

function childrenLine(children) {
  return children.length ? children.map((c) => childLabel(c)).join(', ') : 'No children linked';
}

export default function Messages({ initialParentId, onRead }) {
  const user = getSavedUser();
  const isTeacher = user?.role === 'teacher';
  const [threads, setThreads] = useState(null);
  const [recipients, setRecipients] = useState([]);
  const [selected, setSelected] = useState(initialParentId || null); // a parent id, NEW or null
  const [thread, setThread] = useState(null); // { parent, messages }
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  // Fetch the open conversation (which marks the parent's messages read).
  function loadThread(parentId) {
    return getMessageThread(parentId).then((data) => {
      if (selectedRef.current !== parentId) return; // another conversation was opened meanwhile
      setThread(data);
      loadThreads(); // its unread count is now 0
      onRead?.();
    });
  }

  function loadThreads() {
    return getMessageThreads()
      .then(setThreads)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadThreads();
    getMessageRecipients()
      .then(setRecipients)
      .catch((err) => setError(err.message));
    // The open conversation refreshes itself, so new messages are read straight away.
    const timer = setInterval(() => {
      const open = selectedRef.current;
      if (open && open !== NEW) loadThread(open).catch(() => {});
      else loadThreads();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setThread(null);
    if (!selected || selected === NEW) return;
    loadThread(selected).catch((err) => setError(err.message));
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

  const text = search.trim().toLowerCase();
  const shownThreads = (threads ?? []).filter(
    (t) =>
      !text ||
      t.parentName.toLowerCase().includes(text) ||
      t.children.some((c) => c.name.toLowerCase().includes(text))
  );
  const unreadTotal = (threads ?? []).reduce((sum, t) => sum + t.unreadCount, 0);
  const firstUnread = (threads ?? []).find((t) => t.unreadCount > 0);
  const meLabel = isTeacher ? `you (${user.name}, teacher)` : 'the school office (all admins)';

  const list = (
    <>
      <label className="chat-search">
        <span className="sr-only">Search conversations</span>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search parent or child" />
      </label>
      {threads && threads.length === 0 && (
        <div className="chat-list-empty">
          <p>No conversations yet.</p>
          <p className="cell-sub">
            {isTeacher ? 'Parents of your students can write to you here.' : 'Parents can write to the school office here.'}
          </p>
        </div>
      )}
      {shownThreads.map((t) => (
        <ContactItem
          key={t.parentId}
          name={t.parentName}
          tone="parent"
          chip={t.relation || 'Parent'}
          subtitle={t.children.map((c) => childLabel(c, { withClass: false })).join(', ')}
          lastMessage={t.lastMessage}
          unread={t.unreadCount}
          active={t.parentId === selected}
          muted={t.disabled}
          viewerIsStaff
          onClick={() => setSelected(t.parentId)}
        />
      ))}
    </>
  );

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Messages</h1>
          <p className="subtitle">
            {isTeacher
              ? 'Your private conversations with the parents of your students'
              : 'The school office: conversations with parents, shared by every admin'}
          </p>
        </div>
        <div className="actions">
          <button type="button" onClick={() => setSelected(NEW)}>
            <span className="rate-cell">
              <Icon name="send" size={16} /> New message
            </span>
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <ChatShell
        title={isTeacher ? 'Parents' : 'School office inbox'}
        subtitle={
          firstUnread ? (
            <button type="button" className="unread-link" onClick={() => setSelected(firstUnread.parentId)}>
              {unreadTotal} unread · open {firstUnread.parentName}
            </button>
          ) : (
            'All caught up'
          )
        }
        list={list}
        active={Boolean(selected)}
        onBack={() => setSelected(null)}
      >
        {!selected && (
          <div className="chat-placeholder">
            <Avatar name="Messages" icon="messages" tone="school" size="lg" />
            <h2>Choose a conversation</h2>
            <p className="cell-sub">Or start a new message to one parent, a class's parents or everyone.</p>
          </div>
        )}
        {selected === NEW && (
          <NewMessage recipients={recipients} isTeacher={isTeacher} onSend={handleSendNew} />
        )}
        {thread && (
          <>
            <ChatHeader
              name={thread.parent.name}
              tone="parent"
              chip={thread.parent.relation ? `Parent · ${thread.parent.relation}` : 'Parent'}
              details={[
                `${isTeacher ? 'Your students' : 'Children'}: ${childrenLine(thread.parent.children)}`,
                thread.parent.phone ? `Phone: ${thread.parent.phone}` : null,
              ].filter(Boolean)}
              note={`Private chat between ${thread.parent.name} (parent) and ${meLabel}.`}
              aside={thread.parent.disabled && <span className="badge muted">Login disabled</span>}
            />
            <Conversation
              messages={thread.messages}
              viewerIsStaff
              onSend={handleReply}
              placeholder={`Write to ${thread.parent.name}…`}
              emptyText={`Start the conversation with ${thread.parent.name}.`}
            />
          </>
        )}
      </ChatShell>
    </>
  );
}

// Choose who gets the message, then write it.
function NewMessage({ recipients, isTeacher, onSend }) {
  const [audience, setAudience] = useState('choose'); // all | class | choose
  const [classId, setClassId] = useState('');
  const [chosen, setChosen] = useState([]);
  const [filter, setFilter] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const active = recipients.filter((p) => !p.disabled);
  const ids = useMemo(() => {
    if (audience === 'all') return active.map((p) => p.id);
    if (audience === 'class') return active.filter((p) => p.children.some((c) => c.classId === classId)).map((p) => p.id);
    return chosen;
  }, [audience, classId, chosen, recipients]);

  const filterText = filter.trim().toLowerCase();
  const pickable = active.filter(
    (p) =>
      !filterText ||
      p.name.toLowerCase().includes(filterText) ||
      p.children.some((c) => c.name.toLowerCase().includes(filterText))
  );
  // The classes of the recipients' children (for a teacher: the classes they teach).
  const classOptions = [
    ...new Map(active.flatMap((p) => p.children).map((c) => [c.classId, { id: c.classId, name: c.className }])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name));

  function toggle(id) {
    setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (ids.length === 0) {
      setError('Please choose at least one parent.');
      return;
    }
    setSending(true);
    try {
      const count = await onSend(ids, body);
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
    <form className="new-message" onSubmit={handleSubmit}>
      <ChatHeader
        name="New message"
        tone="school"
        icon="send"
        details={[
          isTeacher
            ? 'To the parents of your students. Each parent gets it in their own private chat with you.'
            : 'From the school office. Each parent gets it in their own private chat.',
        ]}
      />
      <div className="new-message-body">
        <div className="audience-tabs" role="radiogroup" aria-label="Send to">
          {[
            ['choose', 'Choose parents'],
            ['class', 'A class'],
            ['all', isTeacher ? 'All my parents' : 'All parents'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={audience === value}
              className={audience === value ? 'pill selected' : 'pill'}
              onClick={() => setAudience(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {audience === 'class' && (
          <label>
            Class
            <select value={classId} onChange={(e) => setClassId(e.target.value)} required>
              <option value="">Choose a class</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {audience === 'choose' && (
          <div className="recipient-picker">
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find a parent or child" />
            <div className="recipient-list">
              {pickable.length === 0 && <p className="note">No parents to show.</p>}
              {pickable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={chosen.includes(p.id) ? 'recipient selected' : 'recipient'}
                  aria-pressed={chosen.includes(p.id)}
                  onClick={() => toggle(p.id)}
                >
                  <Avatar name={p.name} tone="parent" size="sm" />
                  <span className="recipient-text">
                    <span className="cell-main">{p.name}</span>
                    <span className="cell-sub">
                      {p.relation && `${p.relation} of `}
                      {p.children.map((c) => childLabel(c, { withClass: false })).join(', ')}
                    </span>
                  </span>
                  <span className="recipient-check" aria-hidden="true">
                    {chosen.includes(p.id) && <Icon name="check" size={14} strokeWidth={3} />}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <label>
          Message
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} required placeholder="Write your message…" />
        </label>
        <p className="note">
          <strong>{ids.length}</strong> parent{ids.length === 1 ? '' : 's'} will get this message. Disabled logins are left out.
        </p>
        {error && <p className="error">{error}</p>}
        {message && <p className="success">{message}</p>}
        <div className="actions">
          <button type="submit" disabled={sending || !body.trim()}>
            <span className="rate-cell">
              <Icon name="send" size={16} />
              {sending ? 'Sending…' : 'Send message'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
