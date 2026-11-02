// A parent's messages: one private chat with the school office (the admins)
// and one with each of their children's teachers. The list says who everyone
// is (class teacher, which subject, for which son or daughter); the chat
// header repeats it, so it is always clear who the parent is writing to.
//
// With more than one child, tabs show one child's teachers at a time (the
// school office is always there). Teachers with unread messages come first,
// and the open chat refreshes itself, so new messages are read straight away.

import { useEffect, useRef, useState } from 'react';
import { getMessageContacts, getMyMessages, sendMyMessage } from '../../api';
import { Avatar, ChatHeader, ChatShell, ContactItem, Conversation } from '../../components/Chat.jsx';
import { childLabel, childWord } from '../../utils';

const REFRESH_MS = 10000;

// ["Class teacher", "English"] -> "Class teacher and English"
function joinRoles(roles) {
  return roles.length > 1 ? `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}` : roles[0] ?? '';
}

// What a teacher teaches, for the chosen child or all of them.
function teachesFor(contact, childId) {
  return childId ? contact.teaches.filter((t) => t.studentId === childId) : contact.teaches;
}

function contactLook(contact) {
  return contact.kind === 'school'
    ? { tone: 'school', icon: 'school', chip: 'Admin team' }
    : { tone: 'teacher', icon: null, chip: 'Teacher' };
}

// childList: the parent's children (from ParentHome), for the tabs.
export default function ParentMessages({ childList = [], onRead }) {
  const [contacts, setContacts] = useState(null);
  const [childId, setChildId] = useState(''); // '' = all children
  const [selected, setSelected] = useState(null); // 'school' or a teacher id
  const [thread, setThread] = useState(null); // { contact, messages }
  const [error, setError] = useState('');
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  function loadContacts() {
    return getMessageContacts()
      .then(setContacts)
      .catch((err) => setError(err.message));
  }

  // Fetch the open chat (which marks the other side's messages read).
  function loadThread(key) {
    return getMyMessages(key).then((data) => {
      if (selectedRef.current !== key) return; // the parent opened another chat meanwhile
      setThread(data);
      loadContacts();
      onRead();
    });
  }

  useEffect(() => {
    loadContacts();
    const timer = setInterval(() => {
      if (selectedRef.current) loadThread(selectedRef.current).catch(() => {});
      else loadContacts();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setThread(null);
    if (selected) loadThread(selected).catch((err) => setError(err.message));
  }, [selected]);

  async function handleSend(body) {
    const sent = await sendMyMessage(selected, body);
    setThread({ ...thread, messages: [...thread.messages, sent] });
    loadContacts();
  }

  const school = contacts?.find((c) => c.kind === 'school');
  const teachers = (contacts ?? []).filter((c) => c.kind === 'teacher' && (!childId || teachesFor(c, childId).length));
  const unreadTotal = (contacts ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
  const firstUnread = (contacts ?? []).find((c) => c.unreadCount > 0);
  const chosenChild = childList.find((c) => c.studentId === childId);

  function item(contact) {
    const look = contactLook(contact);
    const teaches = teachesFor(contact, childId);
    return (
      <ContactItem
        key={contact.id}
        name={contact.name}
        tone={look.tone}
        icon={look.icon}
        chip={look.chip}
        subtitle={
          contact.kind === 'school'
            ? 'Admissions, fees, general questions'
            : contact.canWrite
              ? teaches.map((t) => `${joinRoles(t.roles)} · ${t.studentName.split(' ')[0]} (${childWord(t.gender).toLowerCase()})`).join(' / ')
              : 'No longer teaches your children'
        }
        lastMessage={contact.lastMessage}
        unread={contact.unreadCount}
        active={contact.id === selected}
        muted={!contact.canWrite}
        viewerIsStaff={false}
        onClick={() => setSelected(contact.id)}
      />
    );
  }

  const list = contacts && (
    <>
      {childList.length > 1 && (
        <div className="chat-child-tabs" role="tablist" aria-label="Show teachers of">
          <button
            type="button"
            role="tab"
            aria-selected={!childId}
            className={!childId ? 'pill selected' : 'pill'}
            onClick={() => setChildId('')}
          >
            All children
          </button>
          {childList.map((c) => (
            <button
              key={c.studentId}
              type="button"
              role="tab"
              aria-selected={childId === c.studentId}
              className={childId === c.studentId ? 'pill selected' : 'pill'}
              onClick={() => setChildId(c.studentId)}
              title={childLabel(c)}
            >
              {c.name.split(' ')[0]}
              <span className="pill-sub">{childWord(c.gender)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="chat-group-label">School</p>
      {school && item(school)}
      <p className="chat-group-label">
        {chosenChild ? `${chosenChild.name}'s teachers · ${childWord(chosenChild.gender)}, ${chosenChild.className}` : "Your children's teachers"}
      </p>
      {teachers.length === 0 && <p className="chat-list-empty cell-sub">No teachers are assigned yet.</p>}
      {teachers.map(item)}
    </>
  );

  let header = null;
  if (thread) {
    const { contact } = thread;
    const look = contactLook(contact);
    const lines = teachesFor(contact, childId).length ? teachesFor(contact, childId) : contact.teaches;
    header = (
      <ChatHeader
        name={contact.name}
        tone={look.tone}
        icon={look.icon}
        chip={look.chip}
        details={
          contact.kind === 'school'
            ? ['Every school admin can read and answer this chat.']
            : lines.length
              ? lines.map(
                  (t) => `${joinRoles(t.roles)} for your ${childWord(t.gender).toLowerCase()} ${t.studentName} (${t.className})`
                )
              : ['No longer teaches your children']
        }
        note={
          contact.kind === 'school'
            ? 'Private chat between you and the school office (admins).'
            : `Private chat between you and ${contact.name} (teacher). The school office does not see it.`
        }
      />
    );
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Messages</h1>
          <p className="subtitle">Talk to the school office or to any of your children's teachers</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <ChatShell
        title="Chats"
        subtitle={
          firstUnread ? (
            <button type="button" className="unread-link" onClick={() => setSelected(firstUnread.id)}>
              {unreadTotal} unread · open {firstUnread.name}
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
            <h2>Who would you like to talk to?</h2>
            <p className="cell-sub">
              Choose the school office for general questions, or a teacher about a subject or your child's class.
            </p>
            {school && (
              <button type="button" onClick={() => setSelected('school')}>
                Message the school office
              </button>
            )}
          </div>
        )}
        {thread && (
          <>
            {header}
            <Conversation
              messages={thread.messages}
              viewerIsStaff={false}
              onSend={handleSend}
              placeholder={`Write to ${thread.contact.name}…`}
              emptyText={`Start a conversation with ${thread.contact.name}. They usually reply within a school day.`}
              cannotWrite={
                thread.contact.canWrite ? null : `${thread.contact.name} no longer teaches your children, so you can't send new messages here.`
              }
            />
          </>
        )}
      </ChatShell>
    </>
  );
}
