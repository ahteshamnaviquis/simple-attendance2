// /api/students - list, add, edit and remove students.
//
// A student: { id, rollNumber, name, classId, guardianName, phone }
//
// Admins can manage every student. Teachers can only manage students in the
// classes assigned to them, and can only move a student between their own classes.
// Removing a student does not change old attendance reports: reports store
// absent students' names as text.

const express = require('express');
const { readData, updateData } = require('../fileStore');
const { HttpError, newId, requireLogin } = require('../helpers');

const router = express.Router();

function canUseClass(user, cls) {
  return user.role === 'admin' || (cls && cls.teacherId === user.id);
}

function cleanStudentInput(body) {
  const student = {
    rollNumber: String(body?.rollNumber ?? '').trim(),
    name: String(body?.name ?? '').trim(),
    classId: String(body?.classId ?? '').trim(),
    guardianName: String(body?.guardianName ?? '').trim(),
    phone: String(body?.phone ?? '').trim(),
  };
  if (!student.name) throw new HttpError(400, 'Student name is required');
  if (!student.classId) throw new HttpError(400, 'Please choose a class');
  return student;
}

// Checks the class exists, the user may use it, and the roll number is free.
async function checkStudent(user, students, student, exceptId) {
  const classes = await readData('classes');
  const cls = classes.find((c) => c.id === student.classId);
  if (!cls) throw new HttpError(400, 'Please choose a valid class');
  if (!canUseClass(user, cls)) throw new HttpError(403, 'This class is not assigned to you');

  if (student.rollNumber) {
    const taken = students.some(
      (s) =>
        s.id !== exceptId &&
        s.classId === student.classId &&
        s.rollNumber.toLowerCase() === student.rollNumber.toLowerCase()
    );
    if (taken) throw new HttpError(409, `Roll number ${student.rollNumber} is already used in this class`);
  }
}

// Sort by class, then roll number (numbers in number order), then name.
function compareStudents(a, b) {
  return (
    a.className.localeCompare(b.className) ||
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }) ||
    a.name.localeCompare(b.name)
  );
}

// GET /api/students?classId=...
// Admins see all students, teachers only students in their classes.
router.get('/', requireLogin, async (req, res) => {
  const [students, classes] = await Promise.all([readData('students'), readData('classes')]);
  const visibleClasses = classes.filter((c) => canUseClass(req.user, c));

  let list = students
    .map((s) => {
      const cls = visibleClasses.find((c) => c.id === s.classId);
      return cls ? { ...s, className: cls.name } : null;
    })
    .filter(Boolean);
  if (req.query.classId) list = list.filter((s) => s.classId === req.query.classId);

  res.json(list.sort(compareStudents));
});

// POST /api/students
router.post('/', requireLogin, async (req, res) => {
  const input = cleanStudentInput(req.body);
  let created;
  await updateData('students', async (students) => {
    await checkStudent(req.user, students, input);
    created = { id: newId(), ...input };
    return [...students, created];
  });
  res.status(201).json(created);
});

// PUT /api/students/:id
router.put('/:id', requireLogin, async (req, res) => {
  const input = cleanStudentInput(req.body);
  let updated;
  await updateData('students', async (students) => {
    const index = students.findIndex((s) => s.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Student not found');

    // The user must be allowed to use both the current and the new class.
    const classes = await readData('classes');
    const currentClass = classes.find((c) => c.id === students[index].classId);
    if (!canUseClass(req.user, currentClass)) {
      throw new HttpError(403, 'This student is not in one of your classes');
    }
    await checkStudent(req.user, students, input, req.params.id);

    updated = { ...students[index], ...input };
    const copy = [...students];
    copy[index] = updated;
    return copy;
  });
  res.json(updated);
});

// DELETE /api/students/:id
router.delete('/:id', requireLogin, async (req, res) => {
  await updateData('students', async (students) => {
    const student = students.find((s) => s.id === req.params.id);
    if (!student) throw new HttpError(404, 'Student not found');

    const classes = await readData('classes');
    const cls = classes.find((c) => c.id === student.classId);
    if (!canUseClass(req.user, cls)) {
      throw new HttpError(403, 'This student is not in one of your classes');
    }
    return students.filter((s) => s.id !== req.params.id);
  });
  res.json({ ok: true });
});

module.exports = router;
