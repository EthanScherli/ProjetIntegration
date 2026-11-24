import { useEffect, useState } from 'react';
import './App.css';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Users from './components/Users';
import Jungle from './components/Jungle';

interface CurrentUser {
  id: string;
  pseudo: string;
  mail: string;
  isAdmin: boolean;
}

function App() {
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [enLigne, setEnLigne] = useState(navigator.onLine);

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

  useEffect(() => {
    const verifierConnexion = async () => {
      if (!navigator.onLine) return setEnLigne(false);
      try {
        const response = await fetch('/api/health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        setEnLigne(response.ok);
      } catch {
        setEnLigne(false);
      }
    };

    verifierConnexion();
    const interval = setInterval(verifierConnexion, 10000);
    window.addEventListener('online', verifierConnexion);
    window.addEventListener('offline', verifierConnexion);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', verifierConnexion);
      window.removeEventListener('offline', verifierConnexion);
    };
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' }).catch(() => {});
    if ('caches' in window) await caches.delete('api');
    setCurrentUser(null);
    setCurrentView('login');
  };

  return (
    <div className="app-wrapper">
      <Jungle />
      {!enLigne && (
        <div className="offline-banner">
          <strong><span className="rec-dot" /> Site hors ligne</strong>
          <span>Pas de connexion internet · affichage des dernières données enregistrées</span>
        </div>
      )}
      <div className="screen" key={currentView}>
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
    </div>
  );
}

export default App;
