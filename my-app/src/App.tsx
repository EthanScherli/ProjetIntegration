import { useEffect, useState } from 'react'
import './App.css'

type ApiStatus = 'loading' | 'ok' | 'error'

const statusLabel: Record<ApiStatus, string> = {
  loading: 'Connexion au serveur…',
  ok: 'Serveur connecté',
  error: 'Serveur injoignable',
}

function App() {
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
}

export default App
