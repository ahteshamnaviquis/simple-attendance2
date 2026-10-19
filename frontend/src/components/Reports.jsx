// List of attendance reports with filters, view, edit and print.
// Used by both admins (all classes) and teachers (the backend only returns
// reports for their own classes).

import { useEffect, useState } from 'react';
import { getClasses, getReports } from '../api';
import AttendanceForm from './AttendanceForm.jsx';
import ReportDetails from './ReportDetails.jsx';
import { lateInfo } from '../utils';

export default function Reports({ user }) {
  const [classes, setClasses] = useState([]);
  const [filters, setFilters] = useState({ date: '', classId: '' });
  const [reports, setReports] = useState([]);
  const [mode, setMode] = useState('list'); // 'list' | 'view' | 'edit'
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getClasses()
      .then(setClasses)
      .catch((err) => setError(err.message));
  }, []);

  function loadReports() {
    getReports(filters)
      .then(setReports)
      .catch((err) => setError(err.message));
  }

  useEffect(loadReports, [filters]);

  function handleFilterChange(event) {
    setFilters({ ...filters, [event.target.name]: event.target.value });
  }

  function openReport(report, newMode) {
    setSelected(report);
    setMode(newMode);
  }

  function handleSaved(saved) {
    setSelected(saved);
    loadReports();
  }

  // One report: view or edit
  if (mode === 'view' && selected) {
    return (
      <div>
        <div className="actions no-print">
          <button className="secondary" onClick={() => setMode('list')}>
            ← Back to list
          </button>
          <button onClick={() => setMode('edit')}>Edit</button>
          <button className="secondary" onClick={() => window.print()}>
            Print
          </button>
        </div>
        <ReportDetails report={selected} />
      </div>
    );
  }

  if (mode === 'edit' && selected) {
    return (
      <AttendanceForm
        classes={classes}
        report={selected}
        onSaved={handleSaved}
        onCancel={() => setMode('view')}
      />
    );
  }

  // The list
  const totalPresent = reports.reduce((sum, r) => sum + r.present, 0);
  const totalAbsent = reports.reduce((sum, r) => sum + r.absent, 0);
  const totalStudents = reports.reduce((sum, r) => sum + r.totalStudents, 0);
  const className = classes.find((c) => c.id === filters.classId)?.name;

  return (
    <div>
      <h1 className="no-print">{user.role === 'admin' ? 'Attendance reports' : 'My reports'}</h1>

      <div className="filters no-print">
        <label>
          Date
          <input type="date" name="date" value={filters.date} onChange={handleFilterChange} />
        </label>
        <label>
          Class
          <select name="classId" value={filters.classId} onChange={handleFilterChange}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <button className="secondary" onClick={() => setFilters({ date: '', classId: '' })}>
          Clear filters
        </button>
        <button onClick={() => window.print()}>Print list</button>
      </div>

      <div className="print-only">
        <h2>Attendance Reports</h2>
        <p>
          Date: {filters.date || 'All dates'} · Class: {className || 'All classes'} · Printed{' '}
          {new Date().toLocaleString()}
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Class</th>
            <th>Teacher</th>
            <th>Total</th>
            <th>Present</th>
            <th>Absent</th>
            <th>Added</th>
            <th>Left</th>
            <th>Absent students</th>
            <th className="no-print"></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id}>
              <td className="nowrap">
                {r.date}
                {user.role === 'admin' && lateInfo(r) && (
                  <>
                    {' '}
                    <span className="badge late" title={lateInfo(r)}>
                      ⏱ Late
                    </span>
                  </>
                )}
              </td>
              <td>{r.className}</td>
              <td>{r.teacherName || '—'}</td>
              <td>{r.totalStudents}</td>
              <td>{r.present}</td>
              <td>{r.absent}</td>
              <td>{r.addedToday}</td>
              <td>{r.leftToday}</td>
              <td className="absent-names">
                {r.absentees.map((a) => (a.reason ? `${a.name} (${a.reason})` : a.name)).join(', ') ||
                  '—'}
              </td>
              <td className="no-print nowrap">
                <button className="secondary small" onClick={() => openReport(r, 'view')}>
                  View
                </button>{' '}
                <button className="secondary small" onClick={() => openReport(r, 'edit')}>
                  Edit
                </button>
              </td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr>
              <td colSpan="10">No reports found.</td>
            </tr>
          )}
        </tbody>
        {reports.length > 0 && (
          <tfoot>
            <tr>
              <th colSpan="3">Totals ({reports.length} reports)</th>
              <th>{totalStudents}</th>
              <th>{totalPresent}</th>
              <th>{totalAbsent}</th>
              <th colSpan="4"></th>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
