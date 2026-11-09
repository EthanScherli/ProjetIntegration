import React, { useState, useEffect } from 'react';

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

  useEffect(() => {
    fetchUserAndFamily();
  }, []);

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
        fetchUserAndFamily();
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Erreur lors de l'ajout.");
      }
    } catch (err) {
      setMessage("Impossible de joindre le serveur.");
    }
  };

  const handleRemoveMember = async (targetPseudo: string) => {
    if (!window.confirm(`Voulez-vous vraiment retirer ${targetPseudo} de la famille ?`)) return;
    try {
      const response = await fetch('/api/family/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pseudo: targetPseudo }),
      });
      if (response.ok) {
        setMessage(`${targetPseudo} a été retiré de la famille.`);
        fetchUserAndFamily();
      } else {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "Erreur lors de la suppression.");
      }
    } catch (err) { setMessage("Impossible de joindre le serveur."); }
  };

  const handleDisbandFamily = async () => {
    if (!window.confirm("⚠ Voulez-vous vraiment dissoudre la famille ? Tous les membres perdront l'accès.")) return;
    try {
      const response = await fetch('/api/family/disband', { method: 'POST' });
      if (response.ok) {
        setMessage("La famille a été dissoute.");
        setFamilyMembers([]);
        fetchUserAndFamily();
      } else {
        setMessage("Erreur lors de la dissolution.");
      }
    } catch (err) { setMessage("Impossible de joindre le serveur."); }
  };

  const handleLeaveFamily = async () => {
    if (!window.confirm("⚠ Voulez-vous vraiment quitter cette famille ? Vous perdrez l'accès au vivarium.")) return;
    try {
      const response = await fetch('/api/family/leave', { method: 'POST' });
      if (response.ok) {
        setMessage("Vous avez quitté la famille.");
        setFamilyMembers([]);
        fetchUserAndFamily();
      } else {
        setMessage("Erreur lors du départ.");
      }
    } catch (err) { setMessage("Impossible de joindre le serveur."); }
  };

  const isCurrentUserChef = familyMembers.some(m => m.pseudo === userInfo?.pseudo && m.isChef);

  return (
    <div className="dashboard-container">
      <button className="link-button back-btn" style={{ marginTop: 0, marginBottom: '1rem' }} onClick={onClose}>
        ← Retour au vivarium
      </button>
      
      <header className="screen-header">
        <h2>Gestion du compte</h2>
      </header>

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

      {familyMembers.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <span className="label">Membres de la famille</span>
          <ul className="users-list" style={{ marginTop: '0.5rem' }}>
            {familyMembers.map((member, index) => (
              <li key={index} className="dashboard-card bracket" style={{ minHeight: 'auto', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="user-pseudo">{member.pseudo}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {member.isChef ? (
                    <span className="user-badge" style={{ color: 'var(--live)', borderColor: 'var(--live)' }}>Chef</span>
                  ) : (
                    <span className="user-badge" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>Membre</span>
                  )}
                  {isCurrentUserChef && !member.isChef && (
                    <button 
                      onClick={() => handleRemoveMember(member.pseudo)}
                      style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.25rem', padding: '0 4px', lineHeight: 1 }}
                      title="Retirer ce membre"
                    >
                      ×
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
            {isCurrentUserChef ? (
              <button onClick={handleDisbandFamily} className="link-button" style={{ color: 'var(--danger)', width: 'auto' }}>
                ⚠ Dissoudre la famille
              </button>
            ) : (
              <button onClick={handleLeaveFamily} className="link-button" style={{ color: 'var(--danger)', width: 'auto' }}>
                ⚠ Quitter la famille
              </button>
            )}
          </div>
        </div>
      )}

      {(isCurrentUserChef || familyMembers.length === 0) && (
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
        </div>
      )}
      
      {message && (
        <div className={`msg ${message.includes('Erreur') || message.includes('Impossible') ? 'msg-error' : 'msg-success'}`} style={{ marginTop: '1rem' }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default AccountManager;