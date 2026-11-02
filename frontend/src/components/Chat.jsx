// The chat screen shared by parents, teachers and admins:
//   ChatShell    - contact list on the left, the open conversation on the right
//                  (on a phone, one at a time with a Back button)
//   ContactItem  - one person in the list, with last message and unread count
//   ChatHeader   - who the conversation is with: name, role chip and details
//   Conversation - the messages (grouped by day, with read ticks) and the reply box
//
// Who is who: "staff" messages (fromSchool) come from an admin or a teacher,
// the others from the parent. viewerIsStaff decides which side is "mine".

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { getSavedUser } from '../session';
import { formatMediumDate, localDateOf, todayString, addDays } from '../utils';

const MAX_LENGTH = 2000;

export const ROLE_LABELS = { admin: 'Admin', superadmin: 'Super admin', teacher: 'Teacher', parent: 'Parent' };

// Avatar colors: the school office, teachers and parents each have their own.
export function Avatar({ name, tone = 'school', icon, size = 'md' }) {
  const letters = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
  return (
    <span className={`chat-avatar ${tone} ${size}`} aria-hidden="true">
      {icon ? <Icon name={icon} size={size === 'lg' ? 22 : 18} /> : letters || '?'}
    </span>
  );
}

export function RoleChip({ tone, children }) {
  return <span className={`role-chip ${tone}`}>{children}</span>;
}

// "14:05" today, "Yesterday", or "12 Oct 2026".
function shortWhen(iso) {
  const day = localDateOf(iso);
  if (day === todayString()) return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (day === addDays(todayString(), -1)) return 'Yesterday';
  return formatMediumDate(day);
}

function dayLabel(day) {
  if (day === todayString()) return 'Today';
  if (day === addDays(todayString(), -1)) return 'Yesterday';
  return formatMediumDate(day);
}

export function ChatShell({ title, subtitle, list, active, onBack, children, listActions }) {
  return (
    <div className={active ? 'chat-shell has-active' : 'chat-shell'}>
      <aside className="chat-list" aria-label="Conversations">
        <div className="chat-list-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <p className="cell-sub">{subtitle}</p>}
          </div>
          {listActions}
        </div>
        <div className="chat-list-body">{list}</div>
      </aside>
      <section className="chat-pane">
        {active && onBack && (
          <button type="button" className="chat-back secondary small" onClick={onBack}>
            <Icon name="prev" size={16} /> All conversations
          </button>
        )}
        {children}
      </section>
    </div>
  );
}

export function ContactItem({ name, tone, icon, chip, subtitle, lastMessage, unread, active, muted, onClick, viewerIsStaff }) {
  const fromMe = lastMessage && lastMessage.fromSchool === viewerIsStaff;
  return (
    <button type="button" className={`contact${active ? ' active' : ''}${muted ? ' muted' : ''}`} onClick={onClick}>
      <Avatar name={name} tone={tone} icon={icon} />
      <span className="contact-text">
        <span className="contact-top">
          <span className="contact-name">{name}</span>
          {lastMessage && <span className="contact-time">{shortWhen(lastMessage.createdAt)}</span>}
        </span>
        <span className="contact-sub">
          {chip && <RoleChip tone={tone}>{chip}</RoleChip>}
          {subtitle && <span className="contact-detail">{subtitle}</span>}
        </span>
        <span className="contact-bottom">
          <span className={unread ? 'contact-preview unread' : 'contact-preview'}>
            {lastMessage ? `${fromMe ? 'You: ' : ''}${lastMessage.body}` : 'No messages yet — say hello'}
          </span>
          {unread > 0 && <span className="nav-badge">{unread}</span>}
        </span>
      </span>
    </button>
  );
}

// title: the other person. chip: their role. details: lines of who they are.
// note: the "who this chat is between" line.
export function ChatHeader({ name, tone, icon, chip, details = [], note, aside }) {
  return (
    <header className="chat-header">
      <Avatar name={name} tone={tone} icon={icon} size="lg" />
      <div className="chat-header-text">
        <div className="chat-header-title">
          <h2>{name}</h2>
          {chip && <RoleChip tone={tone}>{chip}</RoleChip>}
        </div>
        {details.map((line) => (
          <p key={line} className="cell-sub">
            {line}
          </p>
        ))}
      </div>
      {aside}
      {note && (
        <p className="chat-note">
          <Icon name="messages" size={15} /> {note}
        </p>
      )}
    </header>
  );
}

// messages: oldest first. onSend(body) returns a promise. cannotWrite: a
// reason shown instead of the reply box. otherTone: color of the other side.
export function Conversation({ messages, viewerIsStaff, onSend, placeholder, emptyText, cannotWrite }) {
  const me = getSavedUser()?.id;
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      await onSend(text);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  // Enter sends, Shift+Enter starts a new line.
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) handleSubmit(event);
  }

  let lastDay = null;
  let lastSender = null;

  return (
    <div className="conversation">
      <div className="message-list" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">
              <Icon name="messages" size={28} />
            </span>
            <p>{emptyText || 'No messages yet.'}</p>
          </div>
        )}
        {messages.map((m) => {
          const day = localDateOf(m.createdAt);
          const showDay = day !== lastDay;
          const showSender = showDay || m.senderId !== lastSender;
          lastDay = day;
          lastSender = m.senderId;

          const mine = m.fromSchool === viewerIsStaff;
          const tone = m.senderRole === 'teacher' ? 'teacher' : m.fromSchool ? 'school' : 'parent';
          const who = m.senderId === me ? 'You' : m.senderName;
          return (
            <div key={m.id} className="message-block">
              {showDay && (
                <div className="day-separator">
                  <span>{dayLabel(day)}</span>
                </div>
              )}
              <div className={mine ? 'message mine' : 'message'}>
                {showSender && (
                  <div className="message-sender">
                    {who}
                    {m.senderRole && m.senderId !== me && <RoleChip tone={tone}>{ROLE_LABELS[m.senderRole] ?? m.senderRole}</RoleChip>}
                  </div>
                )}
                <div className={`message-bubble ${tone}`}>
                  {m.body}
                  <span className="message-time">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {mine && (
                      <span className={m.readAt ? 'ticks read' : 'ticks'} title={m.readAt ? 'Read' : 'Sent'}>
                        {m.readAt ? '✓✓' : '✓'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {cannotWrite ? (
        <p className="chat-closed">{cannotWrite}</p>
      ) : (
        <form className="composer" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="message-text">
            Message
          </label>
          <textarea
            id="message-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Write a message…'}
            maxLength={MAX_LENGTH}
            rows={1}
          />
          <button type="submit" className="send-button" disabled={sending || !text.trim()} aria-label="Send">
            <Icon name="send" size={20} />
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      {!cannotWrite && <p className="composer-hint">Enter to send · Shift+Enter for a new line</p>}
    </div>
  );
}
