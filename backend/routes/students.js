// /api/students - list, add, edit and remove students.
//
// A student: { id, rollNumber, name, gender, classId, guardianName, phone }
// gender: "male" or "female" (parents see "son" or "daughter"), or left out.
// The list also gives each student's className and parents
// ([{ parentId, name, relation, phone }]).
//
// Parents are added with the student: POST and PUT take an optional `parents`
// list (see parentAccounts.js), which needs the "parents" permission. It adds
// new parent accounts, updates or links existing ones (a brother's or sister's
// parent), and replaces the student's parents, all in one transaction.
// guardianName and phone then follow the first parent.
//
// Admins can manage every student. Teachers can only manage students in the
// classes assigned to them, and can only move a student between their own classes.
// Removing a student does not change old attendance reports: reports store
// absent students' names as text.

const express = require('express');
const { readData, updateData, updateMany } = require('../store');
const { HttpError, newId, isAdmin, can, requireLogin } = require('../helpers');
const { cleanParentEntries, applyParentEntries } = require('../parentAccounts');

const router = express.Router();

// Adding, editing and removing: admins with the students permission, or the class teacher.
function canUseClass(user, cls) {
  return can(user, 'students') || (cls && cls.teacherId === user.id);
}

// Reading: every admin (the dashboard counts students), whoever manages parents
// (to choose their children), or the class teacher.
function canSeeClass(user, cls) {
  return isAdmin(user) || can(user, 'parents') || canUseClass(user, cls);
}

function cleanStudentInput(body) {
  const student = {
    rollNumber: String(body?.rollNumber ?? '').trim(),
    name: String(body?.name ?? '').trim(),
    gender: body?.gender ? String(body.gender) : undefined,
    classId: String(body?.classId ?? '').trim(),
    guardianName: String(body?.guardianName ?? '').trim(),
    phone: String(body?.phone ?? '').trim(),
  };
  if (!student.name) throw new HttpError(400, 'Student name is required');
  if (!student.classId) throw new HttpError(400, 'Please choose a class');
  if (student.gender !== undefined && !['male', 'female'].includes(student.gender)) {
    throw new HttpError(400, 'Please choose boy or girl');
  }
  return student;
}

// The cleaned `parents` list of a request, or null when it has none.
function parentEntriesOf(user, body) {
  if (body?.parents === undefined) return null;
  if (!can(user, 'parents')) throw new HttpError(403, 'You are not allowed to add or change parents');
  return cleanParentEntries(body.parents);
}

// The collections a save touches: the student, plus the parents when given.
function collectionsFor(entries) {
  return entries ? ['students', 'users', 'parentProfiles', 'parentStudents'] : ['students'];
}

// Link the student's parents (when given) and copy the first parent's name and
// phone onto the student, so screens that show the guardian stay correct.
function withParents(data, student, entries) {
  if (!entries) return student;
  const [firstId] = applyParentEntries(data, student.id, entries);
  if (!firstId) return student;
  const parent = data.users.find((u) => u.id === firstId);
  const profile = data.parentProfiles.find((p) => p.id === firstId);
  return { ...student, guardianName: parent.name, phone: profile?.phone || student.phone };
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

// The students the user may see, with class name and parents.
async function visibleStudents(user) {
  const [students, classes, users, parentProfiles, parentStudents] = await Promise.all([
    readData('students'),
    readData('classes'),
    readData('users'),
    readData('parentProfiles'),
    readData('parentStudents'),
  ]);
  const visibleClasses = classes.filter((c) => canSeeClass(user, c));
  const parentsOf = (studentId) =>
    parentStudents
      .filter((l) => l.studentId === studentId)
      .map((l) => {
        const parent = users.find((u) => u.id === l.parentId);
        const profile = parentProfiles.find((p) => p.id === l.parentId);
        return { parentId: l.parentId, name: parent.name, relation: profile?.relation ?? '', phone: profile?.phone ?? '' };
      });

  return students
    .map((s) => {
      const cls = visibleClasses.find((c) => c.id === s.classId);
      return cls ? { ...s, className: cls.name, parents: parentsOf(s.id) } : null;
    })
    .filter(Boolean)
    .sort(compareStudents);
}

async function findVisibleStudent(user, id) {
  return (await visibleStudents(user)).find((s) => s.id === id);
}

// GET /api/students?classId=...
// Admins see all students, teachers only students in their classes.
router.get('/', requireLogin, async (req, res) => {
  let list = await visibleStudents(req.user);
  if (req.query.classId) list = list.filter((s) => s.classId === req.query.classId);
  res.json(list);
});

// POST /api/students
router.post('/', requireLogin, async (req, res) => {
  const input = cleanStudentInput(req.body);
  const entries = parentEntriesOf(req.user, req.body);
  const id = newId();
  await updateMany(collectionsFor(entries), async (data) => {
    await checkStudent(req.user, data.students, input);
    const changed = { ...data };
    const student = withParents(changed, { id, ...input }, entries);
    changed.students = [...data.students, student];
    return changed;
  });
  res.status(201).json(await findVisibleStudent(req.user, id));
});

// PUT /api/students/:id
router.put('/:id', requireLogin, async (req, res) => {
  const input = cleanStudentInput(req.body);
  const entries = parentEntriesOf(req.user, req.body);
  await updateMany(collectionsFor(entries), async (data) => {
    const { students } = data;
    const index = students.findIndex((s) => s.id === req.params.id);
    if (index === -1) throw new HttpError(404, 'Student not found');

    // The user must be allowed to use both the current and the new class.
    const classes = await readData('classes');
    const currentClass = classes.find((c) => c.id === students[index].classId);
    if (!canUseClass(req.user, currentClass)) {
      throw new HttpError(403, 'This student is not in one of your classes');
    }
    await checkStudent(req.user, students, input, req.params.id);

    const changed = { ...data };
    const updated = withParents(changed, { ...students[index], ...input }, entries);
    changed.students = students.map((s, i) => (i === index ? updated : s));
    return changed;
  });
  res.json(await findVisibleStudent(req.user, req.params.id));
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
