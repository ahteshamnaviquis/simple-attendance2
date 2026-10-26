// The website's look, chosen by the super admin (Settings screen) and stored
// by the backend in settings.json. applyTheme() puts it on the page by setting
// the CSS variables from index.css and loading the chosen font.

import { createContext, useContext } from 'react';
import { logoUrl } from './api';

// The company logo (frontend/public), shown until the super admin uploads one.
export const DEFAULT_LOGO = '/za-logo.png';

// Font name -> its CSS font stack and the weights to load from Google Fonts
// (only weights the font has: Google rejects the whole request otherwise).
// Keep the names in step with FONTS in backend/settings.js.
const ALL_WEIGHTS = '400;500;600;700;800';
export const FONTS = {
  'Public Sans': { stack: "'Public Sans', system-ui, sans-serif", weights: ALL_WEIGHTS },
  Inter: { stack: "'Inter', system-ui, sans-serif", weights: ALL_WEIGHTS },
  Roboto: { stack: "'Roboto', system-ui, sans-serif", weights: ALL_WEIGHTS },
  'Open Sans': { stack: "'Open Sans', system-ui, sans-serif", weights: ALL_WEIGHTS },
  Lato: { stack: "'Lato', system-ui, sans-serif", weights: '400;700;900' },
  Poppins: { stack: "'Poppins', system-ui, sans-serif", weights: ALL_WEIGHTS },
  Nunito: { stack: "'Nunito', system-ui, sans-serif", weights: ALL_WEIGHTS },
  Merriweather: { stack: "'Merriweather', Georgia, serif", weights: '400;700;900' },
  'System default': { stack: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", weights: null },
};

// Corner style -> [--radius, --radius-sm]
export const CORNERS = {
  square: { label: 'Square', radius: ['4px', '3px'] },
  normal: { label: 'Normal', radius: ['12px', '10px'] },
  round: { label: 'Round', radius: ['20px', '16px'] },
};

// Logo options: value -> label. Keep in step with backend/settings.js.
export const LOGO_SIZES = { small: 'Small', medium: 'Medium', large: 'Large' };
export const LOGO_SHAPES = { rounded: 'Rounded', square: 'Square', circle: 'Circle' };
export const LOGO_BACKGROUNDS = { accent: 'Accent color', white: 'White', none: 'None' };

// Ready-made color pairs for the Settings screen.
export const PRESETS = [
  { name: 'ZA Solution', accentColor: '#2a62eb', sidebarColor: '#0e1726' },
  { name: 'Civic Navy', accentColor: '#2f5bd3', sidebarColor: '#0f1b2d' },
  { name: 'Forest', accentColor: '#0b6e4f', sidebarColor: '#0d2a1f' },
  { name: 'Maroon', accentColor: '#9b1c31', sidebarColor: '#2b0d14' },
  { name: 'Teal', accentColor: '#0f766e', sidebarColor: '#0b2b2a' },
  { name: 'Plum', accentColor: '#6d28d9', sidebarColor: '#1e1036' },
  { name: 'Charcoal', accentColor: '#c2410c', sidebarColor: '#1c1c1e' },
];

// Contrast ratio between a #rrggbb color and white (1 to 21). White text needs 4.5 or more.
// The backend checks the same rule when saving.
export function contrastWithWhite(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

function loadFont(font) {
  const { weights } = FONTS[font];
  if (!weights) return;
  const id = `font-${font.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, '+')}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}

export function applyTheme(theme) {
  const root = document.documentElement.style;
  root.setProperty('--accent', theme.accentColor);
  root.setProperty('--nav-bg', theme.sidebarColor);
  const font = FONTS[theme.font] ? theme.font : 'Public Sans';
  root.setProperty('--font', FONTS[font].stack);
  const [radius, radiusSm] = (CORNERS[theme.corners] ?? CORNERS.normal).radius;
  root.setProperty('--radius', radius);
  root.setProperty('--radius-sm', radiusSm);
  loadFont(font);
  document.title = theme.schoolName;
  setFavicon(theme.logo);
}

// The browser tab icon: the uploaded logo, or the ZA Solution logo.
function setFavicon(logo) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = logo ? logoUrl(logo) : DEFAULT_LOGO;
}

// Used until the backend answers (or if it can't be reached). Same as the backend's defaults.
export const DEFAULT_SETTINGS = {
  theme: {
    schoolName: 'ZA Solution',
    accentColor: '#2a62eb',
    sidebarColor: '#0e1726',
    font: 'Public Sans',
    corners: 'normal',
    logo: null,
    logoSize: 'small',
    logoShape: 'rounded',
    logoBackground: 'accent',
    showSchoolName: true,
  },
  adminPermissions: { students: true, classes: true, subjects: true, teachers: false, exams: false },
};

// The current settings, for any screen that needs the school name or permissions.
export const SettingsContext = createContext(DEFAULT_SETTINGS);

export function useSettings() {
  return useContext(SettingsContext);
}
