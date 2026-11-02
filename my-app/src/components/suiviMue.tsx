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
      setMueActive(data);
    } catch {
      setErreur('Impossible de contacter le serveur');
    } finally {
      setChargement(false);
    }
  };

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
}