import React, {useState, useEffect} from 'react';

interface Capteur {
  id_mesure: number;
  temperature: number;
  humidite: number;
  luminosite: number;
}

interface ImageHistorique {
  id_img: number;
  image: string; /*pas sur du type pour l'image*/
}

const Dashboard = () => {
  const [capteurs, setCapteurs] = useState<Capteur[]>([]);
  const [images, setImages] = useState<ImageHistorique[]>([]);
  const [error, setError] = useState('');

  //Recup donnees
  const recupDashboardData = async () => {
    setError('');

    try{
      const reponseCapteurs = await fetch('/api/donnees-capteurs');
      if (reponseCapteurs.ok) {
        const data = await reponseCapteurs.json().catch(() => ({}));
        setError(data.error ?? "Erreur lors du chargement des capteurs");
        return;
      }
      const capteursData = await reponseCapteurs.json();
      setCapteurs(capteursData);

      const reponseImages = await fetch('/api/historique-images');
      if (reponseImages.ok) {
        const data = await reponseImages.json().catch(() => ({}));
        setError(data.error ?? ("Erreur lors du chargement de l'historique des images"));
        return;
      }
      const imagesData = await reponseImages.json();
      setImages(imagesData);
    }catch (err) {
      setError('Impossible de communiquer avec le serveur');
    }

    useEffect(() => {
      recupDashboardData();
      const interval = setInterval(recupDashboardData, 3000);
      return () => clearInterval(interval)
    }, []);
  };

  return (
    <div className="dashboard-container">
      <h2>Dashboard Vivarium</h2>
      {error && <div className='msgErreur'></div> }
      <hr className="dashboard-divider" />
      
      <div className="dashboard-grid">
        <div className="dashboard-card">T°</div>
        <div className="dashboard-card">Humidité</div>
        
        <div className="dashboard-card">
          <span className="blue-link">Cam 1</span>
        </div>
        <div className="dashboard-card">
          <span className="blue-link">Cam 2</span>
        </div>
        
        <div className="dashboard-card full-width">Infos sur Python</div>
        <div className="dashboard-card full-width">Historique</div>
      </div>
    </div>
  );
};

export default Dashboard;