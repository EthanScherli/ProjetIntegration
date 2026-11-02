
import { useEffect, useState, type CSSProperties } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import AccountManager from './AccountManager';

interface Capteur {
  id_mesure: number;
  temperature: number | null;
  humidite: number | null;
  luminosite: number | null;
  created_at: string;
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
  const [showAccount, setShowAccount] = useState(false);

  const [capteurs, setCapteurs] = useState<Capteur[]>([]);
  const [images, setImages] = useState<ImageHistorique[]>([]);
  const [error, setError] = useState('');
  const [periode, setPeriode] = useState<'24h' | 'week'>('24h');

  // Récupération des capteurs selon la période choisie
  useEffect(() => {
    const recupCapteurs = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/api/donnees-capteurs/${periode}`,
          {
            credentials: 'include',
          }
        );

        if (!response.ok) {
          throw new Error('Erreur lors de la récupération des capteurs');
        }

        const data: Capteur[] = await response.json();

        setCapteurs(data);
        setError('');
      } catch (err) {
        console.error(err);
        setError('Impossible de récupérer les données des capteurs.');
      }
    };

    recupCapteurs();

    const interval = setInterval(recupCapteurs, 3000);

    return () => clearInterval(interval);
  }, [periode]);

  // Récupération des images : fonctionnement conservé
  const recupCam = async () => {
    try {
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
    recupCam();

    const interval = setInterval(recupCam, 3000);

    return () => clearInterval(interval);
  }, []);

  // Affichage de la gestion du compte
  if (showAccount) {
    return <AccountManager onClose={() => setShowAccount(false)} />;
  }

  // Dernière mesure
  const derniere = capteurs.reduce<Capteur | undefined>(
    (max, c) => (!max || c.id_mesure > max.id_mesure ? c : max),
    undefined
  );

  // Calcul du confort
  const scores = (Object.keys(PLAGES) as (keyof typeof PLAGES)[])
    .filter((cle) => derniere?.[cle] != null)
    .map((cle) => scoreConfort(derniere![cle]!, PLAGES[cle]));

  const confort = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  // Préparation des données du graphique
  const donneesGraphique = capteurs
    .filter((c) => c.created_at && !isNaN(new Date(c.created_at).getTime()))
    .map((c) => ({
      date: new Date(c.created_at).getTime(),
      temperature: c.temperature,
      humidite: c.humidite,
      luminosite: c.luminosite,
    }))
    .sort((a, b) => a.date - b.date);

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
          <SensorCard
            label="Temp"
            unite="°C"
            valeur={derniere?.temperature}
            plage={PLAGES.temperature}
          />

          <SensorCard
            label="Humidité"
            unite="%"
            valeur={derniere?.humidite}
            plage={PLAGES.humidite}
          />

          <SensorCard
            label="Lumière"
            unite="%"
            valeur={derniere?.luminosite}
            plage={PLAGES.luminosite}
          />

          <div className="dashboard-card bracket cam-card">
            <span className="cam-scan" />
            <span className="label">
              <span className="rec-dot" /> Cam 01
            </span>
            <span className="label status-off blink">Pas de signal</span>
          </div>

          {/* Historique des données : graphique */}
          <div className="climate-chart">
            <h2>Historique des données</h2>

            <div className="chart-period-buttons">
              <button
                className={periode === '24h' ? 'active' : ''}
                onClick={() => setPeriode('24h')}
              >
                Dernières 24 heures
              </button>

              <button
                className={periode === 'week' ? 'active' : ''}
                onClick={() => setPeriode('week')}
              >
                7 derniers jours
              </button>
            </div>

            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={donneesGraphique}>
                  <CartesianGrid strokeDasharray="3 3" />

                  <XAxis
                    dataKey="date"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) =>
                      new Date(timestamp).toLocaleString('fr-BE', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }
                  />

                  <YAxis />

                  <Tooltip
                    labelFormatter={(timestamp) =>
                      new Date(Number(timestamp)).toLocaleString('fr-BE')
                    }
                  />

                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Température (°C)"
                    stroke="#ff7300"
                    connectNulls
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="humidite"
                    name="Humidité (%)"
                    stroke="#0088fe"
                    connectNulls
                    dot={false}
                  />

                  <Line
                    type="monotone"
                    dataKey="luminosite"
                    name="Luminosité (%)"
                    stroke="#00c49f"
                    connectNulls
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historique images : conservé */}
          <div className="dashboard-card bracket full-width">
            <span className="label">Historique images</span>

            <span className="empty-state">
              {images.length
                ? `${images.length} images enregistrées`
                : 'Aucune donnée'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
