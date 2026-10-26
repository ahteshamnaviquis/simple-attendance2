// Super admin: the website's look (school name, colors, font, corners, logo)
// and which areas admins may manage. Theme changes show on this page while
// editing; everyone else sees them after saving. The logo image itself is
// uploaded (or removed) straight away.

import { useEffect, useRef, useState } from 'react';
import { removeLogo, saveSettings, uploadLogo } from '../../api';
import Brand from '../../components/Brand.jsx';
import {
  applyTheme,
  contrastWithWhite,
  useSettings,
  CORNERS,
  DEFAULT_SETTINGS,
  FONTS,
  LOGO_BACKGROUNDS,
  LOGO_SHAPES,
  LOGO_SIZES,
  PRESETS,
} from '../../theme';

const AREAS = [
  { id: 'students', label: 'Students', help: 'Add, edit and remove students in any class' },
  { id: 'classes', label: 'Classes', help: 'Add and rename classes, and choose each class teacher' },
  { id: 'subjects', label: 'Subjects', help: "The subject list, each class's subjects and subject teachers" },
  { id: 'teachers', label: 'Teachers', help: 'Add and edit teacher accounts' },
  { id: 'exams', label: 'Examinations', help: 'Create, edit and publish exams, and enter or reopen marks' },
];

const isHexColor = (text) => /^#[0-9a-f]{6}$/i.test(text);

// The images the backend accepts as a logo, and its size limit.
const LOGO_FILE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_LOGO_BYTES = 1024 * 1024;

// Show the theme on the page, unless a color is half-typed.
function previewTheme(theme) {
  if (isHexColor(theme.accentColor) && isHexColor(theme.sidebarColor)) applyTheme(theme);
}

