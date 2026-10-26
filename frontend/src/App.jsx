// Decides which screen to show:
//   not logged in -> LoginPage
//   superadmin    -> SuperAdminHome (examinations, teachers, admins, settings)
//   admin         -> AdminHome (its menu follows the admin permissions)
//   teacher       -> TeacherHome
//
// It also loads the settings (theme and admin permissions) once and shares them.
//
// NOTE: this only controls which screens are visible. It is NOT real security.

import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import AdminHome from './pages/AdminHome.jsx';
import SuperAdminHome from './pages/SuperAdminHome.jsx';
import TeacherHome from './pages/TeacherHome.jsx';
import { getSavedUser, saveUser, clearUser } from './session';
import { getSettings } from './api';
import { applyTheme, DEFAULT_SETTINGS, SettingsContext } from './theme';

export default function App() {
  const [user, setUser] = useState(getSavedUser);
  const [settings, setSettings] = useState(null); // null = still loading

  useEffect(() => {
    getSettings()
      .catch(() => DEFAULT_SETTINGS) // backend unreachable: the login page shows the error
      .then(handleSettingsChange);
  }, []);

  function handleSettingsChange(newSettings) {
    applyTheme(newSettings.theme);
    setSettings(newSettings);
  }

  function handleLogin(loggedInUser) {
    saveUser(loggedInUser);
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearUser();
    setUser(null);
  }

  // Wait for the settings so the first screen already has the right look and menu.
  if (!settings) return null;

  let screen;
  if (!user) {
    screen = <LoginPage onLogin={handleLogin} />;
  } else if (user.role === 'superadmin') {
    screen = <SuperAdminHome user={user} onLogout={handleLogout} onSettingsSaved={handleSettingsChange} />;
  } else if (user.role === 'admin') {
    screen = <AdminHome user={user} onLogout={handleLogout} />;
  } else if (user.role === 'teacher') {
    screen = <TeacherHome user={user} onLogout={handleLogout} />;
  } else {
    screen = <p className="error">Unknown role: {user.role}</p>;
  }

  return <SettingsContext.Provider value={settings}>{screen}</SettingsContext.Provider>;
}
