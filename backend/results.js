// Works out examination results from the stored marks. Used by /api/exams,
// so every screen shows the same totals, percentages and ranks.
//
// Rules:
// - A subject mark is "entered" when it has obtained marks or is marked absent.
//   Absent counts as 0 obtained.
// - Totals use each subject's own maximum marks (not every subject is out of 100).
// - A student is Complete when every subject of the exam has an entered mark AND
//   every subject's marks have been submitted by its teacher. Missing marks are
//   never treated as 0: an Incomplete result has no total or percentage, only the
//   totals of the subjects entered so far.
// - Only Complete results of students still in the class are ranked and used
//   for the average, highest and lowest percentage. Equal totals share a rank
//   (1, 2, 2, 4).
// - Each subject has pass marks (33% of the maximum, rounded up, unless the admin
//   set them). A subject is passed when obtained >= pass marks; absent fails it.
//   A Complete result is Pass when every subject is passed, otherwise Fail.

function round2(n) {
  return Math.round(n * 100) / 100;
}

function percent(obtained, max) {
  return max > 0 ? round2((obtained / max) * 100) : null;
}

// 33% of the maximum, rounded up: 100 -> 33, 50 -> 17, 75 -> 25.
function defaultPassMarks(maxMarks) {
  return Math.ceil(maxMarks * 0.33 - 1e-9);
}

// Pass marks of an exam subject (exams saved before pass marks existed get the default).
function passMarksOf(subject) {
  return subject.passMarks ?? defaultPassMarks(subject.maxMarks);
}

function isEntered(mark) {
  return Boolean(mark) && (mark.absent || mark.obtained !== null);
}

// Roll number (numbers in number order), then name.
function compareRoll(a, b) {
  return (
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }) ||
    a.studentName.localeCompare(b.studentName)
  );
}

// The students an exam is about: everyone now in the class, plus students who
// have marks in this exam but have since moved to another class or were removed.
// The marks keep the name and roll number the student had when they were entered.
function examRoster(exam, students, examMarks) {
  const current = students
    .filter((s) => s.classId === exam.classId)
    .map((s) => ({ studentId: s.id, rollNumber: s.rollNumber, studentName: s.name, leftClass: false }));
  const currentIds = new Set(current.map((s) => s.studentId));

  const former = new Map();
  for (const mark of examMarks) {
    if (currentIds.has(mark.studentId) || former.has(mark.studentId) || !isEntered(mark)) continue;
    const student = students.find((s) => s.id === mark.studentId);
    former.set(mark.studentId, {
      studentId: mark.studentId,
      rollNumber: student ? student.rollNumber : mark.rollNumber,
      studentName: student ? student.name : mark.studentName,
      leftClass: true,
    });
  }
  return [...current.sort(compareRoll), ...[...former.values()].sort(compareRoll)];
}

function buildResults(exam, students, marks) {
  const examMarks = marks.filter((m) => m.examId === exam.id);
  const subjects = exam.subjects.map((s) => ({ ...s, passMarks: passMarksOf(s) }));
  const totalMax = round2(exam.subjects.reduce((sum, s) => sum + s.maxMarks, 0));
  const allSubmitted = exam.subjects.length > 0 && exam.subjects.every((s) => s.submittedAt);

  const rows = examRoster(exam, students, examMarks).map((student) => {
    const subjectMarks = {};
    let enteredCount = 0;
    let enteredMax = 0;
    let enteredObtained = 0;

    const failedSubjects = [];
    for (const subject of subjects) {
      const mark = examMarks.find(
        (m) => m.studentId === student.studentId && m.subjectId === subject.subjectId
      );
      if (isEntered(mark)) {
        const obtained = mark.absent ? 0 : mark.obtained;
        const passed = !mark.absent && obtained >= subject.passMarks;
        if (!passed) failedSubjects.push(subject.subjectId);
        subjectMarks[subject.subjectId] = {
          obtained,
          absent: mark.absent,
          remarks: mark.remarks,
          percentage: percent(obtained, subject.maxMarks),
          passed,
        };
        enteredCount += 1;
        enteredMax += subject.maxMarks;
        enteredObtained += obtained;
      } else {
        subjectMarks[subject.subjectId] = null; // not entered yet
      }
    }

    const allEntered = exam.subjects.length > 0 && enteredCount === exam.subjects.length;
    const complete = allEntered && allSubmitted;
    return {
      ...student,
      marks: subjectMarks,
      complete,
      allEntered, // true but not complete = waiting for a teacher to submit
      result: complete ? (failedSubjects.length === 0 ? 'pass' : 'fail') : null,
      failedSubjects, // subjects below pass marks so far (entered marks only)

      enteredCount,
      missingCount: exam.subjects.length - enteredCount,
      enteredMax: round2(enteredMax),
      enteredObtained: round2(enteredObtained),
      totalMax,
      totalObtained: complete ? round2(enteredObtained) : null,
      percentage: complete ? percent(enteredObtained, totalMax) : null,
      rank: null,
    };
  });

  // Everyone shares the same total maximum, so ranking by total obtained is exact.
  const ranked = rows
    .filter((r) => r.complete && !r.leftClass)
    .sort((a, b) => b.totalObtained - a.totalObtained);
  ranked.forEach((row, i) => {
    const prev = ranked[i - 1];
    row.rank = prev && prev.totalObtained === row.totalObtained ? prev.rank : i + 1;
  });

  const inClass = rows.filter((r) => !r.leftClass);
  const obtainedTotals = ranked.map((r) => r.totalObtained);
  const stats = {
    studentCount: inClass.length,
    completeCount: ranked.length,
    incompleteCount: inClass.length - ranked.length,
    leftClassCount: rows.length - inClass.length,
    totalMax,
    allSubmitted,
    average: ranked.length
      ? percent(obtainedTotals.reduce((a, b) => a + b, 0) / ranked.length, totalMax)
      : null,
    highest: ranked.length ? percent(Math.max(...obtainedTotals), totalMax) : null,
    lowest: ranked.length ? percent(Math.min(...obtainedTotals), totalMax) : null,
    passCount: ranked.filter((r) => r.result === 'pass').length,
    failCount: ranked.filter((r) => r.result === 'fail').length,
  };

  return { subjects, rows, stats };
}

module.exports = { buildResults, isEntered, round2, defaultPassMarks, passMarksOf };
