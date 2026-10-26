// /api/exams - examinations, subject marks and results.
//
// An exam (exams.json):
// {
//   id, name, classId, date: "YYYY-MM-DD", remarks,
//   className,                                   <- copied when created, like attendance
//   subjects: [{ subjectId, subjectName, maxMarks, passMarks, submittedAt, submittedBy }],
//   status: "open" | "published",
//   disabled: boolean,                           <- set by the super admin; hidden from teachers
//   createdById, createdBy, createdAt, updatedAt, updatedBy, publishedAt, publishedBy
// }
//
// A mark (marks.json), one per exam + subject + student:
// {
//   id, examId, subjectId, studentId,
//   studentName, rollNumber,                     <- copied when saved, so results stay
//                                                   readable if the student changes later
//   obtained: number | null, absent: boolean, remarks, updatedAt, updatedBy
// }
//
// Workflow:
// 1. The super admin creates an exam for a class (or the same exam for several classes
//    at once), choosing from the subjects assigned to the class (class-subjects)
//    and setting each subject's maximum marks. Every class gets its own exam record.
// 2. Each subject's teacher (from class-subjects, checked on every request) enters
//    marks for their own subject only, then submits them. A subject's marks-entry
//    status is Pending (nothing entered), In progress, or Submitted.
// 3. Submitted marks are locked. The super admin can reopen a subject for corrections.
// 4. When every subject is submitted and every student has all marks, the super admin
//    publishes the exam. Published exams are locked; the super admin can unpublish.
//
// Other rules:
// - Only the super admin (and admins, if the super admin allows them to manage
//   examinations) creates, edits, deletes and publishes exams. The class of an exam can't change.
// - Pass marks: a whole number from 1 to the subject's maximum; 33% of the maximum
//   (rounded up) when not given. Exams saved before pass marks existed use that default.
// - Obtained marks: 0 up to the subject's maximum, at most 2 decimal places.
//   A student marked absent has no obtained marks (absent counts as 0 in results).
// - Only one mark per exam + subject + student: saving updates the existing record.
// - A subject with marks can't be removed from an exam, and its maximum marks
//   can't go below the highest mark already entered.
// - An exam can only be deleted while it has no marks at all. The super admin can
//   remove any exam (with its marks), published or not.
// - The super admin can disable an exam: teachers no longer see it or enter marks
//   until it is enabled again.
// - The super admin can enter marks for any subject (for example one with no teacher assigned).

const express = require('express');
const { readData, updateData } = require('../fileStore');
const {
  HttpError,
  newId,
  isValidDate,
  can,
  requireLogin,
  requireArea,
  requireRole,
  requireSuperAdmin,
} = require('../helpers');
const { buildResults, isEntered, defaultPassMarks, passMarksOf } = require('../results');

const router = express.Router();

const MAX_SUBJECT_MARKS = 1000;

// The teacher currently assigned to a subject in a class, or null.
function assignedTeacherId(classSubjects, classId, subjectId) {
  const row = classSubjects.find((r) => r.classId === classId && r.subjectId === subjectId);
  return row ? row.teacherId : null;
}

// Check the exam form. `subjectList` is subjects.json, used to look up names.
function cleanExamInput(body, subjectList) {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  const date = String(body?.date ?? '');
  const remarks = String(body?.remarks ?? '').trim();

  if (!name) throw new HttpError(400, 'Exam name is required');
  if (name.length > 80) throw new HttpError(400, 'Exam name is too long (80 characters at most)');
  if (!isValidDate(date)) throw new HttpError(400, 'Please choose a valid exam date');
  if (remarks.length > 300) throw new HttpError(400, 'Remarks are too long (300 characters at most)');

  const rows = Array.isArray(body?.subjects) ? body.subjects : [];
  if (rows.length === 0) throw new HttpError(400, 'Include at least one subject');

  const subjects = rows.map((row) => {
    const subject = subjectList.find((s) => s.id === String(row?.subjectId ?? ''));
    if (!subject) throw new HttpError(400, 'Please choose a valid subject for every row');

    const raw = row?.maxMarks;
    const maxMarks = raw === '' || raw === null || raw === undefined ? NaN : Number(raw);
    if (!Number.isInteger(maxMarks) || maxMarks < 1 || maxMarks > MAX_SUBJECT_MARKS) {
      throw new HttpError(
        400,
        `Maximum marks for ${subject.name} must be a whole number from 1 to ${MAX_SUBJECT_MARKS}`
      );
    }

    // Pass marks: optional, 33% of the maximum when left out.
    const rawPass = row?.passMarks;
    const passMarks =
      rawPass === '' || rawPass === null || rawPass === undefined ? defaultPassMarks(maxMarks) : Number(rawPass);
    if (!Number.isInteger(passMarks) || passMarks < 1 || passMarks > maxMarks) {
      throw new HttpError(
        400,
        `Pass marks for ${subject.name} must be a whole number from 1 to ${maxMarks} (the maximum marks)`
      );
    }
    return { subjectId: subject.id, subjectName: subject.name, maxMarks, passMarks };
  });

  const seen = new Set();
  for (const s of subjects) {
    if (seen.has(s.subjectId)) throw new HttpError(400, `${s.subjectName} is listed twice`);
    seen.add(s.subjectId);
  }

  return { name, date, remarks, subjects };
}

