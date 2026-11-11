// Decides which screen to show:
//   not logged in -> LoginPage
//   superadmin    -> SuperAdminHome (examinations, teachers, admins, settings)
//   admin         -> AdminHome (its menu follows the admin permissions)
//   teacher       -> TeacherHome
//   parent        -> ParentHome (their own children only)
//   owner         -> OwnerHome (the platform owner: academies and their super admins)
//
// It also loads the settings (theme and admin permissions) and shares them.
// Each academy has its own, so they are loaded again when someone logs in or out.
//
// This only decides which screens are shown: the backend checks the login token on every request.

import { useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import AdminHome from './pages/AdminHome.jsx';
import SuperAdminHome from './pages/SuperAdminHome.jsx';
import TeacherHome from './pages/TeacherHome.jsx';
import ParentHome from './pages/ParentHome.jsx';
import OwnerHome from './pages/OwnerHome.jsx';
import { getSavedUser, saveUser, clearUser, saveAcademy } from './session';
import { getSettings, logout } from './api';
import { applyTheme, DEFAULT_SETTINGS, SettingsContext } from './theme';

export default function App() {
  const [user, setUser] = useState(getSavedUser);
  const [settings, setSettings] = useState(null); // null = still loading

  useEffect(() => {
    getSettings()
      .catch(() => DEFAULT_SETTINGS) // backend unreachable: the login page shows the error
      .then(handleSettingsChange);
  }, [user?.id]);

  function handleSettingsChange(newSettings) {
    applyTheme(newSettings.theme);
    setSettings(newSettings);
  }

  function handleLogin(loggedInUser) {
    saveUser(loggedInUser);
    saveAcademy(loggedInUser.academyId); // the login page shows this academy's look next time
    setSettings(null); // wait for this academy's settings (loaded again for the new user)
    setUser(loggedInUser);
  }

  function handleLogout() {
    logout().catch(() => {}); // the token stops working; the screen doesn't wait for it
    clearUser();
    setSettings(null);
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
  } else if (user.role === 'parent') {
    screen = <ParentHome user={user} onLogout={handleLogout} />;
  } else if (user.role === 'owner') {
    screen = <OwnerHome user={user} onLogout={handleLogout} />;
  } else {
    screen = <p className="error">Unknown role: {user.role}</p>;
  }

  return <SettingsContext.Provider value={settings}>{screen}</SettingsContext.Provider>;
}
