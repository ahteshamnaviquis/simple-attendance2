// The dashboard's "not submitted yet" panel: how many classes have reported
// for the day (with a progress bar), and a card for each class still missing,
// with its class teacher. Long lists start short (Show all) and can be
// searched by class or teacher.
//
// missing: classes without a report ({ id, name, teacherName }).
// total: number of classes. showTeachers: admins see who teaches each class.
// isToday: the chosen day is today (changes the wording).
// action: { label, onClick } for the button in the header.

import { useState } from 'react';
import Icon from './Icon.jsx';

const FIRST = 8;

function initials(name) {
  return name
    .split(/\s+/)
    .filter((w) => /^[a-z]/i.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export default function PendingClasses({ missing, total, showTeachers, isToday, action }) {
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');

  const reported = total - missing.length;
  const percent = total ? Math.round((reported / total) * 100) : 0;
  const words = search.trim().toLowerCase();
  const found = words
    ? missing.filter((c) => `${c.name} ${c.teacherName ?? ''}`.toLowerCase().includes(words))
    : missing;
  const shown = showAll || words ? found : found.slice(0, FIRST);
  const noTeacher = missing.filter((c) => !c.teacherName).length;

  const title =
    reported === 0
      ? `No class has submitted attendance${isToday ? ' yet' : ''}`
      : `${missing.length} ${missing.length === 1 ? 'class' : 'classes'} still to submit`;

  return (
    <section className="pending" aria-labelledby="pending-title">
      <header className="pending-head">
        <span className="pending-icon" aria-hidden="true">
          <Icon name="clock" size={20} strokeWidth={2.2} />
        </span>
        <div className="pending-heading">
          <h2 id="pending-title">{title}</h2>
          <p>
            {reported} of {total} {total === 1 ? 'class' : 'classes'} reported {isToday ? 'today' : 'that day'}
            {showTeachers && noTeacher > 0 && (
              <span className="pending-flag">
                {' '}
                · {noTeacher} without a class teacher
              </span>
            )}
          </p>
        </div>
        <div className="pending-progress" title={`${percent}% reported`}>
          <div className="pending-bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <span className="pending-percent">{percent}%</span>
        </div>
        {action && (
          <button className="small pending-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </header>

      {missing.length > FIRST && (
        <label className="pending-search">
          <span className="sr-only">Find a class{showTeachers ? ' or teacher' : ''}</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={showTeachers ? 'Find a class or teacher' : 'Find a class'}
          />
        </label>
      )}

      {found.length === 0 ? (
        <p className="pending-empty">No class matches “{search}”.</p>
      ) : (
        <ul className="pending-grid">
          {shown.map((c) => (
            <li key={c.id} className="pending-item">
              {showTeachers && (
                <span className={c.teacherName ? 'pending-avatar' : 'pending-avatar none'} aria-hidden="true">
                  {c.teacherName ? initials(c.teacherName) : '?'}
                </span>
              )}
              <span className="pending-text">
                <span className="pending-class">{c.name}</span>
                {showTeachers && (
                  <span className={c.teacherName ? 'pending-teacher' : 'pending-teacher none'}>
                    {c.teacherName || 'No class teacher'}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!words && found.length > FIRST && (
        <button type="button" className="pending-more" onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
          {showAll ? 'Show fewer' : `Show all ${found.length} classes`}
          <Icon name="next" size={14} strokeWidth={2.4} />
        </button>
      )}
    </section>
  );
}
