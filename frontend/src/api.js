// All calls to the backend. VITE_API_URL (frontend/.env) is the backend address.

import { getSavedUser, clearUser } from './session';

const API_URL = import.meta.env.VITE_API_URL;

async function request(method, path, body) {
  const user = getSavedUser();
  const response = await fetch(API_URL + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Tells the backend who is logged in. Prototype only - not secure.
      ...(user && { 'X-User-Id': user.id }),
    },
    body: body && JSON.stringify(body),
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

export const getTeachers = () => request('GET', '/api/teachers');
export const createTeacher = (teacher) => request('POST', '/api/teachers', teacher);
export const updateTeacher = (id, teacher) => request('PUT', `/api/teachers/${id}`, teacher);

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
