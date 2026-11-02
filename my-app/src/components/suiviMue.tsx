import { useState, useEffect } from 'react';

interface Mue {
  id_mue: number;
  date_debut: string;
  date_fin: string | null;
  statut: 'EN_COURS' | 'TERMINEE';
}

export const SuiviMue = () => {
  const [mueActive, setMueActive] = useState<Mue | null>(null);
  const [historique, setHistorique] = useState<Mue[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');

  const chargerMueActive = async () => {
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/active');
      if (!reponse.ok) {
        setErreur('Erreur lors du chargement de la mue');
        return;
      }
      const data = await reponse.json();
      setMueActive(data);
    } catch {
      setErreur('Impossible de contacter le serveur');
    } finally {
      setChargement(false);
    }
  };

  const chargerHistorique = async () => {
    try {
      const reponse = await fetch('/api/mue/historique');
      if (reponse.ok) {
        const data = await reponse.json();
        setHistorique(data);
      }
    } catch {
      console.error("Erreur lors de la récupération de l'historique");
    }
  };

  useEffect(() => {
    chargerMueActive();
    chargerHistorique();
  }, []);

  const demarrerMue = async () => {
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/demarrer', { method: 'POST' });
      if (!reponse.ok) throw new Error();
      await chargerMueActive();
      await chargerHistorique();
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
      await chargerHistorique();
    } catch {
      setErreur('Impossible de terminer la mue');
      setChargement(false);
    }
  };

  // Calcul du délai moyen entre 2 mues
  const calculerDelaiMoyen = (): number | null => {
    const muesTerminees = historique
      .filter((m) => m.statut === 'TERMINEE' && m.date_fin)
      .sort((a, b) => new Date(a.date_debut).getTime() - new Date(b.date_debut).getTime());

    if (muesTerminees.length < 2) return null;

    let totalJours = 0;
    let nbIntervalles = 0;

    for (let i = 1; i < muesTerminees.length; i++) {
      const finPrecedente = new Date(muesTerminees[i - 1].date_fin!).getTime();
      const debutSuivante = new Date(muesTerminees[i].date_debut).getTime();
      const diffJours = (debutSuivante - finPrecedente) / (1000 * 60 * 60 * 24);

      if (diffJours >= 0) {
        totalJours += diffJours;
        nbIntervalles++;
      }
    }

    return nbIntervalles > 0 ? Math.round(totalJours / nbIntervalles) : null;
  };

  const delaiMoyen = calculerDelaiMoyen();

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

        <button
          className="account-btn mue-btn"
          disabled={chargement}
          onClick={mueActive ? terminerMue : demarrerMue}
        >
          {chargement ? 'Chargement...' : mueActive ? 'Terminer la mue' : 'Déclarer une mue'}
        </button>
      </div>

      
      <div className="mue-stat-card">
        <span className="mue-stat-label">Fréquence moyenne entre 2 mues :</span>
        <span className="mue-stat-valeur">
          {delaiMoyen !== null ? `~${delaiMoyen} jours` : 'Données insuffisantes (min. 2 mues)'}
        </span>
      </div>

      <hr className="mue-divider" />

      {/* Historique */}
      <div className="mue-historique">
        <span className="label mue-history-title">
          Historique des mues ({historique.length})
        </span>

        {historique.length === 0 ? (
          <p className="empty-state">Aucun historique enregistré.</p>
        ) : (
          <ul className="mue-history-list">
            {historique.map((mue) => {
              const dateDebut = new Date(mue.date_debut).toLocaleDateString('fr-FR');
              const dateFin = mue.date_fin ? new Date(mue.date_fin).toLocaleDateString('fr-FR') : null;

              const dureeJours = mue.date_fin
                ? Math.ceil((new Date(mue.date_fin).getTime() - new Date(mue.date_debut).getTime()) / (1000 * 60 * 60 * 24))
                : null;

              return (
                <li key={mue.id_mue} className="mue-history-item">
                  {mue.statut === 'EN_COURS' ? (
                    <span><strong>En cours</strong> (depuis le {dateDebut})</span>
                  ) : (
                    <span>
                      Du {dateDebut} au {dateFin} — <em>Durée : {dureeJours} jour{dureeJours && dureeJours > 1 ? 's' : ''}</em>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SuiviMue;