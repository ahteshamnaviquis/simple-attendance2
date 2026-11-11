// /api/settings - the website's look and what admins may manage.
// Each academy has its own. Anyone can read them (the login page uses the
// theme); only that academy's super admin saves.
//
// The logo is uploaded on its own (PUT /api/settings/logo with the image as the
// body) and kept in the files table. The settings only record its type and a
// version number, which changes on every upload so browsers fetch the new one.

const express = require('express');
const { updateData, readFile, writeFile, deleteFile, currentAcademy } = require('../store');
const { HttpError, requireSuperAdmin, academyPrefix } = require('../helpers');
const { readSettings, cleanSettingsInput } = require('../settings');
const { IMAGE_TYPES } = require('../images');

const router = express.Router();

const LOGO_FILE = 'logo';
const MAX_LOGO_BYTES = 1024 * 1024;

// Allowed logo types (PNG, JPEG, WebP, GIF) and how their files start.
const LOGO_TYPES = IMAGE_TYPES;

// The settings of the current academy, and which academy that is (the logo's
// address names it: an <img> sends no login).
// usernamePrefix: what every new username here starts with ("gvs" -> "gvs.sara").
async function settingsView() {
  return { ...(await readSettings()), academyId: currentAcademy(), usernamePrefix: await academyPrefix() };
}

// GET /api/settings
// Before login, the academy is the one in ?academy= or the X-Academy-Id header
// (the academy last logged in to), otherwise the first one (server.js).
router.get('/', async (req, res) => {
  res.json(await settingsView());
});

// PUT /api/settings  { theme, adminPermissions }
// The uploaded logo stays as it is.
router.put('/', requireSuperAdmin, async (req, res) => {
  const cleaned = cleanSettingsInput(req.body);
  let settings;
  await updateData('settings', (saved) => {
    settings = { ...cleaned, theme: { ...cleaned.theme, logo: saved.theme?.logo ?? null } };
    return settings;
  });
  res.json(await settingsView());
});

// GET /api/settings/logo - the uploaded logo image, or 404.
router.get('/logo', async (req, res) => {
  const { theme } = await readSettings();
  if (!theme.logo) throw new HttpError(404, 'No logo has been uploaded');
  const file = await readFile(LOGO_FILE);
  if (!file) throw new HttpError(404, 'No logo has been uploaded');
  res.set({ 'Content-Type': file.type, 'X-Content-Type-Options': 'nosniff' }).send(file.data);
});

// PUT /api/settings/logo - body: the image itself, with its Content-Type.
router.put(
  '/logo',
  requireSuperAdmin,
  express.raw({ type: Object.keys(LOGO_TYPES), limit: MAX_LOGO_BYTES }),
  async (req, res) => {
    const type = req.get('Content-Type');
    const image = req.body;
    if (!Buffer.isBuffer(image) || !LOGO_TYPES[type]) {
      throw new HttpError(400, 'The logo must be a PNG, JPEG, WebP or GIF image');
    }
    if (!LOGO_TYPES[type](image)) {
      throw new HttpError(400, 'This file is not a real image of that type');
    }
    // The image and the settings are saved in one transaction.
    await updateData('settings', async (saved, conn) => {
      await writeFile(LOGO_FILE, type, image, conn);
      return { ...saved, theme: { ...saved.theme, logo: { type, version: Date.now() } } };
    });
    res.json(await settingsView());
  }
);

// DELETE /api/settings/logo - go back to the built-in check mark.
router.delete('/logo', requireSuperAdmin, async (req, res) => {
  await updateData('settings', async (saved, conn) => {
    await deleteFile(LOGO_FILE, conn);
    return { ...saved, theme: { ...saved.theme, logo: null } };
  });
  res.json(await settingsView());
});

module.exports = router;
