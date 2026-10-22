import { useEffect, useState, type CSSProperties } from 'react';
import AccountManager from './AccountManager';

interface Capteur {
  id_mesure: number;
  temperature: number | null;
  humidite: number | null;
  luminosite: number | null;
}

interface ImageHistorique {
  id_img: number;
  image: string; /*pas sur du type pour l'image*/
}

const PLAGES = {
  temperature: { min: 24, max: 30, echelle: [0, 40] },
  humidite: { min: 60, max: 80, echelle: [0, 100] },
  luminosite: { min: 20, max: 90, echelle: [0, 100] },
};

type Plage = (typeof PLAGES)[keyof typeof PLAGES];

const SEGMENTS = 10;

const scoreConfort = (valeur: number, plage: Plage) => {
  const largeur = plage.max - plage.min;
  const ecart = Math.max(plage.min - valeur, valeur - plage.max, 0);
  return Math.max(0, 100 - (ecart / largeur) * 100);
};

interface SensorCardProps {
  label: string;
  unite: string;
  valeur: number | null | undefined;
  plage: Plage;
}

const SensorCard = ({ label, unite, valeur, plage }: SensorCardProps) => {
  const horsLigne = valeur == null;
  const nominal = !horsLigne && valeur >= plage.min && valeur <= plage.max;
  const [bas, haut] = plage.echelle;
  const remplis = horsLigne ? 0 : Math.round(((valeur - bas) / (haut - bas)) * SEGMENTS);
  const statut = horsLigne ? 'status-off' : nominal ? 'status-ok' : 'status-warn';

  return (
    <div className="dashboard-card bracket">
      <span className="label">{label}</span>
      <span className="sensor-value" key={valeur ?? 'off'}>
        {horsLigne ? '--' : valeur}
        <small>{unite}</small>
      </span>
      <div className={`gauge ${statut}`}>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={i < remplis ? 'on' : ''} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <span className={`status ${statut}`}>
        {horsLigne ? 'HORS LIGNE' : nominal ? 'NOMINAL' : 'ALERTE'}
      </span>
    </div>
  );
};

const Dashboard = () => {
  // État pour afficher la gestion du compte
  const [showAccount, setShowAccount] = useState(false);
  
  const [capteurs, setCapteurs] = useState<Capteur[]>([]);
  const [images, setImages] = useState<ImageHistorique[]>([]);
  const [error, setError] = useState('');

  //Recup donnees
  const recupDashboardData = async () => {
    setError('');

    try{
      const reponseCapteurs = await fetch('/api/donnees-capteurs');
      if (!reponseCapteurs.ok) {
        const data = await reponseCapteurs.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors du chargement des capteurs");
        return;
      }
      const capteursData = await reponseCapteurs.json();
      setCapteurs(capteursData);

      const reponseImages = await fetch('/api/historique-images');
      if (!reponseImages.ok) {
        const data = await reponseImages.json().catch(() => ({}));
        setError(data.error ?? ("Erreur lors du chargement de l'historique des images"));
        return;
      }
      const imagesData = await reponseImages.json();
      setImages(imagesData);
    }catch {
      setError('Impossible de communiquer avec le serveur');
    }
  };

  useEffect(() => {
    recupDashboardData();
    const interval = setInterval(recupDashboardData, 3000);
    return () => clearInterval(interval)
  }, []);

  // Si on clique sur le bouton, on affiche le composant de gestion de compte
  if (showAccount) {
    return <AccountManager onClose={() => setShowAccount(false)} />;
  }

  const derniere = capteurs.reduce<Capteur | undefined>(
    (max, c) => (!max || c.id_mesure > max.id_mesure ? c : max),
    undefined,
  );

  const scores = (Object.keys(PLAGES) as (keyof typeof PLAGES)[])
    .filter((cle) => derniere?.[cle] != null)
    .map((cle) => scoreConfort(derniere![cle]!, PLAGES[cle]));
  const confort = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return (
    <>
      <button className="account-btn" onClick={() => setShowAccount(true)}>
        Gestion du compte
      </button>

      <div className="dashboard-container">
        <header className="screen-header">
          <span className="screen-tag">// Vivarium-01</span>
          <h2>Surveillance</h2>
        </header>

        {error && <div className="msg msg-error">{error}</div>}

        <section className="comfort bracket">
          <span className="label">Indice de confort</span>
          <span className="comfort-value" key={confort ?? 'off'}>
            {confort ?? '--'}<small>%</small>
          </span>
        </section>

        <div className="dashboard-grid">
          <SensorCard label="Temp" unite="°C" valeur={derniere?.temperature} plage={PLAGES.temperature} />
          <SensorCard label="Humidité" unite="%" valeur={derniere?.humidite} plage={PLAGES.humidite} />
          <SensorCard label="Lumière" unite="%" valeur={derniere?.luminosite} plage={PLAGES.luminosite} />

          <div className="dashboard-card bracket cam-card">
            <span className="cam-scan" />
            <span className="label"><span className="rec-dot" /> Cam 01</span>
            <span className="label status-off blink">Pas de signal</span>
          </div>

          <div className="dashboard-card bracket full-width">
            <span className="label">Historique capteurs</span>
            <span className="empty-state">
              {capteurs.length ? `${capteurs.length} mesures enregistrées` : 'Aucune donnée'}
            </span>
          </div>
          <div className="dashboard-card bracket full-width">
            <span className="label">Historique images</span>
            <span className="empty-state">
              {images.length ? `${images.length} images enregistrées` : 'Aucune donnée'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;