// A select for one of the option lists in theme.js (value -> label).
function ChoiceField({ label, value, options, onChange }) {
  return (
    <label>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {Object.entries(options).map(([id, text]) => (
          <option key={id} value={id}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

// A color picker with the hex value beside it, and a warning when white text
// on the color would be hard to read.
function ColorField({ label, value, onChange }) {
  const valid = isHexColor(value);
  const tooLight = valid && contrastWithWhite(value) < 4.5;
  return (
    <label>
      {label}
      <span className="color-field">
        <input type="color" value={valid ? value : '#000000'} onChange={(e) => onChange(e.target.value)} />
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} maxLength={7} spellCheck={false} />
      </span>
      {!valid && <span className="field-error">Use a color like #2f5bd3</span>}
      {tooLight && <span className="field-error">Too light: white text on it would be hard to read</span>}
    </label>
  );
}

export default function SettingsManager({ onSaved }) {
  const saved = useSettings();
  const [form, setForm] = useState(saved);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [logoStatus, setLogoStatus] = useState({ busy: false, error: '', message: '' });

  // Preview the theme while editing; put the saved one back when leaving the page.
  const savedRef = useRef(saved);
  savedRef.current = saved;
  useEffect(() => () => applyTheme(savedRef.current.theme), []);

  const { theme, adminPermissions } = form;
  const colorsOk = [theme.accentColor, theme.sidebarColor].every(
    (color) => isHexColor(color) && contrastWithWhite(color) >= 4.5
  );
  const changed = JSON.stringify(form) !== JSON.stringify(saved);

  function changeTheme(changes) {
    const next = { ...form, theme: { ...theme, ...changes } };
    setForm(next);
    setMessage('');
    previewTheme(next.theme);
  }

  // Upload or remove the logo. That is saved at once; other unsaved edits stay in the form.
  async function changeLogo(action, doneMessage) {
    setLogoStatus({ busy: true, error: '', message: '' });
    try {
      const result = await action();
      onSaved(result);
      const next = { ...form, theme: { ...theme, logo: result.theme.logo } };
      setForm(next);
      previewTheme(next.theme);
      setLogoStatus({ busy: false, error: '', message: doneMessage });
    } catch (err) {
      setLogoStatus({ busy: false, error: err.message, message: '' });
    }
  }

  function handleLogoFile(event) {
    const file = event.target.files[0];
    event.target.value = ''; // so choosing the same file again still counts as a change
    if (!file) return;
    if (!LOGO_FILE_TYPES.includes(file.type)) {
      setLogoStatus({ busy: false, error: 'Please choose a PNG, JPEG, WebP or GIF image', message: '' });
    } else if (file.size > MAX_LOGO_BYTES) {
      setLogoStatus({ busy: false, error: 'The logo can be at most 1 MB', message: '' });
    } else {
      changeLogo(() => uploadLogo(file), 'Logo uploaded. Everyone sees it now.');
    }
  }

  function handleRemoveLogo() {
    if (window.confirm('Remove the logo? The built-in check mark is shown instead.')) {
      changeLogo(removeLogo, 'Logo removed.');
    }
  }

  function changePermission(area, allowed) {
    setForm({ ...form, adminPermissions: { ...adminPermissions, [area]: allowed } });
    setMessage('');
  }

  function discard() {
    setForm(saved);
    applyTheme(saved.theme);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const result = await saveSettings(form);
      setForm(result);
      onSaved(result);
      setMessage('Settings saved. Admins see the changes the next time they open or refresh the website.');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="settings" onSubmit={handleSubmit}>
      <div className="page-title">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">How the website looks, and what admins can manage</p>
        </div>
      </div>

      <section className="card">
        <h2>Appearance</h2>
        <div className="form-grid">
          <label>
            School name
            <input
              value={theme.schoolName}
              onChange={(e) => changeTheme({ schoolName: e.target.value })}
              maxLength={40}
              required
            />
          </label>
          <label>
            Font
            <select value={theme.font} onChange={(e) => changeTheme({ font: e.target.value })}>
              {Object.keys(FONTS).map((font) => (
                <option key={font}>{font}</option>
              ))}
            </select>
          </label>
          <label>
            Corners
            <select value={theme.corners} onChange={(e) => changeTheme({ corners: e.target.value })}>
              {Object.entries(CORNERS).map(([id, corner]) => (
                <option key={id} value={id}>
                  {corner.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <h3>Colors</h3>
        <div className="preset-row" role="group" aria-label="Color presets">
          {PRESETS.map((preset) => {
            const active =
              preset.accentColor === theme.accentColor.toLowerCase() &&
              preset.sidebarColor === theme.sidebarColor.toLowerCase();
            return (
              <button
                key={preset.name}
                type="button"
                className={active ? 'secondary small preset active' : 'secondary small preset'}
                aria-pressed={active}
                onClick={() => changeTheme({ accentColor: preset.accentColor, sidebarColor: preset.sidebarColor })}
              >
                <span className="swatch" style={{ background: preset.sidebarColor }} />
                <span className="swatch" style={{ background: preset.accentColor }} />
                {preset.name}
              </button>
            );
          })}
        </div>
        <div className="form-grid">
          <ColorField
            label="Accent color (buttons, links, highlights)"
            value={theme.accentColor}
            onChange={(accentColor) => changeTheme({ accentColor })}
          />
          <ColorField
            label="Sidebar color"
            value={theme.sidebarColor}
            onChange={(sidebarColor) => changeTheme({ sidebarColor })}
          />
        </div>
        <p className="note">
          Changes show on this page while you edit. Everyone else sees them after you save.
        </p>
      </section>

      <section className="card">
        <h2>Logo</h2>
        <div className="logo-editor">
          <div className="brand-preview" aria-label="Preview of the sidebar">
            <Brand theme={theme} />
          </div>
          <div>
            <div className="actions">
              <label className={logoStatus.busy ? 'file-button disabled' : 'file-button'}>
                {logoStatus.busy ? 'Working…' : theme.logo ? 'Replace logo' : 'Upload logo'}
                <input
                  type="file"
                  accept={LOGO_FILE_TYPES.join(',')}
                  onChange={handleLogoFile}
                  disabled={logoStatus.busy}
                />
              </label>
              {theme.logo && (
                <button type="button" className="danger" onClick={handleRemoveLogo} disabled={logoStatus.busy}>
                  Remove logo
                </button>
              )}
            </div>
            <p className="note">
              PNG, JPEG, WebP or GIF, up to 1 MB. A square image looks best. Uploading or
              removing the logo takes effect straight away; the options below are saved
              with the other settings.
            </p>
            {logoStatus.error && <p className="error">{logoStatus.error}</p>}
            {logoStatus.message && <p className="success">{logoStatus.message}</p>}
          </div>
        </div>
        <div className="form-grid">
          <ChoiceField
            label="Size"
            value={theme.logoSize}
            options={LOGO_SIZES}
            onChange={(logoSize) => changeTheme({ logoSize })}
          />
          <ChoiceField
            label="Shape"
            value={theme.logoShape}
            options={LOGO_SHAPES}
            onChange={(logoShape) => changeTheme({ logoShape })}
          />
          <ChoiceField
            label="Background"
            value={theme.logoBackground}
            options={LOGO_BACKGROUNDS}
            onChange={(logoBackground) => changeTheme({ logoBackground })}
          />
        </div>
        <label className="check-label logo-name-toggle">
          <input
            type="checkbox"
            checked={theme.showSchoolName}
            onChange={(e) => changeTheme({ showSchoolName: e.target.checked })}
          />
          Show the school name next to the logo
        </label>
      </section>

      <section className="card">
        <h2>What admins can manage</h2>
        <p className="note">
          Admins always have the dashboard and attendance reports. You always keep teachers,
          examinations, admin accounts and these settings.
        </p>
        <div className="permission-list">
          {AREAS.map((area) => (
            <label key={area.id} className="check-label permission">
              <input
                type="checkbox"
                checked={adminPermissions[area.id]}
                onChange={(e) => changePermission(area.id, e.target.checked)}
              />
              <span>
                {area.label}
                <span className="permission-help">{area.help}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}
      <div className="actions">
        <button type="submit" disabled={!changed || !colorsOk || !theme.schoolName.trim()}>
          Save settings
        </button>
        <button type="button" className="secondary" onClick={discard} disabled={!changed}>
          Discard changes
        </button>
        <button type="button" className="secondary" onClick={() => changeTheme({ ...DEFAULT_SETTINGS.theme, logo: theme.logo })}>
          Default look
        </button>
      </div>
    </form>
  );
}
