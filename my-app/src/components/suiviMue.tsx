import { useState, useEffect } from 'react';

interface SuiviMueProps {
  canEdit?: boolean;
}

interface Mue {
  id_mue: number;
  date_debut: string;
  date_fin: string | null;
  statut: 'EN_COURS' | 'TERMINEE';
}

export const SuiviMue = ({ canEdit = true }: SuiviMueProps) => {
  const [mueActive, setMueActive] = useState<Mue | null>(null);
  const [historique, setHistorique] = useState<Mue[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState('');
  const [afficherAjoutManuel, setAfficherAjoutManuel] = useState(false);
  const [dateDebutManuel, setDateDebutManuel] = useState('');
  const [dateFinManuel, setDateFinManuel] = useState('');

  const formaterDateHeure = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  };

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
        // 1. Sécurité : Toujours s'assurer qu'il s'agit d'un tableau
        setHistorique(Array.isArray(data) ? data : []);
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
      if (!reponse.ok) {
        // 2. Affiche le message d'erreur exact envoyé par le backend Express
        const dataErr = await reponse.json().catch(() => ({}));
        throw new Error(dataErr.error || 'Impossible de démarrer la mue');
      }
      await chargerMueActive();
      await chargerHistorique();
    } catch (err: any) {
      setErreur(err.message || 'Impossible de démarrer la mue');
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
      if (!reponse.ok) {
        const dataErr = await reponse.json().catch(() => ({}));
        throw new Error(dataErr.error || 'Impossible de terminer la mue');
      }
      await chargerMueActive();
      await chargerHistorique();
    } catch (err: any) {
      setErreur(err.message || 'Impossible de terminer la mue');
      setChargement(false);
    }
  };

  const ajouterMueManuelle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateDebutManuel || !dateFinManuel) return;
    setChargement(true);
    setErreur('');
    try {
      const reponse = await fetch('/api/mue/ajouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_debut: new Date(dateDebutManuel).toISOString(),
          date_fin: new Date(dateFinManuel).toISOString(),
        }),
      });
      if (!reponse.ok) {
        const dataErr = await reponse.json().catch(() => ({}));
        throw new Error(dataErr.error || "Impossible d'ajouter la mue");
      }
      setDateDebutManuel('');
      setDateFinManuel('');
      setAfficherAjoutManuel(false);
      await chargerHistorique();
    } catch (err: any) {
      setErreur(err.message || "Impossible d'ajouter la mue");
    } finally {
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
              Mue en cours depuis le {formaterDateHeure(mueActive.date_debut)}
            </span>
          ) : (
            <span className="status status-ok">Aucune mue en cours</span>
          )}
        </div>

        <div className="mue-actions">
          <button
            className="account-btn mue-btn"
            disabled={chargement || !canEdit}
            onClick={mueActive ? terminerMue : demarrerMue}
          >
            {chargement ? 'Chargement...' : mueActive ? 'Terminer la mue' : 'Déclarer une mue'}
          </button>

          <button
            type="button"
            className="account-btn mue-btn"
            disabled={chargement || !canEdit}
            onClick={() => {
              setErreur('');
              setAfficherAjoutManuel(!afficherAjoutManuel);
            }}
          >
            {afficherAjoutManuel ? 'Annuler' : '+ Ajouter manuellement'}
          </button>
        </div>
      </div>

      {afficherAjoutManuel && (
        <form className="mue-form" onSubmit={ajouterMueManuelle}>
          <label>
            <span>Début :</span>
            <input
              type="datetime-local"
              step="1"
              value={dateDebutManuel}
              onChange={(e) => setDateDebutManuel(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Fin :</span>
            <input
              type="datetime-local"
              step="1"
              value={dateFinManuel}
              onChange={(e) => setDateFinManuel(e.target.value)}
              required
            />
          </label>

          <button
            type="submit"
            className="account-btn mue-btn"
            disabled={chargement || !canEdit}
          >
            Enregistrer
          </button>
        </form>
      )}

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
              const dateDebut = formaterDateHeure(mue.date_debut);
              const dateFin = mue.date_fin ? formaterDateHeure(mue.date_fin) : null;

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