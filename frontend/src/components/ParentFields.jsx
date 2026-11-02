// The fields of one parent: relation, name, contacts and their portal login.
// Used on the student form (where parents are added) and the Parents page.

import Icon from './Icon.jsx';

// Keep in step with RELATIONS in backend/parentAccounts.js.
export const RELATIONS = ['Father', 'Mother', 'Guardian', 'Grandparent', 'Brother', 'Sister', 'Uncle', 'Aunt', 'Other'];
const MAIN_RELATIONS = ['Father', 'Mother', 'Guardian'];

export const EMPTY_PARENT = {
  name: '',
  relation: '',
  phone: '',
  altPhone: '',
  email: '',
  cnic: '',
  occupation: '',
  address: '',
  username: '',
  password: '',
};

// The details of a saved parent, ready for the form (password blank = keep).
export function parentToForm(parent) {
  const form = { ...EMPTY_PARENT };
  for (const key of Object.keys(EMPTY_PARENT)) form[key] = parent[key] ?? '';
  form.password = '';
  return form;
}

// "Noor Khan" -> "noor.khan": a starting username the admin can change.
export function suggestUsername(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 30);
}

// An easy-to-read password: no 0/O or 1/l/I.
export function generatePassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const pick = (set) => set[Math.floor(Math.random() * set.length)];
  return Array.from({ length: 5 }, () => pick(letters)).join('') + Array.from({ length: 3 }, () => pick(digits)).join('');
}

export function initials(name) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('') || '?'
  );
}

// value: the parent's fields. onChange(newValue). isNew: the password is required.
// usernameTouched: false = the username follows the name until the admin edits it.
export default function ParentFields({ value, onChange, isNew, idPrefix }) {
  function set(field, fieldValue) {
    const next = { ...value, [field]: fieldValue };
    if (field === 'name' && isNew && !value.usernameEdited) next.username = suggestUsername(fieldValue);
    if (field === 'username') next.usernameEdited = true;
    onChange(next);
  }

  const field = (name) => ({
    id: `${idPrefix}-${name}`,
    value: value[name],
    onChange: (e) => set(name, e.target.value),
  });

  const otherRelation = value.relation && !MAIN_RELATIONS.includes(value.relation);

  return (
    <div className="parent-fields">
      <div className="relation-row" role="radiogroup" aria-label="Relation to the student">
        <span className="field-label">Relation to the student</span>
        <div className="relation-pills">
          {MAIN_RELATIONS.map((relation) => (
            <button
              key={relation}
              type="button"
              role="radio"
              aria-checked={value.relation === relation}
              className={value.relation === relation ? 'pill selected' : 'pill'}
              onClick={() => set('relation', relation)}
            >
              {relation}
            </button>
          ))}
          <select
            aria-label="Other relation"
            className={otherRelation ? 'pill-select selected' : 'pill-select'}
            value={otherRelation ? value.relation : ''}
            onChange={(e) => set('relation', e.target.value)}
          >
            <option value="">Other…</option>
            {RELATIONS.filter((r) => !MAIN_RELATIONS.includes(r)).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-grid">
        <label className="span-2">
          Full name <span className="required">*</span>
          <input {...field('name')} required placeholder="e.g. Noor Khan" autoComplete="off" />
        </label>
        <label>
          Phone <span className="required">*</span>
          <input {...field('phone')} type="tel" required placeholder="0300-1234567" autoComplete="off" />
        </label>
        <label>
          Other phone
          <input {...field('altPhone')} type="tel" placeholder="Optional" autoComplete="off" />
        </label>
        <label>
          Email
          <input {...field('email')} type="email" placeholder="Optional" autoComplete="off" />
        </label>
        <label>
          CNIC
          <input {...field('cnic')} placeholder="35202-1234567-1" autoComplete="off" />
        </label>
        <label>
          Occupation
          <input {...field('occupation')} placeholder="Optional" autoComplete="off" />
        </label>
        <label className="span-full">
          Home address
          <input {...field('address')} placeholder="Optional" autoComplete="off" />
        </label>
      </div>

      <div className="login-box">
        <div className="login-box-head">
          <Icon name="admins" size={18} />
          <div>
            <strong>Parent portal login</strong>
            <span className="cell-sub">
              {isNew
                ? ' Share these with the parent so they can follow attendance and results.'
                : ' Leave the password blank to keep the current one.'}
            </span>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Username <span className="required">*</span>
            <input {...field('username')} required autoComplete="off" />
          </label>
          <label>
            Password {isNew && <span className="required">*</span>}
            <span className="input-with-button">
              <input
                {...field('password')}
                required={isNew}
                autoComplete="new-password"
                placeholder={isNew ? '' : 'Keep current'}
              />
              <button type="button" className="secondary small" onClick={() => set('password', generatePassword())}>
                Generate
              </button>
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
