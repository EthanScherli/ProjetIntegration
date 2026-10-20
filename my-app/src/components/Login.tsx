import React, { useState } from 'react';

interface LoginProps {
  onLogin: () => void;
  onNavigateRegister: () => void;
}

const Login = ({ onLogin, onNavigateRegister }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mail: email, mdp: password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? 'Erreur lors de la connexion.');
        return;
      }

      onLogin();
    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  return (
    
    <div className="panel bracket">
      <header className="screen-header">
        <span className="screen-tag">// Identification requise</span>
        <h2>Vivarium</h2>
      </header>

      {error && <div className="msg msg-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="login-email">Adresse email</label>
          <input
            type="email"
            id="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="login-password">Mot de passe</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className="btn" type="submit">Se connecter</button>
      </form>

      <button className="link-button" onClick={onNavigateRegister}>
        Je n'ai pas de compte, m'inscrire
      </button>
    </div>
  );
};

export default Login;
