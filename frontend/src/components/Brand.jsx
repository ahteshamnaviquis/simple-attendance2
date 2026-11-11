// The school's logo and name, as set by the super admin in Settings.
// Used in the sidebar, on the login page and in the Settings preview.
// large: the bigger version on the login page.

import Icon from './Icon.jsx';
import { logoUrl } from '../api';
import { useSettings } from '../theme';

export default function Brand({ theme, large = false }) {
  const { academyId } = useSettings();
  const markClass = [
    'brand-mark',
    `logo-${theme.logoSize}`,
    `logo-${theme.logoShape}`,
    `logo-bg-${theme.logoBackground}`,
    large && 'brand-mark-lg',
  ]
    .filter(Boolean)
    .join(' ');

  // Without the visible name, the logo carries it for screen readers.
  const nameless = !theme.showSchoolName && { role: 'img', 'aria-label': theme.schoolName };

  return (
    <div className="brand" {...nameless}>
      <span className={markClass}>
        {theme.logo ? (
          <img src={logoUrl(theme.logo, academyId)} alt="" />
        ) : (
          <Icon name="check" size={large ? 22 : 19} strokeWidth={2.4} />
        )}
      </span>
      {theme.showSchoolName && <span>{theme.schoolName}</span>}
    </div>
  );
}
