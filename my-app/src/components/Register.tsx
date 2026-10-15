import React, { useState } from 'react';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation des mots de passe
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    // Validation basique du mot de passe (optionnel mais recommandé)
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      // TODO: Remplacer par l'appel API réel vers ton backend (ex: avec fetch ou axios)
      /*
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) throw new Error("Erreur lors de l'inscription");
      */

      // Simulation de succès
      setSuccess('Inscription réussie ! Vous pouvez maintenant vous connecter.');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
    } catch (err) {
      setError('Une erreur est survenue lors de la création du compte.');
    }
  };

  return (
    <div className="register-container">
      <h2>Créer un compte Vivarium</h2>
      
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {success && <div style={{ color: 'green' }}>{success}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Adresse Email :</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="password">Mot de passe :</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <div>
          <label htmlFor="confirmPassword">Confirmer le mot de passe :</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">S'inscrire</button>
      </form>
    </div>
  );
};

export default Register;