function checkNoDuplicateExam(exams, exam, exceptId, className = 'This class') {
  const taken = exams.some(
    (e) =>
      e.id !== exceptId &&
      e.classId === exam.classId &&
      e.date === exam.date &&
      e.name.toLowerCase() === exam.name.toLowerCase()
  );
  if (taken) {
    throw new HttpError(409, `${className} already has an exam with this name on this date`);
  }
}

// A new exam record for one class.
function newExam(input, subjects, cls, user, now) {
  return {
    id: newId(),
    ...input,
    subjects: subjects.map((s) => ({ ...s, submittedAt: null, submittedBy: null })),
    classId: cls.id,
    className: cls.name,
    status: 'open',
    createdById: user.id,
    createdBy: user.name,
    createdAt: now,
    updatedAt: now,
    updatedBy: user.name,
    publishedAt: null,
    publishedBy: null,
  };
}

// New subjects of an exam must be assigned to the class.
function checkSubjectsInClass(subjects, classSubjects, classId, alreadyInExam = []) {
  for (const s of subjects) {
    if (alreadyInExam.includes(s.subjectId)) continue;
    if (!classSubjects.some((r) => r.classId === classId && r.subjectId === s.subjectId)) {
      throw new HttpError(400, `${s.subjectName} is not one of this class's subjects`);
    }
  }
}

// Load an exam and work out which of its subjects the user may work on.
// Super admin: all subjects. Teachers: the subjects they currently teach in the exam's
// class; a teacher with none of them gets 403.
async function loadExam(user, examId, exams) {
  const list = exams || (await readData('exams'));
  const exam = list.find((e) => e.id === examId);
  if (!exam) throw new HttpError(404, 'Examination not found');
  if (exam.disabled && !can(user, 'exams')) {
    throw new HttpError(403, 'This examination has been disabled by the super admin');
  }

  const classSubjects = await readData('classSubjects');
  const mySubjectIds =
    can(user, 'exams')
      ? exam.subjects.map((s) => s.subjectId)
      : exam.subjects
          .filter((s) => assignedTeacherId(classSubjects, exam.classId, s.subjectId) === user.id)
          .map((s) => s.subjectId);
  if (mySubjectIds.length === 0) {
    throw new HttpError(403, 'You do not teach any subject of this examination');
  }
  return { exam, classSubjects, mySubjectIds };
}

// A subject of the exam that the user may work on.
function findMySubject({ exam, mySubjectIds }, subjectId) {
  const subject = exam.subjects.find((s) => s.subjectId === subjectId);
  if (!subject) throw new HttpError(400, 'Please choose a subject of this examination');
  if (!mySubjectIds.includes(subjectId)) {
    throw new HttpError(403, `You do not teach ${subject.subjectName} in this class`);
  }
  return subject;
}

function checkOpen(exam) {
  if (exam.status === 'published') {
    throw new HttpError(
      409,
      'This examination is published, so it can no longer be changed. The super admin can unpublish it first.'
    );
  }
}

function checkNotSubmitted(subject) {
  if (subject.submittedAt) {
    throw new HttpError(
      409,
      `${subject.subjectName} marks have been submitted. Ask the super admin to reopen them for corrections.`
    );
  }
}

