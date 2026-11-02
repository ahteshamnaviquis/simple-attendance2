// Conversations between parents and the school.
//
// Each parent has one conversation with the school office (teacherId null),
// which every admin and the super admin share, and one with each teacher they
// write to (teacherId = that teacher). Parents can write to the office and to
// their children's teachers: the class teacher and the subject teachers of
// each child's class. A teacher can write to the parents of those students.
//
// A message (the messages table):
// { id, parentId, teacherId, fromSchool, senderId, senderName, senderRole, body, createdAt, readAt }
// fromSchool: sent by staff (an admin or the teacher), not by the parent.
// readAt is set when the other side opens the conversation.

const { HttpError, newId } = require('./helpers');

const MAX_MESSAGE_LENGTH = 2000;

function cleanMessageBody(value) {
  const body = String(value ?? '').trim();
  if (!body) throw new HttpError(400, 'Please write a message');
  if (body.length > MAX_MESSAGE_LENGTH) {
    throw new HttpError(400, `A message can be at most ${MAX_MESSAGE_LENGTH} characters`);
  }
  return body;
}

function newMessage({ parentId, teacherId, sender, body, createdAt }) {
  return {
    id: newId(),
    parentId,
    teacherId: teacherId ?? null,
    fromSchool: sender.role !== 'parent',
    senderId: sender.id,
    senderName: sender.name,
    senderRole: sender.role,
    body,
    createdAt: createdAt ?? new Date().toISOString(),
    readAt: null,
  };
}

// The conversation a message belongs to (null teacherId = the school office).
const inThread = (m, parentId, teacherId) => m.parentId === parentId && (m.teacherId ?? null) === (teacherId ?? null);

// What each teacher teaches each of these students:
// { teacherId: [{ studentId, studentName, gender, className, roles }] }.
// roles: "Class teacher" and/or subject names.
function teachersOf(students, { classes, classSubjects, subjects }) {
  const byTeacher = new Map();
  const add = (teacherId, student, role) => {
    if (!teacherId) return;
    const list = byTeacher.get(teacherId) ?? [];
    let entry = list.find((e) => e.studentId === student.id);
    if (!entry) {
      entry = {
        studentId: student.id,
        studentName: student.name,
        gender: student.gender ?? null,
        className: classes.find((c) => c.id === student.classId)?.name ?? '',
        roles: [],
      };
      list.push(entry);
    }
    if (!entry.roles.includes(role)) entry.roles.push(role);
    byTeacher.set(teacherId, list);
  };

  for (const student of students) {
    add(classes.find((c) => c.id === student.classId)?.teacherId, student, 'Class teacher');
    for (const cs of classSubjects.filter((x) => x.classId === student.classId)) {
      add(cs.teacherId, student, subjects.find((s) => s.id === cs.subjectId)?.name ?? 'Subject');
    }
  }
  return byTeacher;
}

// The students a teacher teaches: their classes as class teacher or subject teacher.
function studentIdsOfTeacher(teacherId, { classes, classSubjects, students }) {
  const classIds = new Set([
    ...classes.filter((c) => c.teacherId === teacherId).map((c) => c.id),
    ...classSubjects.filter((cs) => cs.teacherId === teacherId).map((cs) => cs.classId),
  ]);
  return new Set(students.filter((s) => classIds.has(s.classId)).map((s) => s.id));
}

// Short summary of a conversation for a list: last message and unread count
// (unread = sent by the other side and not read yet).
function threadSummary(messages, viewerIsStaff) {
  const last = messages[messages.length - 1] ?? null;
  return {
    lastMessage: last,
    messageCount: messages.length,
    unreadCount: messages.filter((m) => m.fromSchool !== viewerIsStaff && !m.readAt).length,
  };
}

module.exports = {
  MAX_MESSAGE_LENGTH,
  cleanMessageBody,
  newMessage,
  inThread,
  teachersOf,
  studentIdsOfTeacher,
  threadSummary,
};
