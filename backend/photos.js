// Profile photos of teachers, parents (users) and students.
//
// A person's `photo` is { key, type }: the image is the academy's file
// "photo-<key>", and the key is random, so a photo's address can't be guessed.
// Each upload gets a new key (browsers then load the new picture). No photo =
// no `photo`: the apps show the person's initials instead.
//
// Routes add PUT /:id/photo (the image as the body, with its Content-Type) and
// DELETE /:id/photo; GET /api/photos/:academyId/:key serves the image (an <img>
// sends no login).

const express = require('express');
const { updateData, writeFile, deleteFile } = require('./store');
const { HttpError, newId } = require('./helpers');
const { IMAGE_TYPES } = require('./images');

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const fileName = (key) => `photo-${key}`;

// Middleware that reads the uploaded image (PNG, JPEG, WebP or GIF, up to 2 MB).
const readPhoto = express.raw({ type: Object.keys(IMAGE_TYPES), limit: MAX_PHOTO_BYTES });

function uploadedImage(req) {
  const type = req.get('Content-Type');
  if (!Buffer.isBuffer(req.body) || !IMAGE_TYPES[type]) {
    throw new HttpError(400, 'The photo must be a PNG, JPEG, WebP or GIF image');
  }
  if (!IMAGE_TYPES[type](req.body)) throw new HttpError(400, 'This file is not a real image of that type');
  return { type, data: req.body };
}

// Replace (image) or remove (image null) the photo of one row of `collection`.
// find(list) returns the row's index, or throws (not found, not allowed).
// The image and the row are saved together. Returns the saved row.
async function setPhoto(collection, find, image) {
  let saved;
  await updateData(collection, async (list, conn) => {
    const index = await find(list);
    const { photo: old, ...row } = list[index];
    if (old?.key) await deleteFile(fileName(old.key), conn);
    saved = row;
    if (image) {
      const key = newId();
      await writeFile(fileName(key), image.type, image.data, conn);
      saved = { ...row, photo: { key, type: image.type } };
    }
    return list.map((item, i) => (i === index ? saved : item));
  });
  return saved;
}

// Add PUT and DELETE /:id/photo to a router. `find(req, list)` as for setPhoto;
// `view(req, row)` is what the route sends back.
function photoRoutes(router, { collection, guard, find, view }) {
  router.put('/:id/photo', guard, readPhoto, async (req, res) => {
    const image = uploadedImage(req);
    res.json(await view(req, await setPhoto(collection, (list) => find(req, list), image)));
  });
  router.delete('/:id/photo', guard, async (req, res) => {
    res.json(await view(req, await setPhoto(collection, (list) => find(req, list), null)));
  });
}

// Remove the photo file of a row that is being removed (inside its updateData).
async function deletePhotoOf(row, conn) {
  if (row?.photo?.key) await deleteFile(fileName(row.photo.key), conn);
}

module.exports = { photoRoutes, deletePhotoOf, fileName, MAX_PHOTO_BYTES };