// Marks-entry progress of one exam subject, counting students now in the class.
function subjectProgress(exam, subject, students, marks) {
  const studentIds = new Set(students.filter((s) => s.classId === exam.classId).map((s) => s.id));
  const enteredCount = marks.filter(
    (m) =>
      m.examId === exam.id &&
      m.subjectId === subject.subjectId &&
      studentIds.has(m.studentId) &&
      isEntered(m)
  ).length;
  const status = subject.submittedAt ? 'submitted' : enteredCount > 0 ? 'in_progress' : 'pending';
  return { enteredCount, studentCount: studentIds.size, status };
}

// Exam subjects with their current teacher and marks-entry progress.
function describeSubjects(exam, { students, marks, classSubjects, users }) {
  return exam.subjects.map((s) => {
    const teacherId = assignedTeacherId(classSubjects, exam.classId, s.subjectId);
    return {
      ...s,
      passMarks: passMarksOf(s),
      teacherId,
      teacherName: users.find((u) => u.id === teacherId)?.name ?? null,
      ...subjectProgress(exam, s, students, marks),
    };
  });
}

async function readAll() {
  const [classes, students, marks, classSubjects, users] = await Promise.all([
    readData('classes'),
    readData('students'),
    readData('marks'),
    readData('classSubjects'),
    readData('users'),
  ]);
  return { classes, students, marks, classSubjects, users };
}

function className(exam, classes) {
  return classes.find((c) => c.id === exam.classId)?.name ?? exam.className;
}

