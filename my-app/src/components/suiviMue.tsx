import { useState, useEffect } from 'react';

interface Mue {
  id_mue: number;
  date_debut: string;
  date_fin: string | null;
  statut: 'EN_COURS' | 'TERMINEE';
}

export const SuiviMue = () => {
  const [mueActive, setMueActive] = useState<Mue | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const chargerMueActive = async () => {
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/active');
      if (!reponse.ok) {
        setErreur('Erreur lors du chargement de la mue');
        setChargement(false);
        return;
      }
      const data = await reponse.json();
      console.log("test")
      setMueActive(data);
    } catch {
      setErreur('Impossible de contacter le serveur');
    } finally {
      setChargement(false);
    }
  };
  useEffect(() =>  {
    chargerMueActive();
  }, []);

  const demarrerMue = async () => {
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/demarrer', { method: 'POST' });
      if (!reponse.ok) throw new Error();
      await chargerMueActive();
    } catch {
      setErreur('Impossible de démarrer la mue');
      setChargement(false);
    }
  };

  const terminerMue = async () => {
    if (!mueActive) return;
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/terminer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_mue: mueActive.id_mue }),
      });
      if (!reponse.ok) throw new Error();
      await chargerMueActive();
    } catch {
      setErreur('Impossible de terminer la mue');
      setChargement(false);
    }
  };

  return (
  <div className="dashboard-card bracket full-width">
    <span className="label">Suivi de la Mue</span>

    {erreur && <div className="msg msg-error">{erreur}</div>}

    <div className="mue-container">
      <div>
        {mueActive ? (
          <span className="status status-warn">
            Mue en cours depuis le {new Date(mueActive.date_debut).toLocaleDateString('fr-FR')} à {new Date(mueActive.date_debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : (
          <span className="status status-ok">Aucune mue en cours</span>
        )}
      </div>

      {/* Bouton d'action dynamique (Déclarer / Terminer) */}
      <button
        className="account-btn mue-btn"
        disabled={chargement}
        onClick={mueActive ? terminerMue : demarrerMue}
      >
        {chargement ? 'Chargement...' : mueActive ? 'Terminer la mue' : 'Déclarer une mue'}
      </button>
    </div>
  </div>
);
}

export default SuiviMue;