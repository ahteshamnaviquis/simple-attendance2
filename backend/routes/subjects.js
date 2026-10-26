// /api/subjects - the academy's list of subjects (English, Mathematics, ...).
// A subject: { id, name }
//
// Everyone logged in can see the list (teachers pick subjects for their exams).
// Only admins with the subjects permission add or rename subjects. Subjects can't be deleted, and every
// exam keeps the subject names it was created with, so old results always make sense.

const express = require('express');
const { readData, updateData } = require('../fileStore');
const { HttpError, newId, requireLogin, requireArea } = require('../helpers');

const router = express.Router();

function cleanSubjectInput(body) {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  if (!name) throw new HttpError(400, 'Subject name is required');
  if (name.length > 60) throw new HttpError(400, 'Subject name is too long (60 characters at most)');
  return { name };
}

function checkNameFree(subjects, name, exceptId) {
  const taken = subjects.some(
    (s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase()
  );
  if (taken) throw new HttpError(409, 'A subject with this name already exists');
}

// GET /api/subjects
router.get('/', requireLogin, async (req, res) => {
  const subjects = await readData('subjects');
  res.json([...subjects].sort((a, b) => a.name.localeCompare(b.name)));
});

// POST /api/subjects
router.post('/', requireArea('subjects'), async (req, res) => {
  const input = cleanSubjectInput(req.body);
  let created;
  await updateData('subjects', (subjects) => {
    checkNameFree(subjects, input.name);
    created = { id: newId(), ...input };
    return [...subjects, created];
  });
  res.status(201).json(created);
});

// PUT /api/subjects/:id - rename. Existing exams keep the old name.
router.put('/:id', requireArea('subjects'), async (req, res) => {
  const input = cleanSubjectInput(req.body);
  let updated;
  await updateData('subjects', (subjects) => {
    const index = subjects.findIndex((s) => s.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Subject not found');
    checkNameFree(subjects, input.name, req.params.id);

    updated = { ...subjects[index], ...input };
    const copy = [...subjects];
    copy[index] = updated;
    return copy;
  });
  res.json(updated);
});

module.exports = router;