// GET /api/exams?classId=&name=&subjectId=&from=&to=&status=  (super admin)
// All filters are optional. Newest exam dates first. Each exam comes with its
// marks-entry progress and a short summary of its results.
router.get('/', requireArea('exams'), async (req, res) => {
  const [exams, data] = await Promise.all([readData('exams'), readAll()]);
  const { classId, name, subjectId, from, to, status } = req.query;

  let list = exams;
  if (classId) list = list.filter((e) => e.classId === classId);
  if (name) {
    const text = String(name).trim().toLowerCase();
    list = list.filter((e) => e.name.toLowerCase().includes(text));
  }
  if (subjectId) list = list.filter((e) => e.subjects.some((s) => s.subjectId === subjectId));
  if (from) list = list.filter((e) => e.date >= from);
  if (to) list = list.filter((e) => e.date <= to);
  if (status) list = list.filter((e) => e.status === status);

  const result = list
    .map((exam) => {
      const subjects = describeSubjects(exam, data);
      const { stats } = buildResults(exam, data.students, data.marks);
      const submittedCount = subjects.filter((s) => s.status === 'submitted').length;
      return {
        ...exam,
        className: className(exam, data.classes),
        subjects,
        subjectCount: subjects.length,
        submittedCount,
        pendingCount: subjects.length - submittedCount,
        readyToPublish: exam.status === 'open' && stats.allSubmitted && stats.incompleteCount === 0,
        stats,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.className.localeCompare(b.className));
  res.json(result);
});

// GET /api/exams/my-subjects  (teacher)
// One row per exam subject the logged-in teacher teaches, newest exams first.
router.get('/my-subjects', requireRole('teacher'), async (req, res) => {
  const [exams, data] = await Promise.all([readData('exams'), readAll()]);
  const rows = [];
  for (const exam of exams.filter((e) => !e.disabled)) {
    for (const s of describeSubjects(exam, data)) {
      if (s.teacherId !== req.user.id) continue;
      rows.push({
        examId: exam.id,
        examName: exam.name,
        classId: exam.classId,
        className: className(exam, data.classes),
        date: exam.date,
        examStatus: exam.status,
        ...s,
      });
    }
  }
  rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.className.localeCompare(b.className) ||
      a.subjectName.localeCompare(b.subjectName)
  );
  res.json(rows);
});

// GET /api/exams/:id
// The super admin gets every subject; teachers only the subjects they teach in it.
router.get('/:id', requireLogin, async (req, res) => {
  const ctx = await loadExam(req.user, req.params.id);
  const data = await readAll();
  const subjects = describeSubjects(ctx.exam, data);
  res.json({
    ...ctx.exam,
    className: className(ctx.exam, data.classes),
    studentCount: data.students.filter((s) => s.classId === ctx.exam.classId).length,
    subjects: subjects.filter((s) => ctx.mySubjectIds.includes(s.subjectId)),
    hasMarks: data.marks.some((m) => m.examId === ctx.exam.id && isEntered(m)),
  });
});

// POST /api/exams - super admin creates an exam.
router.post('/', requireArea('exams'), async (req, res) => {
  const subjectList = await readData('subjects');
  const input = cleanExamInput(req.body, subjectList);
  const classId = String(req.body?.classId ?? '');

  let created;
  await updateData('exams', async (exams) => {
    const [classes, classSubjects] = await Promise.all([readData('classes'), readData('classSubjects')]);
    const cls = classes.find((c) => c.id === classId);
    if (!cls) throw new HttpError(400, 'Please choose a valid class');
    checkSubjectsInClass(input.subjects, classSubjects, classId);
    checkNoDuplicateExam(exams, { ...input, classId });

    created = newExam(input, input.subjects, cls, req.user, new Date().toISOString());
    return [...exams, created];
  });
  res.status(201).json(created);
});

// POST /api/exams/bulk - super admin creates the same exam for several classes at once.
// Body: like POST /api/exams, but with classIds: [...] instead of classId.
// Each class gets its own exam with the chosen subjects that the class studies
// (each with the maximum marks given). Every class must study at least one of
// them. All exams are created, or none if any class has a problem.
router.post('/bulk', requireArea('exams'), async (req, res) => {
  const subjectList = await readData('subjects');
  const input = cleanExamInput(req.body, subjectList);
  const classIds = Array.isArray(req.body?.classIds) ? [...new Set(req.body.classIds.map(String))] : [];
  if (classIds.length === 0) throw new HttpError(400, 'Please choose at least one class');

  let created;
  await updateData('exams', async (exams) => {
    const [classes, classSubjects] = await Promise.all([readData('classes'), readData('classSubjects')]);
    const now = new Date().toISOString();
    created = classIds.map((classId) => {
      const cls = classes.find((c) => c.id === classId);
      if (!cls) throw new HttpError(400, 'Please choose valid classes');
      const subjects = input.subjects.filter((s) =>
        classSubjects.some((r) => r.classId === classId && r.subjectId === s.subjectId)
      );
      if (subjects.length === 0) {
        throw new HttpError(400, `${cls.name} doesn't study any of the chosen subjects`);
      }
      checkNoDuplicateExam(exams, { ...input, classId }, null, cls.name);
      return newExam(input, subjects, cls, req.user, now);
    });
    return [...exams, ...created];
  });
  res.status(201).json(created);
});

// PUT /api/exams/:id - super admin edits name, date, remarks, subjects and maximum marks.
router.put('/:id', requireArea('exams'), async (req, res) => {
  const subjectList = await readData('subjects');
  const input = cleanExamInput(req.body, subjectList);

  let updated;
  await updateData('exams', async (exams) => {
    const { exam, classSubjects } = await loadExam(req.user, req.params.id, exams);
    checkOpen(exam);
    if (req.body?.classId && req.body.classId !== exam.classId) {
      throw new HttpError(400, 'The class of an examination cannot be changed');
    }
    checkSubjectsInClass(
      input.subjects,
      classSubjects,
      exam.classId,
      exam.subjects.map((s) => s.subjectId)
    );
    checkNoDuplicateExam(exams, { ...input, classId: exam.classId }, exam.id);

    // Subjects that already have marks must stay, with room for the marks entered.
    const marks = (await readData('marks')).filter((m) => m.examId === exam.id && isEntered(m));
    for (const old of exam.subjects) {
      const subjectMarks = marks.filter((m) => m.subjectId === old.subjectId);
      if (subjectMarks.length === 0) continue;
      const kept = input.subjects.find((s) => s.subjectId === old.subjectId);
      if (!kept) {
        throw new HttpError(
          409,
          `${old.subjectName} already has marks for ${subjectMarks.length} students, so it can't be removed`
        );
      }
      const highest = Math.max(...subjectMarks.map((m) => (m.absent ? 0 : m.obtained)));
      if (kept.maxMarks < highest) {
        throw new HttpError(
          409,
          `Maximum marks for ${old.subjectName} can't be less than ${highest}, the highest mark already entered`
        );
      }
    }

    updated = {
      ...exam,
      ...input,
      // Kept subjects keep their submission; the name stays as it was in the exam.
      subjects: input.subjects.map((s) => {
        const old = exam.subjects.find((o) => o.subjectId === s.subjectId);
        return old
          ? { ...old, maxMarks: s.maxMarks, passMarks: s.passMarks }
          : { ...s, submittedAt: null, submittedBy: null };
      }),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.name,
    };
    return exams.map((e) => (e.id === exam.id ? updated : e));
  });
  res.json(updated);
});

// DELETE /api/exams/:id
// Admins: only an open exam with no marks (for example made by mistake).
// Super admin: any exam; its marks are removed too.
router.delete('/:id', requireArea('exams'), async (req, res) => {
  const isSuper = req.user.role === 'superadmin';
  let examId;
  await updateData('exams', async (exams) => {
    const { exam } = await loadExam(req.user, req.params.id, exams);
    if (!isSuper) {
      checkOpen(exam);
      const marks = await readData('marks');
      if (marks.some((m) => m.examId === exam.id)) {
        throw new HttpError(409, 'This examination already has marks, so it cannot be deleted');
      }
    }
    examId = exam.id;
    return exams.filter((e) => e.id !== exam.id);
  });
  if (isSuper) await updateData('marks', (marks) => marks.filter((m) => m.examId !== examId));
  res.json({ ok: true });
});

// POST /api/exams/:id/disable and /enable - super admin only.
// A disabled exam is hidden from teachers and its marks can't be entered.
for (const [action, disabled] of [['disable', true], ['enable', false]]) {
  router.post(`/:id/${action}`, requireSuperAdmin, async (req, res) => {
    let updated;
    await updateData('exams', async (exams) => {
      const { exam } = await loadExam(req.user, req.params.id, exams);
      updated = {
        ...exam,
        disabled,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user.name,
      };
      return exams.map((e) => (e.id === exam.id ? updated : e));
    });
    res.json(updated);
  });
}

// Change one subject of an exam inside the exams.json write queue.
// `changeFn(exam, subject, ctx)` returns the updated subject.
async function updateExamSubject(req, changeFn) {
  let updated;
  await updateData('exams', async (exams) => {
    const ctx = await loadExam(req.user, req.params.id, exams);
    const subject = findMySubject(ctx, req.params.subjectId);
    const newSubject = await changeFn(ctx.exam, subject, ctx);
    updated = {
      ...ctx.exam,
      subjects: ctx.exam.subjects.map((s) => (s.subjectId === subject.subjectId ? newSubject : s)),
    };
    return exams.map((e) => (e.id === updated.id ? updated : e));
  });
  return updated;
}

// POST /api/exams/:id/subjects/:subjectId/submit - the subject teacher (or super admin)
// submits a subject's marks. Every student now in the class needs a mark or Absent.
router.post('/:id/subjects/:subjectId/submit', requireLogin, async (req, res) => {
  const exam = await updateExamSubject(req, async (exam, subject) => {
    checkOpen(exam);
    checkNotSubmitted(subject);
    const [students, marks] = await Promise.all([readData('students'), readData('marks')]);
    const { enteredCount, studentCount } = subjectProgress(exam, subject, students, marks);
    if (studentCount === 0) throw new HttpError(409, 'There are no students in this class yet');
    if (enteredCount < studentCount) {
      throw new HttpError(
        409,
        `Marks are missing for ${studentCount - enteredCount} of ${studentCount} students. Enter a mark or tick Absent for everyone before submitting.`
      );
    }
    return { ...subject, submittedAt: new Date().toISOString(), submittedBy: req.user.name };
  });
  res.json(exam);
});

// POST /api/exams/:id/subjects/:subjectId/reopen - super admin only. The teacher can
// correct the marks again. No marks are deleted.
router.post('/:id/subjects/:subjectId/reopen', requireArea('exams'), async (req, res) => {
  const exam = await updateExamSubject(req, (exam, subject) => {
    checkOpen(exam);
    if (!subject.submittedAt) throw new HttpError(409, `${subject.subjectName} marks are not submitted`);
    return { ...subject, submittedAt: null, submittedBy: null };
  });
  res.json(exam);
});

// POST /api/exams/:id/publish - super admin only, once every subject is submitted and
// every student has all marks.
router.post('/:id/publish', requireArea('exams'), async (req, res) => {
  let updated;
  await updateData('exams', async (exams) => {
    const { exam } = await loadExam(req.user, req.params.id, exams);
    if (exam.status === 'published') throw new HttpError(409, 'This examination is already published');

    const waiting = exam.subjects.filter((s) => !s.submittedAt).map((s) => s.subjectName);
    if (waiting.length > 0) {
      throw new HttpError(409, `Waiting for marks to be submitted: ${waiting.join(', ')}`);
    }
    const [students, marks] = await Promise.all([readData('students'), readData('marks')]);
    const { stats } = buildResults(exam, students, marks);
    if (stats.incompleteCount > 0) {
      throw new HttpError(
        409,
        `${stats.incompleteCount} students are missing marks (for example students who joined the class later). Reopen the subjects to add them.`
      );
    }

    const now = new Date().toISOString();
    updated = { ...exam, status: 'published', publishedAt: now, publishedBy: req.user.name };
    return exams.map((e) => (e.id === exam.id ? updated : e));
  });
  res.json(updated);
});

// POST /api/exams/:id/unpublish - super admin only. Subjects stay submitted; the super admin
// can then reopen a subject so its teacher can correct marks.
router.post('/:id/unpublish', requireArea('exams'), async (req, res) => {
  let updated;
  await updateData('exams', async (exams) => {
    const { exam } = await loadExam(req.user, req.params.id, exams);
    if (exam.status !== 'published') throw new HttpError(409, 'This examination is not published');

    updated = {
      ...exam,
      status: 'open',
      publishedAt: null,
      publishedBy: null,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user.name,
    };
    return exams.map((e) => (e.id === exam.id ? updated : e));
  });
  res.json(updated);
});

// The marks-entry grid for one subject: students now in the class, plus read-only
// rows for students who have marks but have left the class.
function marksGrid(exam, subject, students, marks) {
  const subjectMarks = marks.filter((m) => m.examId === exam.id && m.subjectId === subject.subjectId);
  const current = students.filter((s) => s.classId === exam.classId);

  const rows = current.map((s) => {
    const mark = subjectMarks.find((m) => m.studentId === s.id);
    return {
      studentId: s.id,
      rollNumber: s.rollNumber,
      studentName: s.name,
      leftClass: false,
      obtained: mark ? mark.obtained : null,
      absent: mark ? mark.absent : false,
      remarks: mark ? mark.remarks : '',
      updatedAt: mark ? mark.updatedAt : null,
      updatedBy: mark ? mark.updatedBy : null,
    };
  });
  for (const mark of subjectMarks) {
    if (current.some((s) => s.id === mark.studentId) || !isEntered(mark)) continue;
    rows.push({
      studentId: mark.studentId,
      rollNumber: mark.rollNumber,
      studentName: mark.studentName,
      leftClass: true,
      obtained: mark.obtained,
      absent: mark.absent,
      remarks: mark.remarks,
      updatedAt: mark.updatedAt,
      updatedBy: mark.updatedBy,
    });
  }

  const byRoll = (a, b) =>
    a.leftClass - b.leftClass ||
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }) ||
    a.studentName.localeCompare(b.studentName);
  return {
    examId: exam.id,
    examStatus: exam.status,
    subject: { ...subject, passMarks: passMarksOf(subject), ...subjectProgress(exam, subject, students, marks) },
    rows: rows.sort(byRoll),
  };
}

