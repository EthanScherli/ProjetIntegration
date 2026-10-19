<<<<<<< HEAD
import { useEffect, useState } from 'react'
import './App.css'
=======
import { useState } from 'react';
import './App.css';
import Register from './components/Register';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
>>>>>>> 45d4dc2a6ae9e1992796e49e866d7b7bc98075ba

type ApiStatus = 'loading' | 'ok' | 'error'

const statusLabel: Record<ApiStatus, string> = {
  loading: 'Connexion au serveur…',
  ok: 'Serveur connecté',
  error: 'Serveur injoignable',
}

function App() {
<<<<<<< HEAD
  const [status, setStatus] = useState<ApiStatus>('loading')

  const checkApi = () => {
    setStatus('loading')
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setStatus(data.ok ? 'ok' : 'error'))
      .catch(() => setStatus('error'))
  }

  useEffect(checkApi, [])

  return (
    <main className="app">
      <header className="app-header">
        <img src="/pwa-192x192.png" alt="" className="app-logo" />
        <h1>Projet Intégration</h1>
        <p className="subtitle">Bienvenue !</p>
      </header>

      <section className="card">
        <h2>État</h2>
        <p className={`status status-${status}`}>
          <span className="dot" aria-hidden="true" />
          {statusLabel[status]}
        </p>
        <button type="button" onClick={checkApi} disabled={status === 'loading'}>
          Vérifier
        </button>
      </section>
    </main>
  )
=======
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
>>>>>>> 45d4dc2a6ae9e1992796e49e866d7b7bc98075ba
}

export default App;