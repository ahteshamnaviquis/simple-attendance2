// The photo part of the teacher, student and parent forms: the picture (or the
// initials avatar) with Upload / Change and Remove.
//
// For someone already saved (id), the photo is saved straight away and
// onSaved(updatedPerson) is called. For someone new (no id yet), the chosen file
// is only kept (onPendingChange(file)) and uploaded by the form after saving.
//
// kind: 'teachers', 'students' or 'parents'. name: shown in the initials.

import { useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import { setPhoto } from '../api';

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024;

export default function PhotoEditor({ kind, id, name, photo, onSaved, pending, onPendingChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');

  // A preview of the file chosen for someone not saved yet.
  useEffect(() => {
    if (!pending) return setPreview('');
    const url = URL.createObjectURL(pending);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pending]);

  async function save(file) {
    setError('');
    if (!id) return onPendingChange?.(file);
    setBusy(true);
    try {
      onSaved?.(await setPhoto(kind, id, file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = ''; // the same file can be chosen again
    if (!file) return;
    if (!TYPES.includes(file.type)) return setError('Please choose a PNG, JPEG, WebP or GIF image');
    if (file.size > MAX_BYTES) return setError('The photo can be at most 2 MB');
    save(file);
  }

  const hasPhoto = Boolean(pending || photo?.key);

  return (
    <div className="photo-editor">
      <Avatar name={name || '?'} id={id} photo={photo} preview={preview} size={72} />
      <div className="photo-editor-actions">
        <span className="photo-editor-label">Photo</span>
        <div className="actions">
          <label className={busy ? 'file-button small disabled' : 'file-button small'}>
            {busy ? 'Saving…' : hasPhoto ? 'Change photo' : 'Upload photo'}
            <input type="file" accept={TYPES.join(',')} onChange={handleFile} disabled={busy} />
          </label>
          {hasPhoto && (
            <button type="button" className="secondary small" onClick={() => save(null)} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        {error ? (
          <span className="error">{error}</span>
        ) : (
          <span className="cell-sub">{id ? 'Saved straight away.' : 'Saved with the form.'} PNG, JPEG, WebP or GIF, up to 2 MB.</span>
        )}
      </div>
    </div>
  );
}