// GET /api/exams/:id/marks?subjectId=...  (super admin or the subject's teacher)
router.get('/:id/marks', requireLogin, async (req, res) => {
  const ctx = await loadExam(req.user, req.params.id);
  const subject = findMySubject(ctx, String(req.query.subjectId ?? ''));
  const [students, marks] = await Promise.all([readData('students'), readData('marks')]);
  res.json(marksGrid(ctx.exam, subject, students, marks));
});

// Check one row of the marks grid. Returns { obtained, absent, remarks }.
function cleanMarkEntry(row, student, subject) {
  const absent = row?.absent === true;
  const remarks = String(row?.remarks ?? '').trim();
  const raw = row?.obtained;
  const who = `${student.name}${student.rollNumber ? ` (roll no. ${student.rollNumber})` : ''}`;

  let obtained = null;
  if (raw !== '' && raw !== null && raw !== undefined) {
    obtained = Number(raw);
    if (!Number.isFinite(obtained)) throw new HttpError(400, `Marks for ${who} must be a number`);
    if (obtained < 0) throw new HttpError(400, `Marks for ${who} cannot be negative`);
    if (obtained > subject.maxMarks) {
      throw new HttpError(400, `Marks for ${who} cannot be more than ${subject.maxMarks}`);
    }
    if (Math.abs(Math.round(obtained * 100) - obtained * 100) > 1e-6) {
      throw new HttpError(400, `Marks for ${who} can have at most 2 decimal places`);
    }
  }
  if (absent && obtained !== null) {
    throw new HttpError(400, `${who} is marked absent, so leave the marks empty`);
  }
  if (remarks.length > 100) throw new HttpError(400, `Remarks for ${who} are too long (100 characters at most)`);
  return { obtained, absent, remarks };
}

