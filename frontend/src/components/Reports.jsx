// List of attendance reports with filters, a detail panel, edit and print.
// Used by both admins (all classes) and teachers (the backend only returns
// reports for their own classes).

import { useEffect, useState } from 'react';
import { getClasses, getReports } from '../api';
import AttendanceForm from './AttendanceForm.jsx';
import ReportDetails from './ReportDetails.jsx';
import Icon from './Icon.jsx';
import { attendanceRate, formatMediumDate, lateInfo, weekdayName } from '../utils';

export default function Reports({ user }) {
  const isAdmin = user.role === 'admin';
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

  // Print only the open report (CSS hides the list while body has this class).
  function printReport() {
    document.body.classList.add('print-detail');
    window.print();
    document.body.classList.remove('print-detail');
  }

  if (mode === 'edit' && selected) {
    return (
      <>
        <div className="page-title">
          <div>
            <h1>Edit report</h1>
            <p className="subtitle">
              {selected.className} · {formatMediumDate(selected.date)}
            </p>
          </div>
          <button className="secondary" onClick={() => setMode('view')}>
            Back to reports
          </button>
        </div>
        <AttendanceForm
          classes={classes}
          report={selected}
          onSaved={handleSaved}
          onCancel={() => setMode('view')}
        />
      </>
    );
  }

  const totalPresent = reports.reduce((sum, r) => sum + r.present, 0);
  const totalAbsent = reports.reduce((sum, r) => sum + r.absent, 0);
  const lateCount = reports.filter((r) => lateInfo(r)).length;
  const className = classes.find((c) => c.id === filters.classId)?.name;
  const showPanel = mode === 'view' && selected;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>{isAdmin ? 'Attendance reports' : 'My reports'}</h1>
          <p className="subtitle no-print">Every daily report, newest first</p>
        </div>
        <button className="secondary" onClick={() => window.print()}>
          <span className="rate-cell">
            <Icon name="print" />
            Print list
          </span>
        </button>
      </div>

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
      </div>

      <div className="print-only">
        <h2>Attendance Reports</h2>
        <p>
          Date: {filters.date || 'All dates'} · Class: {className || 'All classes'} · Printed{' '}
          {new Date().toLocaleString()}
        </p>
      </div>

      <div className="totals">
        <div className="total">
          Reports <strong>{reports.length}</strong>
        </div>
        <div className="total">
          Present <strong>{totalPresent}</strong>
        </div>
        <div className="total">
          Absent <strong>{totalAbsent}</strong>
        </div>
        {isAdmin && (
          <div className="total">
            Submitted late <strong>{lateCount}</strong>
          </div>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="reports-layout">
        <div className="reports-list table-box">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Class</th>
                <th>Attendance</th>
                <th>Absent students</th>
                {isAdmin && <th>Status</th>}
                <th className="no-print num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => {
                const late = lateInfo(r);
                return (
                  <tr key={r.id} className={showPanel && selected.id === r.id ? 'selected-row' : ''}>
                    <td className="nowrap">
                      <div className="cell-main">{formatMediumDate(r.date)}</div>
                      <div className="cell-sub">{weekdayName(r.date)}</div>
                    </td>
                    <td>
                      <div className="cell-main">{r.className}</div>
                      <div className="cell-sub">{r.teacherName || 'No teacher'}</div>
                    </td>
                    <td className="nowrap">
                      <div className="rate-cell">
                        <div className="meter small" aria-hidden="true">
                          <div
                            className="meter-fill"
                            style={{ width: `${attendanceRate(r.present, r.absent) || 0}%` }}
                          />
                        </div>
                        <span>
                          <strong>{r.present}</strong>/{r.totalStudents}
                        </span>
                      </div>
                    </td>
                    <td className="absent-names">
                      {r.absentees.map((a) => (a.reason ? `${a.name} (${a.reason})` : a.name)).join(', ') ||
                        (r.absent > 0 ? `${r.absent} not identified` : '—')}
                    </td>
                    {isAdmin && (
                      <td>
                        {late ? (
                          <span className="badge late" title={late}>
                            <Icon name="clock" size={13} strokeWidth={2.6} />
                            Late
                          </span>
                        ) : (
                          <span className="badge good">
                            <Icon name="check" size={13} strokeWidth={3} />
                            On time
                          </span>
                        )}
                      </td>
                    )}
                    <td className="no-print nowrap num">
                      <button className="secondary small" onClick={() => openReport(r, 'view')}>
                        View
                      </button>{' '}
                      <button className="secondary small" onClick={() => openReport(r, 'edit')}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
              {reports.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5}>No reports found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {showPanel && (
          <ReportDetails
            report={selected}
            showLate={isAdmin}
            onEdit={() => setMode('edit')}
            onPrint={printReport}
            onClose={() => setMode('list')}
          />
        )}
      </div>
    </>
  );
}
