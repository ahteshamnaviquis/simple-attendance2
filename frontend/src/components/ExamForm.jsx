// Super admin: create or edit an examination.
//
// Creating: choose one or more classes (or "Select all classes"). The subjects of
// the chosen classes load with their teachers; the super admin picks which subjects the
// exam includes and sets each one's maximum marks. Every class gets its own exam
// with the included subjects it studies.
//
// Editing: one exam (one class). The class can't be changed, and a subject that
// already has marks can't be removed (the backend checks this too).

import { useEffect, useState } from 'react';
import { createExams, getClassSubjects, updateExam } from '../api';
import { defaultPassMarks, todayString } from '../utils';

const EXAM_NAMES = ['Weekly Test', 'Monthly Test', 'Midterm Exam', 'Final Exam', 'Send-up Exam'];
const MAX_SUBJECT_MARKS = 1000;

// Editing: the exam's subjects first (in their saved order), then the class's other subjects.
function editRows(exam, classSubjects) {
  const rows = exam.subjects.map((s) => ({
    subjectId: s.subjectId,
    subjectName: s.subjectName,
    taughtIn: [{ className: exam.className, teacherName: s.teacherName }],
    hasMarks: (s.enteredCount || 0) > 0,
  }));
  for (const c of classSubjects.filter((r) => r.classId === exam.classId)) {
    if (rows.some((r) => r.subjectId === c.subjectId)) continue;
    rows.push({
      subjectId: c.subjectId,
      subjectName: c.subjectName,
      taughtIn: [{ className: c.className, teacherName: c.teacherName }],
      hasMarks: false,
    });
  }
  return rows;
}

// Creating: every subject studied by at least one chosen class, by name.
function newRows(classIds, classSubjects) {
  const rows = new Map();
  for (const c of classSubjects) {
    if (!classIds.includes(c.classId)) continue;
    if (!rows.has(c.subjectId)) {
      rows.set(c.subjectId, { subjectId: c.subjectId, subjectName: c.subjectName, taughtIn: [], hasMarks: false });
    }
    rows.get(c.subjectId).taughtIn.push({ classId: c.classId, className: c.className, teacherName: c.teacherName });
  }
  return [...rows.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName));
}

