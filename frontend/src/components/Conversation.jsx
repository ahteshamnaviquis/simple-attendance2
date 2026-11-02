// One conversation between the school and a parent: the messages, oldest
// first, and a box to write a reply. Used by both sides:
//   viewerIsSchool = true  -> the school's messages are "mine" (on the right)
//   viewerIsSchool = false -> the parent's messages are "mine"

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { formatDateTime } from '../utils';

const MAX_LENGTH = 2000;

export default function Conversation({ messages, viewerIsSchool, onSend, placeholder, emptyText }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef(null);

  // Show the newest message.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!text.trim()) return;
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

  return (
    <div className="conversation">
      <div className="message-list" aria-live="polite">
        {messages.length === 0 && <p className="note center">{emptyText || 'No messages yet.'}</p>}
        {messages.map((m) => {
          const mine = m.fromSchool === viewerIsSchool;
          return (
            <div key={m.id} className={mine ? 'message mine' : 'message'}>
              <div className="message-bubble">{m.body}</div>
              <div className="message-meta">
                {m.fromSchool ? `${m.senderName} · School` : m.senderName} · {formatDateTime(m.createdAt)}
                {mine && m.readAt && <span title={`Read ${formatDateTime(m.readAt)}`}> · Read</span>}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

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
          rows={2}
        />
        <button type="submit" disabled={sending || !text.trim()}>
          <span className="rate-cell">
            <Icon name="send" />
            {sending ? 'Sending…' : 'Send'}
          </span>
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
