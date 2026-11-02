// All calls to the backend. VITE_API_URL (frontend/.env) is the backend address.

import { getSavedUser, clearUser } from './session';

const API_URL = import.meta.env.VITE_API_URL;

// body is sent as JSON, except a File (an upload), which is sent as it is.
async function request(method, path, body) {
  const user = getSavedUser();
  const isFile = body instanceof File;
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': isFile ? body.type : 'application/json',
      // Tells the backend who is logged in. Prototype only - not secure.
      ...(user && { 'X-User-Id': user.id }),
    },
    body: isFile ? body : body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  // The saved user no longer exists (for example the data was reset).
  if (response.status === 401 && path !== '/api/login') {
    clearUser();
    window.location.reload();
  }
  if (!response.ok) {
    throw new Error(data?.error || `Request failed (${response.status})`);
  }
  return data;
}

// { date: '2026-10-19', classId: '' } -> "?date=2026-10-19" (empty values left out)
function query(params) {
  const text = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  return text ? `?${text}` : '';
}

export const login = (username, password) => request('POST', '/api/login', { username, password });

export const getSettings = () => request('GET', '/api/settings');
export const saveSettings = (settings) => request('PUT', '/api/settings', settings);
export const uploadLogo = (file) => request('PUT', '/api/settings/logo', file);
export const removeLogo = () => request('DELETE', '/api/settings/logo');
// The address of the uploaded logo image; the version makes browsers fetch a new upload.
export const logoUrl = (logo) => `${API_URL}/api/settings/logo?v=${logo.version}`;

export const getAdmins = () => request('GET', '/api/admins');
export const createAdmin = (admin) => request('POST', '/api/admins', admin);
export const updateAdmin = (id, admin) => request('PUT', `/api/admins/${id}`, admin);
export const deleteAdmin = (id) => request('DELETE', `/api/admins/${id}`);

export const getTeachers = () => request('GET', '/api/teachers');
export const createTeacher = (teacher) => request('POST', '/api/teachers', teacher);
export const updateTeacher = (id, teacher) => request('PUT', `/api/teachers/${id}`, teacher);
export const setTeacherDisabled = (id, disabled) =>
  request('POST', `/api/teachers/${id}/${disabled ? 'disable' : 'enable'}`);
export const deleteTeacher = (id) => request('DELETE', `/api/teachers/${id}`);

export const getClasses = () => request('GET', '/api/classes');
export const createClass = (cls) => request('POST', '/api/classes', cls);
export const updateClass = (id, cls) => request('PUT', `/api/classes/${id}`, cls);

export const getStudents = (filters = {}) => request('GET', `/api/students${query(filters)}`);
export const createStudent = (student) => request('POST', '/api/students', student);
export const updateStudent = (id, student) => request('PUT', `/api/students/${id}`, student);
export const deleteStudent = (id) => request('DELETE', `/api/students/${id}`);

export const getReports = (filters = {}) => request('GET', `/api/attendance${query(filters)}`);
export const getSchoolDays = () => request('GET', '/api/attendance/school-days');
export const createReport = (report) => request('POST', '/api/attendance', report);
export const updateReport = (id, report) => request('PUT', `/api/attendance/${id}`, report);

export const getSubjects = () => request('GET', '/api/subjects');
export const createSubject = (subject) => request('POST', '/api/subjects', subject);
export const updateSubject = (id, subject) => request('PUT', `/api/subjects/${id}`, subject);

export const getClassSubjects = (filters = {}) => request('GET', `/api/class-subjects${query(filters)}`);
export const setClassSubjects = (classId, subjects) => request('PUT', `/api/class-subjects/${classId}`, { subjects });

export const getExams = (filters = {}) => request('GET', `/api/exams${query(filters)}`);
export const getMyExamSubjects = () => request('GET', '/api/exams/my-subjects');
export const getExam = (id) => request('GET', `/api/exams/${id}`);
export const createExam = (exam) => request('POST', '/api/exams', exam);
export const createExams = (exam) => request('POST', '/api/exams/bulk', exam); // { ...exam, classIds }
export const updateExam = (id, exam) => request('PUT', `/api/exams/${id}`, exam);
export const deleteExam = (id) => request('DELETE', `/api/exams/${id}`);
export const publishExam = (id) => request('POST', `/api/exams/${id}/publish`);
export const unpublishExam = (id) => request('POST', `/api/exams/${id}/unpublish`);
export const setExamDisabled = (id, disabled) =>
  request('POST', `/api/exams/${id}/${disabled ? 'disable' : 'enable'}`);
export const submitExamSubject = (id, subjectId) => request('POST', `/api/exams/${id}/subjects/${subjectId}/submit`);
export const reopenExamSubject = (id, subjectId) => request('POST', `/api/exams/${id}/subjects/${subjectId}/reopen`);
export const getExamMarks = (id, subjectId) => request('GET', `/api/exams/${id}/marks${query({ subjectId })}`);
export const saveExamMarks = (id, subjectId, marks) => request('PUT', `/api/exams/${id}/marks`, { subjectId, marks });
export const getExamResults = (id) => request('GET', `/api/exams/${id}/results`);

// Parent accounts (admins with the "parents" permission, and the super admin).
// New parents are added with their child: createStudent / updateStudent with { ..., parents }.
export const getParents = () => request('GET', '/api/parents');
export const updateParent = (id, parent) => request('PUT', `/api/parents/${id}`, parent);
export const setParentDisabled = (id, disabled) =>
  request('POST', `/api/parents/${id}/${disabled ? 'disable' : 'enable'}`);
export const deleteParent = (id) => request('DELETE', `/api/parents/${id}`);

// The staff side of the conversations with parents: admins see the school
// office's, teachers their own.
export const getMessageThreads = () => request('GET', '/api/messages');
export const getMessageRecipients = () => request('GET', '/api/messages/parents');
export const getUnreadMessageCount = () => request('GET', '/api/messages/unread');
export const getMessageThread = (parentId) => request('GET', `/api/messages/${parentId}`);
export const sendMessage = (parentIds, body) => request('POST', '/api/messages', { parentIds, body });

// The parent portal: only the logged-in parent's own children.
export const getMyChildren = () => request('GET', '/api/parent/children');
export const getChildAttendance = (studentId, filters = {}) =>
  request('GET', `/api/parent/children/${studentId}/attendance${query(filters)}`);
export const getChildExams = (studentId) => request('GET', `/api/parent/children/${studentId}/exams`);
export const getChildExamResult = (studentId, examId) =>
  request('GET', `/api/parent/children/${studentId}/exams/${examId}`);
// Who the parent can message: the school office and their children's teachers.
export const getMessageContacts = () => request('GET', '/api/parent/contacts');
// One conversation: contact 'school' or a teacher's id.
export const getMyMessages = (contact) => request('GET', `/api/parent/messages${query({ with: contact })}`);
export const getMyUnreadCount = () => request('GET', '/api/parent/messages/unread');
export const sendMyMessage = (to, body) => request('POST', '/api/parent/messages', { to, body });