// "A, B and C"
function joinNames(names) {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

// With several classes chosen: which of them study this subject, and (on request) who teaches it.
function ClassesCell({ row, chosen }) {
  const missing = chosen.filter((c) => !row.taughtIn.some((t) => t.classId === c.id));
  return (
    <>
      <div>
        {missing.length === 0
          ? `All ${chosen.length} classes`
          : row.taughtIn.length <= missing.length
            ? `Only ${joinNames(row.taughtIn.map((t) => t.className))}`
            : `All except ${joinNames(missing.map((c) => c.name))}`}
      </div>
      <details className="teacher-details">
        <summary>Show teachers</summary>
        {row.taughtIn.map((t) => (
          <div key={t.classId} className="cell-sub">
            {t.className}: {t.teacherName || 'no teacher'}
          </div>
        ))}
      </details>
    </>
  );
}

export default function ExamForm({ exam, classes, onSaved, onCancel }) {
  const isNew = !exam;
  const [form, setForm] = useState(() => ({
    name: exam?.name || '',
    date: exam?.date || todayString(),
    remarks: exam?.remarks || '',
  }));
  const [classIds, setClassIds] = useState(() =>
    exam ? [exam.classId] : classes.length === 1 ? [classes[0].id] : []
  );
  const [classSubjects, setClassSubjects] = useState(null); // null = loading
  // Per subject: { included, maxMarks, passMarks }. Kept while classes are ticked and
  // unticked. passMarks is undefined until the super admin types one: it then follows the
  // maximum (33% of it).
  const [settings, setSettings] = useState(() =>
    Object.fromEntries(
      (exam?.subjects || []).map((s) => [
        s.subjectId,
        { included: true, maxMarks: String(s.maxMarks), passMarks: String(s.passMarks) },
      ])
    )
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getClassSubjects()
      .then(setClassSubjects)
      .catch((err) => setError(err.message));
  }, []);

  const rows = !classSubjects ? null : isNew ? newRows(classIds, classSubjects) : editRows(exam, classSubjects);
  // A subject not touched yet: included with 100 marks when creating, left out when editing.
  const settingOf = (subjectId) => settings[subjectId] || { included: isNew, maxMarks: '100' };

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  // The pass marks shown for a subject: typed by the super admin, or 33% of the maximum.
  function passMarksText(s) {
    if (s.passMarks !== undefined) return s.passMarks;
    const max = Number(s.maxMarks);
    return s.maxMarks !== '' && Number.isInteger(max) && max >= 1 ? String(defaultPassMarks(max)) : '';
  }

  function changeSetting(subjectId, field, value) {
    setSettings({ ...settings, [subjectId]: { ...settingOf(subjectId), [field]: value } });
  }

  function toggleClass(classId, checked) {
    setClassIds(checked ? [...classIds, classId] : classIds.filter((id) => id !== classId));
  }

  const allSelected = classes.length > 0 && classIds.length === classes.length;
  const chosenClasses = classes.filter((c) => classIds.includes(c.id));
  const included = rows ? rows.filter((r) => settingOf(r.subjectId).included) : [];

  // Creating: chosen classes that study none of the included subjects can't get an exam.
  const emptyClasses =
    isNew && classSubjects
      ? chosenClasses.filter((c) => !included.some((r) => r.taughtIn.some((t) => t.classId === c.id)))
      : [];

  // Returns an error message, or '' when the form can be saved.
  function checkForm() {
    if (!form.name.trim()) return 'Exam name is required';
    if (classIds.length === 0) return 'Please choose at least one class';
    if (!form.date) return 'Please choose the exam date';
    if (included.length === 0) return 'Include at least one subject';
    for (const row of included) {
      const text = settingOf(row.subjectId).maxMarks;
      const max = Number(text);
      if (text === '' || !Number.isInteger(max) || max < 1 || max > MAX_SUBJECT_MARKS) {
        return `Maximum marks for ${row.subjectName} must be a whole number from 1 to ${MAX_SUBJECT_MARKS}`;
      }
      const passText = passMarksText(settingOf(row.subjectId));
      const pass = Number(passText);
      if (passText === '' || !Number.isInteger(pass) || pass < 1 || pass > max) {
        return `Pass marks for ${row.subjectName} must be a whole number from 1 to ${max}`;
      }
    }
    if (emptyClasses.length > 0) {
      return `${emptyClasses.map((c) => c.name).join(', ')} ${emptyClasses.length === 1 ? 'has' : 'have'} none of the included subjects`;
    }
    return '';
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const problem = rows ? checkForm() : 'Please wait for the subjects to load';
    setError(problem);
    if (problem) return;

    const body = {
      ...form,
      subjects: included.map((r) => {
        const s = settingOf(r.subjectId);
        return { subjectId: r.subjectId, maxMarks: Number(s.maxMarks), passMarks: Number(passMarksText(s)) };
      }),
    };
    setSaving(true);
    try {
      const saved = isNew ? await createExams({ ...body, classIds }) : await updateExam(exam.id, body);
      onSaved(saved, isNew);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{isNew ? 'Create examination' : 'Edit examination'}</h1>
          <p className="subtitle">
            {isNew
              ? 'Choose one or more classes, then the subjects and their maximum marks'
              : exam.className}
          </p>
        </div>
        <button className="secondary" onClick={onCancel}>
          Back to examinations
        </button>
      </div>

      <form className="card" onSubmit={handleSubmit} noValidate>
        <h2>Examination</h2>
        <div className="form-grid">
          <label>
            Exam name
            <input
              name="name"
              list="exam-names"
              placeholder="e.g. Monthly Test - October"
              value={form.name}
              onChange={handleChange}
              maxLength={80}
              required
              autoFocus={isNew}
            />
            <datalist id="exam-names">
              {EXAM_NAMES.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </label>
          <label>
            Exam date
            <input type="date" name="date" value={form.date} onChange={handleChange} required />
          </label>
          <label>
            Instructions or remarks <span className="note">(optional)</span>
            <input name="remarks" value={form.remarks} onChange={handleChange} maxLength={300} />
          </label>
        </div>

        {isNew ? (
          <fieldset className="class-picker">
            <legend>Classes</legend>
            <label className="check-label select-all">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => setClassIds(e.target.checked ? classes.map((c) => c.id) : [])}
              />
              Select all classes
            </label>
            <div className="class-options">
              {classes.map((c) => (
                <label key={c.id} className="check-label">
                  <input
                    type="checkbox"
                    checked={classIds.includes(c.id)}
                    onChange={(e) => toggleClass(c.id, e.target.checked)}
                  />
                  {c.name}
                </label>
              ))}
            </div>
            <p className="note">
              {classIds.length === 0
                ? 'No class chosen yet.'
                : `${classIds.length} ${classIds.length === 1 ? 'class' : 'classes'} chosen. Each class gets its own examination.`}
            </p>
          </fieldset>
        ) : (
          <p className="note">Class: {exam.className}. The class of an examination can't be changed.</p>
        )}

        <h3>Subjects and maximum marks</h3>
        {classIds.length === 0 && <p className="note">Choose a class to load its subjects.</p>}
        {classIds.length > 0 && !rows && !error && <p className="note">Loading subjects…</p>}
        {rows && classIds.length > 0 && rows.length === 0 && (
          <p className="info">
            {classIds.length === 1 ? 'This class has' : 'These classes have'} no subjects yet. Assign subjects and
            teachers on the Subjects page first.
          </p>
        )}
        {rows && rows.length > 0 && (
          <div className="table-box">
            <table className="subject-rows">
              <thead>
                <tr>
                  <th className="center">Include</th>
                  <th>Subject</th>
                  <th>{isNew && classIds.length > 1 ? 'Classes' : 'Assigned teacher'}</th>
                  <th className="num">Maximum marks</th>
                  <th className="num">Pass marks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const s = settingOf(row.subjectId);
                  const many = isNew && classIds.length > 1;
                  return (
                    <tr key={row.subjectId} className={s.included ? '' : 'muted-row'}>
                      <td className="center">
                        <input
                          type="checkbox"
                          className="row-check"
                          aria-label={`Include ${row.subjectName}`}
                          checked={s.included}
                          disabled={row.hasMarks}
                          title={row.hasMarks ? 'This subject already has marks' : undefined}
                          onChange={(e) => changeSetting(row.subjectId, 'included', e.target.checked)}
                        />
                      </td>
                      <td className="cell-main">
                        {row.subjectName}
                        {row.hasMarks && <div className="cell-sub">Has marks, can't be removed</div>}
                      </td>
                      <td>
                        {many ? (
                          <ClassesCell row={row} chosen={chosenClasses} />
                        ) : (
                          row.taughtIn[0]?.teacherName || <span className="note">Not assigned (super admin enters marks)</span>
                        )}
                      </td>
                      <td className="num">
                        <input
                          aria-label={`Maximum marks for ${row.subjectName}`}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max={MAX_SUBJECT_MARKS}
                          step="1"
                          value={s.maxMarks}
                          disabled={!s.included}
                          onChange={(e) => changeSetting(row.subjectId, 'maxMarks', e.target.value)}
                        />
                      </td>
                      <td className="num">
                        <input
                          aria-label={`Pass marks for ${row.subjectName}`}
                          type="number"
                          inputMode="numeric"
                          min="1"
                          step="1"
                          value={passMarksText(s)}
                          disabled={!s.included}
                          onChange={(e) => changeSetting(row.subjectId, 'passMarks', e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {isNew && rows && rows.length > 0 && (
          <p className="note">
            Every subject is out of 100 with 33 pass marks (33%) unless you change it. Each class gets its own examination with the subjects
            it studies; you can change a class's marks later with Edit exam.
          </p>
        )}
        {emptyClasses.length > 0 && (
          <p className="error">
            {joinNames(emptyClasses.map((c) => c.name))} {emptyClasses.length === 1 ? 'has' : 'have'} none of the
            included subjects. Untick {emptyClasses.length === 1 ? 'it' : 'them'} or include a subject.
          </p>
        )}
        {!isNew && (
          <p className="note">Maximum marks can't go below the highest mark already entered for that subject.</p>
        )}

        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="submit" disabled={saving || !rows || included.length === 0}>
            {saving
              ? 'Saving…'
              : !isNew
                ? 'Save changes'
                : classIds.length > 1
                  ? `Create ${classIds.length} examinations`
                  : 'Create examination'}
          </button>
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
