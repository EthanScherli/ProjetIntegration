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
    const reponse = await fetch('/api/mue/active');
    if (reponse.ok) {
      const data = await reponse.json();
      setMueActive(data);
    }
    setChargement(false);
  };

  useEffect(() => {
    chargerMueActive();
  }, []);
}