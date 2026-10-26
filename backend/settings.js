// School-wide settings, stored in settings.json and changed by the super admin:
//   theme            - how the website looks (name, colors, font, corners, logo)
//   adminPermissions - which areas admins may manage
//
// The dashboard and attendance reports always belong to admins; admin accounts
// and these settings always belong to the super admin.

const { readData } = require('./fileStore');
const { settings: DEFAULT_SETTINGS } = require('./seedData');
const { HttpError } = require('./helpers');

// Fonts the website can load. Keep in step with FONTS in frontend/src/theme.js.
const FONTS = [
  'Public Sans',
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Nunito',
  'Merriweather',
  'System default',
];

const CORNERS = ['square', 'normal', 'round'];
const LOGO_SIZES = ['small', 'medium', 'large'];
const LOGO_SHAPES = ['square', 'rounded', 'circle'];
const LOGO_BACKGROUNDS = ['accent', 'white', 'none'];

// The areas the super admin can hand to admins.
const ADMIN_AREAS = Object.keys(DEFAULT_SETTINGS.adminPermissions);

// The saved settings, with defaults filled in for anything missing
// (for example a settings.json written by an older version).
async function readSettings() {
  const saved = await readData('settings');
  return {
    theme: { ...DEFAULT_SETTINGS.theme, ...saved.theme },
    adminPermissions: { ...DEFAULT_SETTINGS.adminPermissions, ...saved.adminPermissions },
  };
}

// Contrast ratio between a #rrggbb color and white (1 to 21).
// White text needs at least 4.5 to be easy to read.
function contrastWithWhite(hex) {
  const channel = (i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05);
}

function cleanColor(value, label) {
  const color = String(value ?? '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    throw new HttpError(400, `${label} must be a color like #2f5bd3`);
  }
  if (contrastWithWhite(color) < 4.5) {
    throw new HttpError(400, `${label} is too light: white text on it would be hard to read`);
  }
  return color;
}

function checkChoice(value, choices, label) {
  if (!choices.includes(value)) throw new HttpError(400, `Please choose a ${label} from the list`);
}

// Check and tidy the settings form. Both parts are required.
// The logo itself is not part of the form: it is uploaded separately.
function cleanSettingsInput(body) {
  const theme = body?.theme ?? {};
  const permissions = body?.adminPermissions ?? {};

  const schoolName = String(theme.schoolName ?? '').trim();
  if (!schoolName) throw new HttpError(400, 'School name is required');
  if (schoolName.length > 40) throw new HttpError(400, 'School name can be at most 40 characters');
  checkChoice(theme.font, FONTS, 'font');
  checkChoice(theme.corners, CORNERS, 'corner style');
  checkChoice(theme.logoSize, LOGO_SIZES, 'logo size');
  checkChoice(theme.logoShape, LOGO_SHAPES, 'logo shape');
  checkChoice(theme.logoBackground, LOGO_BACKGROUNDS, 'logo background');
  if (typeof theme.showSchoolName !== 'boolean') {
    throw new HttpError(400, '"Show school name" must be on or off');
  }

  const adminPermissions = {};
  for (const area of ADMIN_AREAS) {
    if (typeof permissions[area] !== 'boolean') {
      throw new HttpError(400, `Admin permission "${area}" must be on or off`);
    }
    adminPermissions[area] = permissions[area];
  }

  return {
    theme: {
      schoolName,
      accentColor: cleanColor(theme.accentColor, 'Accent color'),
      sidebarColor: cleanColor(theme.sidebarColor, 'Sidebar color'),
      font: theme.font,
      corners: theme.corners,
      logoSize: theme.logoSize,
      logoShape: theme.logoShape,
      logoBackground: theme.logoBackground,
      showSchoolName: theme.showSchoolName,
    },
    adminPermissions,
  };
}

module.exports = { readSettings, cleanSettingsInput };
