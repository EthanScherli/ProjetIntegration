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
    } catch (err) {
      setError('Impossible de joindre le serveur.');
    }
  };

  return (
    <div className="register-container">
      <h2>Connexion au Vivarium</h2>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-email">Adresse Email :</label>
          <input
            type="email"
            id="login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="login-password">Mot de passe :</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">Se connecter</button>
      </form>

      <button className="link-button" onClick={onNavigateRegister}>
        Je n'ai pas de compte, m'inscrire
      </button>
    </div>
  );
};

export default Login;
