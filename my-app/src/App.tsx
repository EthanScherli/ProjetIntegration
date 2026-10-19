import { useState } from 'react';
import './App.css';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  // Par défaut, on affiche la page de login ('login', 'register', ou 'dashboard')
  const [currentView, setCurrentView] = useState('login');

  return (
    <div className="app-wrapper">
      {currentView === 'login' && (
        <Login 
          onLogin={() => setCurrentView('dashboard')} 
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
          <button className="link-button back-btn" onClick={() => setCurrentView('login')}>
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export default App;