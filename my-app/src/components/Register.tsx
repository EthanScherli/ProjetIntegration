import React, { useState } from 'react';

const Register = () => {
  const [pseudo, setPseudo] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo, mail: email, mdp: password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors de l'inscription.");
        return;
      }

      setSuccess('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      setPseudo('');
      setEmail('');
      setPassword('');
      setConfirmPassword('');

    } catch {
      setError('Impossible de joindre le serveur.');
    }
  };

  return (
    <div className="panel bracket">
      <header className="screen-header">
        <span className="screen-tag">// Nouvelle recrue</span>
        <h2>Créer un compte</h2>
      </header>

      {error && <div className="msg msg-error">{error}</div>}
      {success && <div className="msg msg-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label className="label" htmlFor="pseudo">Pseudo</label>
          <input
            type="text"
            id="pseudo"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="email">Adresse email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">Mot de passe</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="confirmPassword">Confirmer le mot de passe</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button className="btn" type="submit">S'inscrire</button>
      </form>
    </div>
  );
};

export default Register;
