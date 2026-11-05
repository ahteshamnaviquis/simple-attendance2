// Who is connected to which classes, for the diary, leaves and gallery.
//
//   classTeacherOf(user, classes)                the classes the user is class teacher of
//   teachingClassIds(user, classes, classSubjects) class teacher or subject teacher
//   childrenOf(user, parentStudents, students)   a parent's linked children
//   isOffice(user)                               an admin or the super admin

const { HttpError } = require('./helpers');

function isOffice(user) {
  return user?.role === 'admin' || user?.role === 'superadmin';
}

function classTeacherOf(user, classes) {
  return new Set(classes.filter((c) => c.teacherId === user.id).map((c) => c.id));
}

function teachingClassIds(user, classes, classSubjects) {
  return new Set([
    ...classTeacherOf(user, classes),
    ...classSubjects.filter((cs) => cs.teacherId === user.id).map((cs) => cs.classId),
  ]);
}

function childrenOf(user, parentStudents, students) {
  const ids = new Set(parentStudents.filter((l) => l.parentId === user.id).map((l) => l.studentId));
  return students.filter((s) => ids.has(s.id));
}

// The classes a user may read class things (diary, class albums) for:
// null = every class (the office), otherwise a Set of class ids.
function readableClassIds(user, { classes, classSubjects, parentStudents, students }) {
  if (isOffice(user)) return null;
  if (user.role === 'teacher') return teachingClassIds(user, classes, classSubjects);
  if (user.role === 'parent') return new Set(childrenOf(user, parentStudents, students).map((s) => s.classId));
  return new Set();
}

// Trimmed text, required or not, with a maximum length.
function cleanText(value, label, max, { required = true } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) throw new HttpError(400, `Please enter the ${label}`);
  if (text.length > max) throw new HttpError(400, `The ${label} can be at most ${max} characters`);
  return text;
}

module.exports = { isOffice, classTeacherOf, teachingClassIds, childrenOf, readableClassIds, cleanText };
