import React from 'react';

interface LoginProps {
  onLogin: () => void;
  onNavigateRegister: () => void;
}

const Login = ({ onLogin, onNavigateRegister }: LoginProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simulation de connexion : redirige directement vers le tableau de bord
    onLogin();
  };

  return (
    <div className="register-container">
      <h2>Connexion au Vivarium</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="login-email">Adresse Email :</label>
          <input type="email" id="login-email" required />
        </div>
        <div>
          <label htmlFor="login-password">Mot de passe :</label>
          <input type="password" id="login-password" required />
        </div>
        <button type="submit">Se connecter</button>
      </form>
      
      {/* Bouton pour aller vers la page d'inscription */}
      <button className="link-button" onClick={onNavigateRegister}>
        Je n'ai pas de compte, m'inscrire
      </button>
    </div>
  );
};

export default Login;