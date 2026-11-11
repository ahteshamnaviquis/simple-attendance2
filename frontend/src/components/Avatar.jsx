// A person's picture: their profile photo, or, when they have none, the first
// letters of their name on a coloured circle. The colour is picked from the
// person's id (or name), so it looks random but stays the same everywhere.
//
// name, id: the person. photo: their { key } (or nothing). size: in pixels.

import { useState } from 'react';
import { profilePhotoUrl } from '../api';
import { useSettings } from '../theme';

// Colours that white letters are easy to read on (contrast 4.5 or more).
const COLORS = [
  '#2f5bd3', // blue
  '#0f766e', // teal
  '#7c3aed', // violet
  '#be185d', // pink
  '#b45309', // amber
  '#15803d', // green
  '#c2410c', // orange
  '#4338ca', // indigo
  '#0369a1', // sky
  '#b91c1c', // red
  '#9333ea', // purple
  '#475569', // slate
];

// "Sara" -> "SA", "Sara Khan" -> "SK", "Muhammad Ali Khan" -> "MAK".
export function initialsOf(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function colorFor(seed = '') {
  let hash = 0;
  for (const char of String(seed)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export default function Avatar({ name, id, photo, size = 36, preview, className = '' }) {
  const { academyId } = useSettings();
  const [broken, setBroken] = useState(null); // the photo address that failed to load
  const src = preview || (photo?.key && profilePhotoUrl(academyId, photo));
  const style = { width: size, height: size };

  if (src && broken !== src) {
    return (
      <img
        className={`person-avatar ${className}`}
        style={style}
        src={src}
        alt=""
        onError={() => setBroken(src)}
      />
    );
  }
  const letters = initialsOf(name);
  return (
    <span
      className={`person-avatar ${className}`}
      style={{ ...style, background: colorFor(id || name), fontSize: Math.round(size * (letters.length > 2 ? 0.32 : 0.38)) }}
      aria-hidden="true"
    >
      {letters}
    </span>
  );
}
