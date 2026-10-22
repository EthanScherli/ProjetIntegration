import React, { useState, useEffect } from 'react';

interface AccountManagerProps {
  onClose: () => void;
}

const AccountManager = ({ onClose }: AccountManagerProps) => {

  const [userInfo, setUserInfo] = useState<{ pseudo: string; mail: string; famille?: string } | null>(null);
  const [newFamilyMember, setNewFamilyMember] = useState('');
  const [message, setMessage] = useState('');

  //Récup des infos de l'utilisateur connecté
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du compte");
      }
    };
    fetchUser();
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
      
      <h2>Gestion du compte</h2>
      <hr className="dashboard-divider" />

      {userInfo ? (
        <div className="account-details">
          <p><strong>Pseudo :</strong> {userInfo.pseudo}</p>
          <p><strong>Email :</strong> {userInfo.mail}</p>
          {userInfo.famille && (
            <p><strong>Famille :</strong> Vous faites partie de la famille de {userInfo.famille}</p>
          )}
        </div>
      ) : (
        <p style={{ color: '#b3b3b3' }}>Chargement des informations...</p>
      )}

      <hr className="dashboard-divider" style={{ marginTop: '1.5rem' }} />
      
      <h3 style={{ color: '#555', fontSize: '1.2rem', marginBottom: '1rem' }}>Ajouter à la famille</h3>
      <form onSubmit={handleAddFamily}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Entrer le pseudo"
            value={newFamilyMember}
            onChange={(e) => setNewFamilyMember(e.target.value)}
            required
            style={{ padding: '0.75rem', borderRadius: '4px', border: '1px solid #ccc' }}
          />
          <button type="submit" style={{ padding: '0.75rem', backgroundColor: '#4a90e2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Ajouter le membre
          </button>
        </div>
      </form>
      
      {message && <p style={{ marginTop: '1rem', color: message.includes('Erreur') || message.includes('Impossible') ? 'red' : 'green' }}>{message}</p>}
    </div>
  );
};

export default AccountManager;