// PUT /api/exams/:id/marks - save (as draft) one subject's marks for the class.
// Body: { subjectId, marks: [{ studentId, obtained, absent, remarks }] }
// Every row is checked first; if any row is wrong, nothing is saved.
// An empty row (no marks, not absent, no remarks) is "not entered".
router.put('/:id/marks', requireLogin, async (req, res) => {
  const rows = Array.isArray(req.body?.marks) ? req.body.marks : null;
  if (!rows) throw new HttpError(400, 'No marks were sent');
  const subjectId = String(req.body?.subjectId ?? '');

  let grid;
  let savedCount = 0;
  await updateData('marks', async (marks) => {
    const ctx = await loadExam(req.user, req.params.id);
    const { exam } = ctx;
    const subject = findMySubject(ctx, subjectId);
    checkOpen(exam);
    checkNotSubmitted(subject);

    const students = await readData('students');
    const seen = new Set();
    const cleaned = rows.map((row) => {
      const studentId = String(row?.studentId ?? '');
      const student = students.find((s) => s.id === studentId);
      if (!student || student.classId !== exam.classId) {
        throw new HttpError(400, 'Some students are not in this class. Reload the page and try again.');
      }
      if (seen.has(studentId)) throw new HttpError(400, `${student.name} is listed twice`);
      seen.add(studentId);
      return { student, ...cleanMarkEntry(row, student, subject) };
    });

    const now = new Date().toISOString();
    const copy = [...marks];
    for (const { student, obtained, absent, remarks } of cleaned) {
      const index = copy.findIndex(
        (m) => m.examId === exam.id && m.subjectId === subject.subjectId && m.studentId === student.id
      );
      const values = { obtained, absent, remarks };
      const snapshot = { studentName: student.name, rollNumber: student.rollNumber };
      const stamp = { updatedAt: now, updatedBy: req.user.name };

      if (index === -1) {
        if (obtained === null && !absent && !remarks) continue; // nothing to save
        copy.push({
          id: newId(),
          examId: exam.id,
          subjectId: subject.subjectId,
          studentId: student.id,
          ...snapshot,
          ...values,
          ...stamp,
        });
        savedCount += 1;
      } else {
        const old = copy[index];
        const changed =
          old.obtained !== obtained || old.absent !== absent || old.remarks !== remarks;
        if (!changed) continue;
        copy[index] = { ...old, ...snapshot, ...values, ...stamp };
        savedCount += 1;
      }
    }

    grid = marksGrid(exam, subject, students, copy);
    return copy;
  });
  res.json({ ...grid, savedCount });
});

// GET /api/exams/:id/results - super admin only. The class result sheet with totals,
// percentages, positions and summary statistics.
router.get('/:id/results', requireArea('exams'), async (req, res) => {
  const { exam } = await loadExam(req.user, req.params.id);
  const data = await readAll();
  const results = buildResults(exam, data.students, data.marks);
  res.json({
    exam: { ...exam, className: className(exam, data.classes) },
    ...results,
    subjects: describeSubjects(exam, data),
  });
});

module.exports = router;
