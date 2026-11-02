import React, { useState, useEffect } from 'react';

// Interface pour typer les membres de la famille
interface FamilyMember {
  pseudo: string;
  isChef: boolean;
}

interface AccountManagerProps {
  onClose: () => void;
}

const AccountManager = ({ onClose }: AccountManagerProps) => {
  const [userInfo, setUserInfo] = useState<{ pseudo: string; mail: string; famille?: string } | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [newFamilyMember, setNewFamilyMember] = useState('');
  const [message, setMessage] = useState('');

  // Fonction pour récupérer les données de l'utilisateur ET de sa famille
  const fetchUserAndFamily = async () => {
    try {
      const resUser = await fetch('/api/me');
      if (resUser.ok) setUserInfo(await resUser.json());

      const resFamily = await fetch('/api/family/members');
      if (resFamily.ok) setFamilyMembers(await resFamily.json());
    } catch (error) {
      console.error("Erreur lors de la récupération des données");
    }
  };

  // Chargement initial
  useEffect(() => {
    fetchUserAndFamily();
  }, []);

  // Fonction pour envoyer le pseudo au serveur
  const handleAddFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/family/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: newFamilyMember }),
      });

      if (response.ok) {
        setMessage(`${newFamilyMember} a été ajouté à votre famille !`);
        setNewFamilyMember('');
        // On rafraîchit la liste immédiatement après un ajout réussi
        fetchUserAndFamily();
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Erreur lors de l'ajout.");
      }
    } catch (err) {
      setMessage("Impossible de joindre le serveur.");
    }
  };

  return (
    <div className="dashboard-container">
      <button className="link-button back-btn" style={{ marginTop: 0, marginBottom: '1rem' }} onClick={onClose}>
        ← Retour au vivarium
      </button>
      
      <header className="screen-header">
        <h2>Gestion du compte</h2>
      </header>

      {/* Informations de l'utilisateur */}
      <div className="dashboard-card bracket">
        {userInfo ? (
          <div className="account-details">
            <p><strong>Pseudo :</strong> <span className="user-pseudo">{userInfo.pseudo}</span></p>
            <p><strong>Email :</strong> {userInfo.mail}</p>
          </div>
        ) : (
          <p className="empty-state">Chargement des informations...</p>
        )}
      </div>

      {/* Liste des membres de la famille */}
      {familyMembers.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <span className="label">Membres de la famille</span>
          <ul className="users-list" style={{ marginTop: '0.5rem' }}>
            {familyMembers.map((member, index) => (
              <li key={index} className="dashboard-card bracket" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="user-pseudo">{member.pseudo}</span>
                {member.isChef ? (
                  <span className="user-badge" style={{ color: 'var(--live)', borderColor: 'var(--live)' }}>Chef</span>
                ) : (
                  <span className="user-badge" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Membre</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div style={{ marginTop: '2rem' }}>
        <span className="label">Ajouter à la famille</span>
        <form onSubmit={handleAddFamily} style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Entrer le pseudo"
              value={newFamilyMember}
              onChange={(e) => setNewFamilyMember(e.target.value)}
              required
              style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text)' }}
            />
            <button type="submit" className="btn">
              Ajouter le membre
            </button>
          </div>
        </form>
        
        {/* Message de succès ou d'erreur */}
        {message && (
          <div className={`msg ${message.includes('Erreur') || message.includes('Impossible') ? 'msg-error' : 'msg-success'}`} style={{ marginTop: '1rem' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountManager;