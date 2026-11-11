// A username box with the academy's prefix ("gvs.") fixed in front of it: only
// the part after the dot can be typed. The backend adds the prefix too, so it
// can't be left out or changed.
//
// value / onChange(newValue): the whole username ("gvs.sara"; '' when empty).
// prefix: the academy's prefix (default: the logged-in user's academy).
// saved: the account's saved username while it is unchanged. A username made
//   before prefixes ("sara") is shown as it is and kept unless it is changed.

import { useSettings } from '../theme';
import { withoutPrefix } from '../usernamePrefix';

export default function UsernameInput({ value, onChange, prefix, saved = '', ...inputProps }) {
  const settings = useSettings();
  const fixed = prefix ?? settings.usernamePrefix ?? '';
  const old = fixed && saved && value === saved && !value.startsWith(`${fixed}.`);
  const showPrefix = Boolean(fixed) && !old;

  function handleChange(event) {
    const typed = event.target.value.trim().toLowerCase();
    // Changing an old username gives it the prefix.
    onChange(typed && fixed ? `${fixed}.${withoutPrefix(typed, fixed)}` : typed);
  }

  return (
    <span className={showPrefix ? 'prefixed-input' : 'prefixed-input no-prefix'}>
      {showPrefix && (
        <span className="input-prefix" title="Every username in this academy starts with this">
          {fixed}.
        </span>
      )}
      <input
        {...inputProps}
        value={showPrefix ? withoutPrefix(value, fixed) : value}
        onChange={handleChange}
        autoCapitalize="none"
        spellCheck={false}
      />
    </span>
  );
}
