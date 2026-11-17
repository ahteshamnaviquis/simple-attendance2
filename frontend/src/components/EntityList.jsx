// The list used on the management pages (teachers, parents, admins, students,
// classes, subjects): a short list on the left and, on the right, everything
// about the chosen row with its buttons. On phones the list comes first;
// choosing a row opens its details with a back button.
//
//   <EntityList summary="32 teachers · 2 disabled" empty="No teachers yet." noun="teacher">
//     <EntityRow
//       key={t.id}
//       media={size => <Avatar … size={size} />}  picture or icon (given a size)
//       title="Sara Khan"
//       subtitle="English, Mathematics"            one line under the name in the list
//       status={<Status active />}                 optional, shown in the panel
//       facts={[{ label: 'Username', value: … }]}  the panel's details (empty values are left out)
//       actions={[{ label, icon, onClick, danger, scrollTop }]}  scrollTop: go up to the form
//       muted                                      a disabled account (shown faded)
//     />
//   </EntityList>
//
// EntityRow only carries the data: EntityList draws the list and the panel.

import { Children, isValidElement, useState } from 'react';
import Icon from './Icon.jsx';

export function EntityRow() {
  return null;
}

export function EntityList({ summary, empty, noun = 'item', children }) {
  const rows = Children.toArray(children).filter(isValidElement);
  const [selectedKey, setSelectedKey] = useState(null);
  const [showDetail, setShowDetail] = useState(false); // phones: the panel instead of the list

  const selected = rows.find((r) => r.key === selectedKey) ?? rows[0];

  function choose(key) {
    setSelectedKey(key);
    setShowDetail(true);
  }

  return (
    <section className={showDetail ? 'entity-md show-detail' : 'entity-md'}>
      <div className="entity-side">
        {summary && <div className="entity-summary">{summary}</div>}
        {rows.length === 0 ? (
          <p className="entity-empty">{empty}</p>
        ) : (
          <ul className="entity-items">
            {rows.map((row) => {
              const p = row.props;
              const active = row === selected;
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    className={`entity-item${active ? ' is-active' : ''}${p.muted ? ' is-muted' : ''}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => choose(row.key)}
                  >
                    {p.media?.(36)}
                    <span className="entity-item-text">
                      <span className="entity-item-title">{p.title}</span>
                      {p.subtitle && <span className="entity-item-sub">{p.subtitle}</span>}
                    </span>
                    {p.muted && <span className="entity-item-flag">Disabled</span>}
                    <Icon name="next" size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="entity-panel" aria-live="polite">
        {selected ? (
          <Panel row={selected.props} onBack={() => setShowDetail(false)} />
        ) : (
          <p className="entity-empty">Choose a {noun} to see the details.</p>
        )}
      </div>
    </section>
  );
}

function Panel({ row, onBack }) {
  const facts = (row.facts ?? []).filter(
    (f) => f && f.value !== undefined && f.value !== null && f.value !== '' && f.value !== false
  );
  return (
    <div className="entity-panel-inner">
      <button type="button" className="entity-back" onClick={onBack}>
        <Icon name="prev" size={16} /> Back to the list
      </button>
      <div className="entity-panel-head">
        {row.media?.(56)}
        <div className="entity-panel-name">
          <h2>{row.title}</h2>
          {row.subtitle && <p>{row.subtitle}</p>}
        </div>
        {row.status}
      </div>

      {facts.length > 0 && (
        <dl className="entity-facts">
          {facts.map((f) => (
            <div key={f.label} className="entity-fact">
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {row.actions?.length > 0 && (
        <div className="entity-panel-actions">
          {row.actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'secondary entity-danger' : 'secondary'}
              onClick={() => {
                a.onClick();
                // The edit form is above the list.
                if (a.scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {a.icon && <Icon name={a.icon} size={16} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Active / Disabled with a coloured dot.
export function Status({ active, on = 'Active', off = 'Disabled' }) {
  return <span className={active ? 'status-dot on' : 'status-dot off'}>{active ? on : off}</span>;
}

// A small rounded label (a class, a subject, a child…). tone: '', 'accent',
// 'boy', 'girl', 'muted'.
export function Chip({ tone = '', children, title }) {
  return (
    <span className={tone ? `chip chip-${tone}` : 'chip'} title={title}>
      {children}
    </span>
  );
}

// A line with an icon in front (phone, email…).
export function Detail({ icon, children }) {
  return (
    <span className="entity-detail">
      <Icon name={icon} size={14} />
      <span>{children}</span>
    </span>
  );
}

// A username shown as a code-like handle.
export function Handle({ children }) {
  return <span className="handle">{children}</span>;
}

// A square tile with an icon, for things that are not people (classes, subjects).
export function IconTile({ icon, size = 38 }) {
  return (
    <span className="icon-tile" aria-hidden="true" style={{ width: size, height: size }}>
      <Icon name={icon} size={Math.round(size / 2)} />
    </span>
  );
}
