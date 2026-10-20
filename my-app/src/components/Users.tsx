import { useEffect, useState } from 'react';

interface User {
  id: string;
  pseudo: string;
  mail: string;
  createdAt: string;
  isAdmin: boolean;
}

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/users')
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Erreur lors du chargement.');
        setUsers(data);
      })
      .catch((err: Error) => setError(err.message || 'Impossible de joindre le serveur.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="users-container">
      <header className="screen-header">
        <span className="screen-tag">// Effectifs {!loading && !error && `(${users.length})`}</span>
        <h2>Utilisateurs</h2>
      </header>

      {loading && <p className="empty-state">Chargement…</p>}
      {error && <div className="msg msg-error">{error}</div>}

      <ul className="users-list">
        {users.map((user) => (
          <li key={user.id} className="user-card bracket">
            <div className="user-card-header">
              <span className="user-pseudo">{user.pseudo}</span>
              {user.isAdmin && <span className="user-badge">Admin</span>}
            </div>
            <div className="user-mail">{user.mail}</div>
            <div className="user-date">
              Inscrit le {new Date(user.createdAt).toLocaleDateString('fr-FR')}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Users;
