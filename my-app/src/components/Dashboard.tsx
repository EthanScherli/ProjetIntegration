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
import SuiviMue from './suiviMue';

const SUPABASE_STORAGE_URL = "https://eimlzbkakcjlletqxoks.supabase.co/storage/v1/object/public/clips";

interface Capteur {
  id_mesure: number;
  temperature: number | null;
  humidite: number | null;
  luminosite: number | null;
  created_at: string;
}

interface ImageHistorique {
  id: string;
  date_creation: string;
  id_cam: string;
  nom_fichier: string;
  chemin_fichier: string;
  id_Ut: string;
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
  const [canEdit, setCanEdit] = useState(true);
  const [periode, setPeriode] = useState<'24h' | 'week'>('24h');
  const [camError, setCamError] = useState(false);

  // Vérification des droits utilisateur au chargement
  useEffect(() => {
    const fetchRights = async () => {
      try {
        const resUser = await fetch('/api/me');
        if (resUser.ok) {
          const userData = await resUser.json();
          setCanEdit(userData.isChef || !userData.hasFamily);
        }
      } catch (err) {
        console.error("Erreur lors de la vérification des droits :", err);
      }
    };
    fetchRights();
  }, []);

  // Récupération des capteurs selon la période
  useEffect(() => {
    const recupCapteurs = async () => {
      try {
        const response = await fetch(`/api/donnees-capteurs/${periode}`, {
          credentials: 'include',
        });
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

  // Récupération de l'historique des vidéos
  const recupCam = async () => {
    try {
      const response = await fetch('/api/historique-images', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP : ${response.status}`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        console.error("Le JSON reçu n'est pas un tableau :", data);
        setImages([]);
        setError("Format de données incorrect.");
        return;
      }

      const videosValides = data.filter((clip: ImageHistorique) =>
        clip.chemin_fichier &&
        clip.chemin_fichier.toLowerCase().endsWith('.mp4')
      );

      // Met à jour l'état seulement si un nouveau clip apparaît pour préserver le lecteur vidéo
      setImages((anciennesImages) => {
        if (
          anciennesImages.length === videosValides.length &&
          anciennesImages[0]?.id === videosValides[0]?.id
        ) {
          return anciennesImages;
        }
        return videosValides;
      });

      setError('');
    } catch (error) {
      console.error("Erreur historique vidéos :", error);
      setError("Impossible de charger les vidéos.");
      setImages([]);
    }
  };

  useEffect(() => {
    recupCam();
    const interval = setInterval(recupCam, 10000);
    return () => clearInterval(interval);
  }, []);

  if (showAccount) {
    return <AccountManager onClose={() => setShowAccount(false)} />;
  }

  const capteursTries = [...capteurs]
    .filter((c) => c.created_at && !isNaN(new Date(c.created_at).getTime()))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const derniere = capteursTries.length > 0 ? capteursTries[capteursTries.length - 1] : undefined;

  const scores = (Object.keys(PLAGES) as (keyof typeof PLAGES)[])
    .filter((cle) => derniere?.[cle] != null)
    .map((cle) => scoreConfort(derniere![cle]!, PLAGES[cle]));

  const confort = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  const donneesGraphique = capteursTries.map((c) => ({
    date: new Date(c.created_at).getTime(),
    temperature: c.temperature,
    humidite: c.humidite,
    luminosite: c.luminosite,
  }));

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
            label="Température"
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
            label="Luminosité"
            unite="%"
            valeur={derniere?.luminosite}
            plage={PLAGES.luminosite}
          />

          <div
            className="dashboard-card bracket cam-card"
            style={{ position: 'relative', overflow: 'hidden', padding: 0 }}
          >
            <span className="cam-scan" style={{ zIndex: 2 }} />

            <span className="label" style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
              <span className="rec-dot" /> Cam 01
            </span>

            {camError && (
              <span className="label status-off blink" style={{ position: 'absolute', bottom: '10px', right: '10px', zIndex: 2 }}>
                Pas de signal
              </span>
            )}

            <img
              src="http://91.176.57.43:18001"
              alt="Flux direct vivarium"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 1,
                display: camError ? 'none' : 'block'
              }}
              onError={() => setCamError(true)}
              onLoad={() => setCamError(false)}
            />
          </div>

          <div className="climate-chart">
            <div className="chart-header">
              <div className="chart-title-group">
                <h2>
                  <span className="chart-live-dot" />
                  Historique des données
                </h2>
                <p className="chart-description">Relevés en temps réel du vivarium</p>
              </div>

              <div className="chart-count">
                <span className="chart-count-value">{donneesGraphique.length}</span>
                <span className="chart-count-label">RELEVÉS</span>
              </div>
            </div>

            <div className="chart-toolbar">
              <span className="chart-period-label">PÉRIODE DE SUIVI</span>
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
            </div>

            <div className="chart-container">
              {donneesGraphique.length === 0 ? (
                <div className="chart-empty">
                  <span className="chart-empty-icon">⤺</span>
                  <strong>Aucune donnée disponible</strong>
                  <span>En attente de réception des mesures des capteurs pour la période sélectionnée.</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={donneesGraphique}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      stroke="var(--text-muted)"
                      tickFormatter={(timestamp) =>
                        new Date(timestamp).toLocaleString('fr-BE', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      }
                    />
                    <YAxis stroke="var(--text-muted)" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--surface)',
                        borderColor: 'var(--border)',
                        color: 'var(--text)',
                      }}
                      labelFormatter={(timestamp) =>
                        new Date(Number(timestamp)).toLocaleString('fr-BE')
                      }
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      name="Température (°C)"
                      stroke="var(--live)"
                      connectNulls
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="humidite"
                      name="Humidité (%)"
                      stroke="#65aaff"
                      connectNulls
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="luminosite"
                      name="Luminosité (%)"
                      stroke="#d4a6ff"
                      connectNulls
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="chart-footer">
              <span>
                <span className="chart-footer-dot" />
                FLUX DE DONNÉES ACTIF
              </span>
              <span>RÉFRECHISSEMENT AUTO (3S)</span>
            </div>
          </div>

          <SuiviMue canEdit={canEdit} />

          {/* HISTORIQUE DES VIDÉOS */}
          <div
            className="dashboard-card bracket full-width"
            style={{ marginTop: '20px' }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '15px'
            }}>
              <span className="label">
                Historique des clips ({images.length}/10)
              </span>

              <span style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)'
              }}>
                10 derniers clips enregistrés
              </span>
            </div>

            {images.length === 0 ? (
              <span className="empty-state">
                Aucun clip disponible
              </span>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '15px',
                maxHeight: '450px',
                overflowY: 'auto',
                width: '100%'
              }}>
                {images.map((clip) => {
                  const videoUrl = `${SUPABASE_STORAGE_URL}/${clip.chemin_fichier}`;

                  return (
                    <div
                      key={clip.id}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        overflow: 'hidden'
                      }}
                    >
                      <video
                        controls
                        preload="metadata"
                        playsInline
                        src={videoUrl}
                        onError={(e) => {
                          console.error(
                            "Erreur lecture vidéo :",
                            clip.nom_fichier,
                            e.currentTarget.error
                          );
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '170px',
                          objectFit: 'contain',
                          backgroundColor: '#000'
                        }}
                      />

                      <div style={{ padding: '10px' }}>
                        <div style={{
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          color: 'var(--text)'
                        }}>
                          {clip.nom_fichier}
                        </div>

                        <div style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          marginTop: '4px'
                        }}>
                          {new Date(clip.date_creation).toLocaleString('fr-BE')}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
};

export default Dashboard;
