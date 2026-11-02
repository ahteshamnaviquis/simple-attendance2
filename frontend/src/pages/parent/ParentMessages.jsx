// A parent's messages: one private chat with the school office (the admins)
// and one with each of their children's teachers. The list says who everyone
// is (class teacher, which subject, for which child); the chat header repeats
// it, so it is always clear who the parent is writing to.

import { useEffect, useState } from 'react';
import { getMessageContacts, getMyMessages, sendMyMessage } from '../../api';
import { Avatar, ChatHeader, ChatShell, ContactItem, Conversation } from '../../components/Chat.jsx';

// ["Class teacher", "English"] -> "Class teacher and English"
function joinRoles(roles) {
  return roles.length > 1 ? `${roles.slice(0, -1).join(', ')} and ${roles[roles.length - 1]}` : roles[0] ?? '';
}

// What a teacher teaches each child, one line per child.
function teachesLines(contact) {
  return contact.teaches.map((t) => `${joinRoles(t.roles)} for ${t.studentName} (${t.className})`);
}

function contactLook(contact) {
  return contact.kind === 'school'
    ? { tone: 'school', icon: 'school', chip: 'Admin team' }
    : { tone: 'teacher', icon: null, chip: 'Teacher' };
}

export default function ParentMessages({ onRead }) {
  const [contacts, setContacts] = useState(null);
  const [selected, setSelected] = useState(null); // 'school' or a teacher id
  const [thread, setThread] = useState(null); // { contact, messages }
  const [error, setError] = useState('');

  function loadContacts() {
    return getMessageContacts()
      .then(setContacts)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadContacts();
    const timer = setInterval(loadContacts, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setThread(null);
    if (!selected) return;
    getMyMessages(selected)
      .then((data) => {
        setThread(data);
        loadContacts();
        onRead();
      })
      .catch((err) => setError(err.message));
  }, [selected]);

  async function handleSend(body) {
    const sent = await sendMyMessage(selected, body);
    setThread({ ...thread, messages: [...thread.messages, sent] });
    loadContacts();
  }

  const school = contacts?.find((c) => c.kind === 'school');
  const teachers = contacts?.filter((c) => c.kind === 'teacher') ?? [];
  const unreadTotal = (contacts ?? []).reduce((sum, c) => sum + c.unreadCount, 0);

  function item(contact) {
    const look = contactLook(contact);
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
              ? contact.teaches.map((t) => `${joinRoles(t.roles)} · ${t.studentName}`).join(' / ')
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
      <p className="chat-group-label">School</p>
      {school && item(school)}
      <p className="chat-group-label">Your children's teachers</p>
      {teachers.length === 0 && <p className="chat-list-empty cell-sub">No teachers are assigned to your children yet.</p>}
      {teachers.map(item)}
    </>
  );

  let header = null;
  if (thread) {
    const { contact } = thread;
    const look = contactLook(contact);
    header = (
      <ChatHeader
        name={contact.name}
        tone={look.tone}
        icon={look.icon}
        chip={look.chip}
        details={
          contact.kind === 'school'
            ? ['Every school admin can read and answer this chat.']
            : teachesLines(contact).length
              ? teachesLines(contact)
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
        subtitle={unreadTotal ? `${unreadTotal} unread` : 'All caught up'}
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
