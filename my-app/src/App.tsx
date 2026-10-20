import { useEffect, useState } from 'react';
import './App.css';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Users from './components/Users';

interface CurrentUser {
  id: string;
  pseudo: string;
  mail: string;
  isAdmin: boolean;
}

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/me');
      if (!response.ok) return;
      setCurrentUser(await response.json());
      setCurrentView('dashboard');
    } catch {
    }
  };

  useEffect(() => {
    loadCurrentUser();
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    setCurrentUser(null);
    setCurrentView('login');
  };

  return (
    <div className="app-wrapper">
      {currentView === 'login' && (
        <Login
          onLogin={loadCurrentUser}
          onNavigateRegister={() => setCurrentView('register')}
        />
      )}

      {currentView === 'register' && (
        <div>
          <Register />
          <button className="link-button back-btn" onClick={() => setCurrentView('login')}>
            ← Retour à la connexion
          </button>
        </div>
      )}

      {currentView === 'dashboard' && (
        <div>
          <Dashboard />
          {currentUser?.isAdmin && (
            <button className="link-button" onClick={() => setCurrentView('users')}>
              Voir les utilisateurs
            </button>
          )}
          <button className="link-button back-btn" onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      )}

      {currentView === 'users' && currentUser?.isAdmin && (
        <div>
          <Users />
          <button className="link-button back-btn" onClick={() => setCurrentView('dashboard')}>
            ← Retour au tableau de bord
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
