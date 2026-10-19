// Decides which screen to show:
//   not logged in -> LoginPage
//   admin         -> AdminHome
//   teacher       -> TeacherHome
//
// NOTE: this only controls which screens are visible. It is NOT real security.

import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import AdminHome from './pages/AdminHome.jsx';
import TeacherHome from './pages/TeacherHome.jsx';
import { getSavedUser, saveUser, clearUser } from './session';

export default function App() {
  const [user, setUser] = useState(getSavedUser);

  function handleLogin(loggedInUser) {
    saveUser(loggedInUser);
    setUser(loggedInUser);
  }

  function handleLogout() {
    clearUser();
    setUser(null);
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }
  if (user.role === 'admin') {
    return <AdminHome user={user} onLogout={handleLogout} />;
  }
  if (user.role === 'teacher') {
    return <TeacherHome user={user} onLogout={handleLogout} />;
  }
  return <p className="error">Unknown role: {user.role}</p>;
}
