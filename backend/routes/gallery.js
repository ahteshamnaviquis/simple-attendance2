// /api/gallery - photo albums for the whole school or one class.
//
//   GET    /albums                  the albums the user may see, newest date first,
//                                   with photo count and cover photo
//   GET    /albums/:id              one album with its photos
//   POST   /albums                  { title, description, date, classId }   classId '' = whole school
//   PUT    /albums/:id              { title, description, date }            (the class can't change)
//   DELETE /albums/:id              removes the album and all its photos
//   POST   /albums/:id/photos       body: one image (PNG, JPEG, WebP or GIF, up to 5 MB) with its Content-Type
//   DELETE /photos/:id
//   GET    /photos/:id/image        the image itself
//
// Rules:
// - Everyone sees the whole-school albums. Class albums: admins and the super
//   admin all, a teacher the classes they teach, a parent their children's classes.
// - Admins and the super admin make albums for the school or any class. A
//   teacher makes albums for a class they teach, and manages the albums they made.
// - The image address works without the login header (an <img> can't send it);
//   photo ids are random, so it can't be guessed. Local prototype only.

const express = require('express');
const { readData, updateData, updateMany, readFile, writeFile, deleteFile, unscoped, withAcademy } = require('../store');
const { HttpError, newId, isValidDate, todayString, requireRole } = require('../helpers');
const { isOffice, readableClassIds, teachingClassIds, cleanText } = require('../schoolAccess');
const { IMAGE_TYPES } = require('../images');

const router = express.Router();
const requireUser = requireRole('superadmin', 'admin', 'teacher', 'parent');
const requireStaff = requireRole('superadmin', 'admin', 'teacher');

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const MAX_PHOTOS_PER_ALBUM = 200;
const fileName = (photoId) => `gallery-${photoId}`;

async function loadSchool() {
  const [classes, classSubjects, students, parentStudents] = await Promise.all([
    readData('classes'),
    readData('classSubjects'),
    readData('students'),
    readData('parentStudents'),
  ]);
  return { classes, classSubjects, students, parentStudents };
}

function canSee(album, allowed) {
  return !album.classId || !allowed || allowed.has(album.classId);
}

function canManage(user, album) {
  return isOffice(user) || (user.role === 'teacher' && album.createdById === user.id);
}

async function findAlbum(user, id) {
  const album = (await readData('galleryAlbums')).find((a) => a.id === id);
  if (!album || !canSee(album, readableClassIds(user, await loadSchool()))) {
    throw new HttpError(404, 'Album not found');
  }
  return album;
}

function cleanAlbum(body) {
  const date = String(body?.date || todayString());
  if (!isValidDate(date)) throw new HttpError(400, 'Please choose a valid date');
  return {
    title: cleanText(body?.title, 'album title', 150),
    description: cleanText(body?.description, 'description', 500, { required: false }),
    date,
  };
}

const photoView = (p) => ({ id: p.id, albumId: p.albumId, createdBy: p.createdBy, createdAt: p.createdAt });

// GET /api/gallery/albums
router.get('/albums', requireUser, async (req, res) => {
  const [albums, photos, school] = await Promise.all([
    readData('galleryAlbums'),
    readData('galleryPhotos'),
    loadSchool(),
  ]);
  const allowed = readableClassIds(req.user, school);
  res.json(
    albums
      .filter((a) => canSee(a, allowed))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
      .map((a) => {
        const own = photos.filter((p) => p.albumId === a.id);
        return { ...a, photoCount: own.length, coverPhotoId: own[0]?.id ?? null, canManage: canManage(req.user, a) };
      })
  );
});

// GET /api/gallery/albums/:id
router.get('/albums/:id', requireUser, async (req, res) => {
  const album = await findAlbum(req.user, req.params.id);
  const photos = (await readData('galleryPhotos')).filter((p) => p.albumId === album.id).map(photoView);
  res.json({ ...album, canManage: canManage(req.user, album), photos });
});

