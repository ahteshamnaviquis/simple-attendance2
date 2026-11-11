// All calls to the backend. VITE_API_URL (frontend/.env) is the backend address.

import { getSavedUser, clearUser, getSavedAcademy } from './session';

const API_URL = import.meta.env.VITE_API_URL;

// body is sent as JSON, except a File (an upload), which is sent as it is.
async function request(method, path, body) {
  const user = getSavedUser();
  const isFile = body instanceof File;
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': isFile ? body.type : 'application/json',
      // The login token from /api/login: tells the backend who is logged in.
      ...(user?.token && { Authorization: `Bearer ${user.token}` }),
      // Before login: which academy's look to show (see session.js).
      ...(!user && getSavedAcademy() && { 'X-Academy-Id': getSavedAcademy() }),
    },
    body: isFile ? body : body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  // Logged out: the session ended (expired, password changed, account
  // disabled or removed), or this tab saved its user before logins had tokens.
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

// Both return the user with their login token (kept in session.js).
export const login = (username, password) => request('POST', '/api/login', { username, password });
// Ends the session on the server: the token stops working.
export const logout = () => request('POST', '/api/logout');
// Demo quick login (only when the backend has DEMO_LOGIN=true).
export const getDemoLogins = () => request('GET', '/api/demo-login');
export const demoLogin = (userId) => request('POST', '/api/demo-login', { userId });

export const getSettings = () => request('GET', '/api/settings');
export const saveSettings = (settings) => request('PUT', '/api/settings', settings);
export const uploadLogo = (file) => request('PUT', '/api/settings/logo', file);
export const removeLogo = () => request('DELETE', '/api/settings/logo');
// The address of the uploaded logo image; the version makes browsers fetch a new upload.
// An <img> sends no login, so the address names the academy.
export const logoUrl = (logo, academyId) =>
  `${API_URL}/api/settings/logo${query({ v: logo.version, academy: academyId })}`;

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

// ---------- Diary, leaves, complaints & suggestions, gallery ----------

export const getDiary = (filters = {}) => request('GET', `/api/diary${query(filters)}`); // { from, to, classId, studentId }
export const getDiaryOptions = () => request('GET', '/api/diary/options');
export const createDiaryEntry = (entry) => request('POST', '/api/diary', entry);
export const updateDiaryEntry = (id, entry) => request('PUT', `/api/diary/${id}`, entry);
export const deleteDiaryEntry = (id) => request('DELETE', `/api/diary/${id}`);

export const getLeaves = (filters = {}) => request('GET', `/api/leaves${query(filters)}`); // { status, classId, studentId }
export const getPendingLeaveCount = () => request('GET', '/api/leaves/pending-count');
export const applyForLeave = (leave) => request('POST', '/api/leaves', leave);
export const reviewLeave = (id, status, note) => request('POST', `/api/leaves/${id}/review`, { status, note });
export const withdrawLeave = (id) => request('DELETE', `/api/leaves/${id}`);

export const getFeedback = (filters = {}) => request('GET', `/api/feedback${query(filters)}`); // { kind, status }
export const getOpenFeedbackCount = () => request('GET', '/api/feedback/open-count');
export const sendFeedback = (item) => request('POST', '/api/feedback', item);
export const replyToFeedback = (id, reply, status) => request('POST', `/api/feedback/${id}/reply`, { reply, status });
export const deleteFeedback = (id) => request('DELETE', `/api/feedback/${id}`);

export const getAlbums = () => request('GET', '/api/gallery/albums');
export const getAlbum = (id) => request('GET', `/api/gallery/albums/${id}`);
export const createAlbum = (album) => request('POST', '/api/gallery/albums', album);
export const updateAlbum = (id, album) => request('PUT', `/api/gallery/albums/${id}`, album);
export const deleteAlbum = (id) => request('DELETE', `/api/gallery/albums/${id}`);
export const uploadPhoto = (albumId, file) => request('POST', `/api/gallery/albums/${albumId}/photos`, file);
export const deletePhoto = (id) => request('DELETE', `/api/gallery/photos/${id}`);
// The address of a photo (works in an <img>, which can't send the login header).
export const photoUrl = (id) => `${API_URL}/api/gallery/photos/${id}/image`;

// ---------- The platform owner: academies and their super admins ----------

export const getAcademies = () => request('GET', '/api/platform/academies');
// { name, superAdmin: { name, username, password } }
export const createAcademy = (academy) => request('POST', '/api/platform/academies', academy);
export const renameAcademy = (id, name) => request('PUT', `/api/platform/academies/${id}`, { name });
export const setAcademyDisabled = (id, disabled) =>
  request('POST', `/api/platform/academies/${id}/${disabled ? 'disable' : 'enable'}`);
export const createAcademySuperAdmin = (academyId, account) =>
  request('POST', `/api/platform/academies/${academyId}/super-admins`, account);
export const updateAcademySuperAdmin = (id, account) => request('PUT', `/api/platform/super-admins/${id}`, account);
export const deleteAcademySuperAdmin = (id) => request('DELETE', `/api/platform/super-admins/${id}`);

// ---------- Profile photos (teachers, students, parents) ----------

// kind: 'teachers', 'students' or 'parents'. file: the image (File), or null to
// remove the photo. Returns the saved teacher, student or parent.
export const setPhoto = (kind, id, file) =>
  file ? request('PUT', `/api/${kind}/${id}/photo`, file) : request('DELETE', `/api/${kind}/${id}/photo`);
// The address of a photo ({ key }) of the academy (works in an <img>).
export const profilePhotoUrl = (academyId, photo) => `${API_URL}/api/photos/${academyId}/${photo.key}`;
