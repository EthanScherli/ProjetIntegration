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

interface Plage {
  min: number;
  max: number;
  echelle: [number, number];
  poids: number;
}

const getPlagesActuelles = (estJour: boolean): Record<'temperature' | 'humidite' | 'luminosite', Plage> => ({
  temperature: {
    min: estJour ? 25 : 22,
    max: estJour ? 30 : 26,
    echelle: [0, 40],
    poids: 0.5,
  },
  humidite: {
    min: 60,
    max: 80,
    echelle: [0, 100],
    poids: 0.35,
  },
  luminosite: {
    min: estJour ? 20 : 0,
    max: estJour ? 85 : 10,
    echelle: [0, 100],
    poids: 0.15,
  },
});

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

  // États pour le cycle jour/nuit
  const [heureLever, setHeureLever] = useState<number>(8);
  const [heureCoucher, setHeureCoucher] = useState<number>(20);
  const [paramMessage, setParamMessage] = useState('');

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

  // Récupération des paramètres du cycle jour/nuit
  useEffect(() => {
    const recupParametres = async () => {
      try {
        const res = await fetch('/api/parametres', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setHeureLever(data.heure_lever ?? 8);
            setHeureCoucher(data.heure_coucher ?? 20);
          }
        }
      } catch (err) {
        console.error("Erreur récupération paramètres cycle :", err);
      }
    };
    recupParametres();
  }, []);

  // Sauvegarde du cycle jour/nuit
  const handleSaveCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/parametres', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          heure_lever: Number(heureLever),
          heure_coucher: Number(heureCoucher),
        }),
      });
      if (!res.ok) throw new Error('Erreur sauvegarde');
      setParamMessage('Cycle mis à jour avec succès !');
      setTimeout(() => setParamMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setParamMessage('Erreur lors de la mise à jour.');
    }
  };

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

  const heureActuelle = new Date().getHours();
  const estJour =
    heureLever < heureCoucher
      ? heureActuelle >= heureLever && heureActuelle < heureCoucher
      : heureActuelle >= heureLever || heureActuelle < heureCoucher;

  const plagesActuelles = getPlagesActuelles(estJour);

  const capteursTries = [...capteurs]
    .filter((c) => c.created_at && !isNaN(new Date(c.created_at).getTime()))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const derniere = capteursTries.length > 0 ? capteursTries[capteursTries.length - 1] : undefined;

  const mesuresActives = (Object.keys(plagesActuelles) as (keyof typeof plagesActuelles)[])
    .filter((cle) => derniere?.[cle] != null);

  const poidsTotal = mesuresActives.reduce((acc, cle) => acc + plagesActuelles[cle].poids, 0);

  const confort = mesuresActives.length > 0
    ? Math.round(
        mesuresActives.reduce(
          (acc, cle) => acc + scoreConfort(derniere![cle]!, plagesActuelles[cle]) * plagesActuelles[cle].poids,
          0
        ) / poidsTotal
      )
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
            plage={plagesActuelles.temperature}
          />

          <SensorCard
            label="Humidité"
            unite="%"
            valeur={derniere?.humidite}
            plage={plagesActuelles.humidite}
          />

          <SensorCard
            label="Luminosité"
            unite="%"
            valeur={derniere?.luminosite}
            plage={plagesActuelles.luminosite}
          />

          <div
              className="dashboard-card bracket cam-card"
              style={{position: 'relative', overflow: 'hidden', padding: 0}}
          >
            <span className="cam-scan" style={{zIndex: 2}}/>

            <span className="label" style={{position: 'absolute', top: '10px', left: '10px', zIndex: 2}}>
              <span className="rec-dot"/> Cam 01
            </span>

            {camError && (
                <span className="label status-off blink"
                      style={{position: 'absolute', bottom: '10px', right: '10px', zIndex: 2}}>
                Pas de signal
              </span>
            )}

            <img
                src="/flux-cam"
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
            {/* CARTE DE REGLAGE DU CYCLE JOUR / NUIT PLEINE LARGEUR */}
            <div
                className="dashboard-card bracket full-width"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'}}>
                <span className="label">Cycle Jour / Nuit</span>
                <span className={`status ${estJour ? 'status-ok' : 'status-off'}`}>
                {estJour ? 'JOUR' : 'NUIT'} · {String(heureLever).padStart(2, '0')}H-{String(heureCoucher).padStart(2, '0')}H
              </span>
              </div>

              <form
                  onSubmit={handleSaveCycle}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '14px',
                    width: '100%',
                  }}
              >
                <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(120px, 180px))',
                      gap: '12px',
                      flex: '1 1 260px',
                    }}
                >
                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label
                        htmlFor="heure-lever"
                        style={{fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em'}}
                    >
                      LEVER (0-23H)
                    </label>
                    <input
                        id="heure-lever"
                        type="number"
                        min="0"
                        max="23"
                        disabled={!canEdit}
                        value={heureLever}
                        onChange={(e) => setHeureLever(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text)',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                    />
                  </div>

                  <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                    <label
                        htmlFor="heure-coucher"
                        style={{fontSize: '0.72rem', color: 'var(--text-muted)', letterSpacing: '0.04em'}}
                    >
                      COUCHER (0-23H)
                    </label>
                    <input
                        id="heure-coucher"
                        type="number"
                        min="0"
                        max="23"
                        disabled={!canEdit}
                        value={heureCoucher}
                        onChange={(e) => setHeureCoucher(Number(e.target.value))}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          borderRadius: '4px',
                          color: 'var(--text)',
                          textAlign: 'center',
                          fontWeight: 600,
                        }}
                    />
                  </div>
                </div>

                <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '12px',
                      flex: '1 1 220px',
                    }}
                >
                  {paramMessage ? (
                      <span
                          style={{
                            fontSize: '0.75rem',
                            color: paramMessage.includes('succès') ? '#22c55e' : '#ef4444',
                          }}
                      >
                    {paramMessage}
                  </span>
                  ) : (
                      <span style={{fontSize: '0.72rem', color: 'var(--text-muted)'}}>
                    {canEdit ? 'Plage horaire active' : 'Lecture seule'}
                  </span>
                  )}

                  <button
                      type="submit"
                      disabled={!canEdit}
                      style={{
                        padding: '8px 16px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '4px',
                        cursor: canEdit ? 'pointer' : 'not-allowed',
                        opacity: canEdit ? 1 : 0.6,
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                  >
                    Enregistrer
                  </button>
                </div>
              </form>
            </div>

            <div className="climate-chart">
              <div className="chart-header">
                <div className="chart-title-group">
                  <h2>
                    <span className="chart-live-dot"/>
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
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
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
                        <YAxis stroke="var(--text-muted)"/>
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
                        <Legend/>
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
                <span className="chart-footer-dot"/>
                FLUX DE DONNÉES ACTIF
              </span>
                <span>RÉFRECHISSEMENT AUTO (3S)</span>
              </div>
            </div>

            <SuiviMue canEdit={canEdit}/>

            {/* HISTORIQUE DES VIDÉOS */}
            <div
                className="dashboard-card bracket full-width"
                style={{marginTop: '20px'}}
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

                            <div style={{padding: '10px'}}>
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