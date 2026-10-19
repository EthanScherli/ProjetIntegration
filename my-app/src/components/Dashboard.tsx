const Dashboard = () => {
  return (
    <div className="dashboard-container">
      <h2>Python va bien</h2>
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