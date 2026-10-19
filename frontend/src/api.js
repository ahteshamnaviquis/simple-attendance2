// All calls to the backend go through this file.

import { getSavedUser, clearUser } from './session';

async function request(url, options = {}) {
  const user = getSavedUser();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      // Tells the backend who is logged in. Local prototype only - not secure.
      ...(user ? { 'X-User-Id': user.id } : {}),
    },
  });
  const data = await response.json().catch(() => null);

  // The saved user no longer exists (for example the data files were reset).
  if (response.status === 401 && url !== '/api/login') {
    clearUser();
    window.location.reload();
  }
  if (!response.ok) {
    throw new Error((data && data.error) || `Request failed (${response.status})`);
  }
  return data;
}

function send(method, url, body) {
  return request(url, { method, body: JSON.stringify(body) });
}

// Builds "?date=...&classId=..." leaving out empty values.
function queryString(params) {
  const filled = Object.entries(params).filter(([, value]) => value);
  return filled.length ? `?${new URLSearchParams(filled)}` : '';
}

export function getHealth() {
  return request('/api/health');
}

export function login(username, password) {
  return send('POST', '/api/login', { username, password });
}

export function getUsers() {
  return request('/api/users');
}

// Teachers
export function getTeachers() {
  return request('/api/teachers');
}

export function createTeacher(teacher) {
  return send('POST', '/api/teachers', teacher);
}

export function updateTeacher(id, teacher) {
  return send('PUT', `/api/teachers/${id}`, teacher);
}

// Classes
export function getClasses() {
  return request('/api/classes');
}

export function createClass(cls) {
  return send('POST', '/api/classes', cls);
}

export function updateClass(id, cls) {
  return send('PUT', `/api/classes/${id}`, cls);
}

// Students
export function getStudents(filters = {}) {
  return request(`/api/students${queryString(filters)}`);
}

export function createStudent(student) {
  return send('POST', '/api/students', student);
}

export function updateStudent(id, student) {
  return send('PUT', `/api/students/${id}`, student);
}

export function deleteStudent(id) {
  return request(`/api/students/${id}`, { method: 'DELETE' });
}

// Attendance reports
export function getReports(filters = {}) {
  return request(`/api/attendance${queryString(filters)}`);
}

export function getSchoolDays() {
  return request('/api/attendance/school-days');
}

export function getReport(id) {
  return request(`/api/attendance/${id}`);
}

export function createReport(report) {
  return send('POST', '/api/attendance', report);
}

export function updateReport(id, report) {
  return send('PUT', `/api/attendance/${id}`, report);
}