// POST /api/gallery/albums
router.post('/albums', requireStaff, async (req, res) => {
  const fields = cleanAlbum(req.body);
  const classId = req.body?.classId || null;
  const { classes, classSubjects } = await loadSchool();
  const cls = classId ? classes.find((c) => c.id === classId) : null;
  if (classId && !cls) throw new HttpError(400, 'Class not found');
  if (req.user.role === 'teacher' && (!cls || !teachingClassIds(req.user, classes, classSubjects).has(cls.id))) {
    throw new HttpError(403, 'Teachers can make albums for the classes they teach');
  }
  const album = {
    id: newId(),
    ...fields,
    classId: cls?.id ?? null,
    className: cls?.name ?? null,
    createdById: req.user.id,
    createdBy: req.user.name,
    createdAt: new Date().toISOString(),
  };
  await updateData('galleryAlbums', (list) => [...list, album]);
  res.status(201).json({ ...album, photoCount: 0, coverPhotoId: null, canManage: true });
});

// PUT /api/gallery/albums/:id
router.put('/albums/:id', requireStaff, async (req, res) => {
  const fields = cleanAlbum(req.body);
  const album = await findAlbum(req.user, req.params.id);
  if (!canManage(req.user, album)) throw new HttpError(403, 'You can only change the albums you made');
  const saved = { ...album, ...fields };
  await updateData('galleryAlbums', (list) => list.map((a) => (a.id === album.id ? saved : a)));
  res.json(saved);
});

// DELETE /api/gallery/albums/:id
router.delete('/albums/:id', requireStaff, async (req, res) => {
  const album = await findAlbum(req.user, req.params.id);
  if (!canManage(req.user, album)) throw new HttpError(403, 'You can only remove the albums you made');
  await updateMany(['galleryAlbums', 'galleryPhotos'], async ({ galleryAlbums, galleryPhotos }, conn) => {
    const gone = galleryPhotos.filter((p) => p.albumId === album.id).map((p) => fileName(p.id));
    await deleteFile(gone, conn);
    return {
      galleryAlbums: galleryAlbums.filter((a) => a.id !== album.id),
      galleryPhotos: galleryPhotos.filter((p) => p.albumId !== album.id),
    };
  });
  res.json({ ok: true });
});

// POST /api/gallery/albums/:id/photos - body: the image, with its Content-Type.
router.post(
  '/albums/:id/photos',
  requireStaff,
  express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_PHOTO_BYTES }),
  async (req, res) => {
    const type = req.get('Content-Type');
    const image = req.body;
    if (!Buffer.isBuffer(image) || !IMAGE_TYPES[type]) {
      throw new HttpError(400, 'Photos must be PNG, JPEG, WebP or GIF images');
    }
    if (!IMAGE_TYPES[type](image)) throw new HttpError(400, 'This file is not a real image of that type');

    const album = await findAlbum(req.user, req.params.id);
    if (!canManage(req.user, album)) throw new HttpError(403, 'You can only add photos to the albums you made');
    const photo = { id: newId(), albumId: album.id, type, createdBy: req.user.name, createdAt: new Date().toISOString() };
    // The photo's row and its image are saved in one transaction.
    await updateData('galleryPhotos', async (list, conn) => {
      if (list.filter((p) => p.albumId === album.id).length >= MAX_PHOTOS_PER_ALBUM) {
        throw new HttpError(400, `An album can have at most ${MAX_PHOTOS_PER_ALBUM} photos`);
      }
      await writeFile(fileName(photo.id), type, image, conn);
      return [...list, photo];
    });
    res.status(201).json(photoView(photo));
  }
);

// DELETE /api/gallery/photos/:id
router.delete('/photos/:id', requireStaff, async (req, res) => {
  const photo = (await readData('galleryPhotos')).find((p) => p.id === req.params.id);
  if (!photo) throw new HttpError(404, 'Photo not found');
  const album = await findAlbum(req.user, photo.albumId);
  if (!canManage(req.user, album)) throw new HttpError(403, 'You can only remove photos from the albums you made');
  await updateData('galleryPhotos', async (list, conn) => {
    await deleteFile(fileName(photo.id), conn);
    return list.filter((p) => p.id !== photo.id);
  });
  res.json({ ok: true });
});

// GET /api/gallery/photos/:id/image
// An <img> sends no login, so the photo's academy is found from the photo itself.
router.get('/photos/:id/image', async (req, res) => {
  const photo = (await unscoped(() => readData('galleryPhotos'))).find((p) => p.id === req.params.id);
  const file = photo && (await withAcademy(photo.academyId, () => readFile(fileName(photo.id))));
  if (!file) throw new HttpError(404, 'Photo not found');
  res
    .set({
      'Content-Type': file.type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, max-age=86400, immutable', // a photo never changes
    })
    .send(file.data);
});

module.exports = router;
