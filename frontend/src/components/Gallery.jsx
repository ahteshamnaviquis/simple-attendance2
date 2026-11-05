// Photo gallery: albums for the whole school or one class.
//   Everyone sees the whole-school albums and the albums of their classes
//   (a parent: their children's classes).
//   Admins and the super admin make albums for the school or any class; a
//   teacher for a class they teach. Whoever may manage an album adds photos
//   (several at once) and removes photos or the whole album.

import { useEffect, useState } from 'react';
import {
  createAlbum,
  deleteAlbum,
  deletePhoto,
  getAlbum,
  getAlbums,
  getDiaryOptions,
  photoUrl,
  updateAlbum,
  uploadPhoto,
} from '../api';
import Icon from './Icon.jsx';
import { formatMediumDate, todayString } from '../utils';

const MAX_PHOTO_MB = 5;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export default function Gallery({ user }) {
  const isStaff = user.role !== 'parent';
  const isOffice = user.role === 'admin' || user.role === 'superadmin';
  const [albums, setAlbums] = useState(null);
  const [classes, setClasses] = useState([]); // the classes this user may make albums for
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  function load() {
    getAlbums()
      .then(setAlbums)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
    if (isStaff) getDiaryOptions().then(setClasses).catch(() => {});
  }, [isStaff]);

  if (openId) {
    return (
      <AlbumView
        albumId={openId}
        onBack={() => {
          setOpenId(null);
          load();
        }}
      />
    );
  }

  const canCreate = isOffice || classes.length > 0;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Gallery</h1>
          <p className="subtitle">Photos from school events and classes</p>
        </div>
        {isStaff && canCreate && !adding && (
          <div className="actions">
            <button type="button" className="with-icon" onClick={() => setAdding(true)}>
              <Icon name="plus" /> New album
            </button>
          </div>
        )}
      </div>

      {adding && (
        <AlbumForm
          classes={classes}
          isOffice={isOffice}
          onCancel={() => setAdding(false)}
          onSaved={(album) => {
            setAdding(false);
            setOpenId(album.id);
          }}
        />
      )}

      {error && <p className="error">{error}</p>}
      {albums && albums.length === 0 && <p className="card">No albums yet.</p>}

      <div className="album-grid">
        {albums?.map((album) => (
          <button key={album.id} type="button" className="album-card" onClick={() => setOpenId(album.id)}>
            <span className="album-cover">
              {album.coverPhotoId ? (
                <img src={photoUrl(album.coverPhotoId)} alt="" loading="lazy" />
              ) : (
                <Icon name="gallery" size={36} strokeWidth={1.5} />
              )}
            </span>
            <span className="album-info">
              <span className="album-title">{album.title}</span>
              <span className="cell-sub">
                {formatMediumDate(album.date)} · {album.className || 'Whole school'} · {album.photoCount}{' '}
                {album.photoCount === 1 ? 'photo' : 'photos'}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}

// New album (album = null) or edit an album's title, description and date.
function AlbumForm({ album, classes, isOffice, onCancel, onSaved }) {
  const [form, setForm] = useState({
    title: album?.title ?? '',
    description: album?.description ?? '',
    date: album?.date ?? todayString(),
    classId: album ? album.classId ?? '' : isOffice ? '' : classes[0]?.classId ?? '',
  });
  const [error, setError] = useState('');
  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    try {
      onSaved(album ? await updateAlbum(album.id, form) : await createAlbum(form));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>{album ? 'Edit album' : 'New album'}</h2>
      <div className="form-grid">
        <label>
          Title
          <input value={form.title} onChange={set('title')} maxLength={150} placeholder="e.g. Sports day 2026" required />
        </label>
        <label>
          Date
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
        {!album && (
          <label>
            Who can see it
            <select value={form.classId} onChange={set('classId')} required={!isOffice}>
              {isOffice && <option value="">Whole school</option>}
              {classes.map((c) => (
                <option key={c.classId} value={c.classId}>
                  {c.className} only
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label className="diary-text">
        Description <span className="note">(optional)</span>
        <textarea value={form.description} onChange={set('description')} rows={2} maxLength={500} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="submit">{album ? 'Save changes' : 'Create album'}</button>
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AlbumView({ albumId, onBack }) {
  const [album, setAlbum] = useState(null);
  const [editing, setEditing] = useState(false);
  const [viewing, setViewing] = useState(null); // index of the photo shown large
  const [upload, setUpload] = useState(null); // { done, total } while uploading
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function load() {
    return getAlbum(albumId)
      .then(setAlbum)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, [albumId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Arrow keys and Escape while a photo is shown large.
  useEffect(() => {
    if (viewing === null) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') setViewing(null);
      if (e.key === 'ArrowRight') setViewing((i) => Math.min(i + 1, album.photos.length - 1));
      if (e.key === 'ArrowLeft') setViewing((i) => Math.max(i - 1, 0));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewing, album]);

  async function handleFiles(event) {
    const files = [...event.target.files];
    event.target.value = '';
    setError('');
    setMessage('');
    const problems = [];
    let added = 0;
    setUpload({ done: 0, total: files.length });
    for (const file of files) {
      if (!IMAGE_TYPES.includes(file.type)) problems.push(`${file.name}: not a PNG, JPEG, WebP or GIF image`);
      else if (file.size > MAX_PHOTO_MB * 1024 * 1024) problems.push(`${file.name}: bigger than ${MAX_PHOTO_MB} MB`);
      else {
        try {
          await uploadPhoto(albumId, file);
          added += 1;
        } catch (err) {
          problems.push(`${file.name}: ${err.message}`);
        }
      }
      setUpload((u) => ({ ...u, done: u.done + 1 }));
    }
    setUpload(null);
    if (added) setMessage(`Added ${added} ${added === 1 ? 'photo' : 'photos'}.`);
    if (problems.length) setError(`Not added: ${problems.join('; ')}`);
    load();
  }

  async function removePhoto(photo) {
    if (!window.confirm('Remove this photo?')) return;
    try {
      await deletePhoto(photo.id);
      setViewing(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeAlbum() {
    const count = album.photos.length;
    if (!window.confirm(`Remove the album “${album.title}”${count ? ` and its ${count} photos` : ''}?`)) return;
    try {
      await deleteAlbum(album.id);
      onBack();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!album) {
    return (
      <>
        <button type="button" className="link-button" onClick={onBack}>
          ← All albums
        </button>
        {error && <p className="error">{error}</p>}
      </>
    );
  }

  const shown = viewing !== null ? album.photos[viewing] : null;

  return (
    <>
      <button type="button" className="link-button" onClick={onBack}>
        ← All albums
      </button>
      <div className="page-title">
        <div>
          <h1>{album.title}</h1>
          <p className="subtitle">
            {formatMediumDate(album.date)} · {album.className || 'Whole school'} · {album.photos.length}{' '}
            {album.photos.length === 1 ? 'photo' : 'photos'} · by {album.createdBy}
          </p>
          {album.description && <p className="album-description">{album.description}</p>}
        </div>
        {album.canManage && !editing && (
          <div className="actions">
            <label className={upload ? 'file-button disabled' : 'file-button'}>
              <Icon name="plus" /> {upload ? `Uploading ${upload.done + 1} of ${upload.total}…` : 'Add photos'}
              <input type="file" accept={IMAGE_TYPES.join(',')} multiple disabled={Boolean(upload)} onChange={handleFiles} />
            </label>
            <button type="button" className="secondary" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="danger" onClick={removeAlbum}>
              Remove album
            </button>
          </div>
        )}
      </div>

      {editing && (
        <AlbumForm
          album={album}
          classes={[]}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      )}

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}
      {album.photos.length === 0 && (
        <p className="card">{album.canManage ? 'No photos yet. Use “Add photos” to upload some.' : 'No photos yet.'}</p>
      )}

      <div className="photo-grid">
        {album.photos.map((photo, index) => (
          <button key={photo.id} type="button" className="photo-tile" onClick={() => setViewing(index)}>
            <img src={photoUrl(photo.id)} alt={`Photo ${index + 1} of ${album.title}`} loading="lazy" />
          </button>
        ))}
      </div>

      {shown && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setViewing(null)}>
          <div className="lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <span>
              {viewing + 1} of {album.photos.length}
            </span>
            <span className="lightbox-actions">
              <a className="lightbox-link" href={photoUrl(shown.id)} target="_blank" rel="noreferrer">
                Open full size
              </a>
              {album.canManage && (
                <button type="button" className="danger small" onClick={() => removePhoto(shown)}>
                  <Icon name="trash" size={16} /> Remove
                </button>
              )}
              <button type="button" className="icon-button" aria-label="Close" onClick={() => setViewing(null)}>
                <Icon name="close" />
              </button>
            </span>
          </div>
          <div className="lightbox-stage">
            <button
              type="button"
              className="icon-button lightbox-nav"
              aria-label="Previous photo"
              disabled={viewing === 0}
              onClick={(e) => {
                e.stopPropagation();
                setViewing(viewing - 1);
              }}
            >
              <Icon name="prev" size={28} />
            </button>
            <img src={photoUrl(shown.id)} alt={`Photo ${viewing + 1} of ${album.title}`} onClick={(e) => e.stopPropagation()} />
            <button
              type="button"
              className="icon-button lightbox-nav"
              aria-label="Next photo"
              disabled={viewing === album.photos.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                setViewing(viewing + 1);
              }}
            >
              <Icon name="next" size={28} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
