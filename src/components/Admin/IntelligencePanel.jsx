import React, { useState, useEffect } from 'react';

const IntelligencePanel = ({ token }) => {
  const [scrapes, setScrapes] = useState([]);
  const [prospects, setProspects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scrapeForm, setScrapeForm] = useState({
    target_type: 'competitor',
    target_name: '',
    platform: 'linkedin'
  });

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [scrapesRes, prospectsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/intelligence/scrapes`, { headers }),
        fetch(`${API_URL}/api/v1/intelligence/prospects`, { headers })
      ]);

      if (scrapesRes.ok) { const data = await scrapesRes.json(); setScrapes(data.scrapes || []); }
      if (prospectsRes.ok) { const data = await prospectsRes.json(); setProspects(data.prospects || []); }
    } catch (error) {
      console.error('Error cargando intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  const iniciarScrape = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/intelligence/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scrapeForm)
      });

      if (res.ok) {
        alert('Scraping iniciado - Worker ZEBALLOS procesando...');
        setScrapeForm({ target_type: 'competitor', target_name: '', platform: 'linkedin' });
        setTimeout(cargarDatos, 2000);
      }
    } catch (error) {
      alert('Error al iniciar scraping');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Intelligence - ZEBALLOS v2</h2>

      {/* Nuevo Scrape */}
      <div className="bg-slate-800 rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4 text-white">Nuevo Scraping</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Tipo</label>
            <select
              value={scrapeForm.target_type}
              onChange={(e) => setScrapeForm({...scrapeForm, target_type: e.target.value})}
              className="w-full p-2 border border-slate-500 rounded bg-slate-700 text-white"
            >
              <option value="competitor">Competidor</option>
              <option value="influencer">Influencer</option>
              <option value="client">Cliente Potencial</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Nombre/Empresa</label>
            <input
              type="text"
              value={scrapeForm.target_name}
              onChange={(e) => setScrapeForm({...scrapeForm, target_name: e.target.value})}
              className="w-full p-2 border border-slate-500 rounded bg-slate-700 text-white placeholder-slate-400"
              placeholder="Ej: La Caja Seguros"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-white">Plataforma</label>
            <select
              value={scrapeForm.platform}
              onChange={(e) => setScrapeForm({...scrapeForm, platform: e.target.value})}
              className="w-full p-2 border border-slate-500 rounded bg-slate-700 text-white"
            >
              <option value="linkedin">LinkedIn</option>
              <option value="instagram">Instagram</option>
              <option value="facebook">Facebook</option>
              <option value="website">Website</option>
            </select>
          </div>
        </div>
        <button
          onClick={iniciarScrape}
          disabled={!scrapeForm.target_name}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition"
        >
          🔍 Iniciar Scraping
        </button>
      </div>

      {/* Scrapes Recientes */}
      <div className="bg-slate-800 rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4 text-white">Scrapes Recientes</h3>
        {loading ? (
          <p className="text-slate-200">Cargando...</p>
        ) : scrapes.length === 0 ? (
          <p className="text-slate-300">No hay scrapes registrados</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700">
                <tr>
                  <th className="p-2 text-left text-white">Token</th>
                  <th className="p-2 text-left text-white">Target</th>
                  <th className="p-2 text-left text-white">Plataforma</th>
                  <th className="p-2 text-left text-white">Estado</th>
                  <th className="p-2 text-left text-white">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {scrapes.map((scrape) => (
                  <tr key={scrape.token} className="border-b border-slate-700">
                    <td className="p-2 font-mono text-sm text-slate-200">{scrape.token}</td>
                    <td className="p-2 text-slate-200">{scrape.target_name}</td>
                    <td className="p-2 text-slate-200">{scrape.platform}</td>
                    <td className="p-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        scrape.status === 'completed' ? 'bg-emerald-500 text-white' :
                        scrape.status === 'pending' ? 'bg-amber-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {scrape.status}
                      </span>
                    </td>
                    <td className="p-2 text-sm text-slate-200">{new Date(scrape.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Prospectos de Alto Valor */}
      <div className="bg-slate-800 rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4 text-white">Prospectos de Alto Valor</h3>
        {prospects.length === 0 ? (
          <p className="text-slate-300">No hay prospectos identificados</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prospects.slice(0, 10).map((prospect) => (
              <div key={prospect.id} className="bg-slate-700 border border-slate-600 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-semibold text-white">{prospect.name}</h4>
                  <span className="bg-violet-500 text-white px-2 py-1 rounded text-xs font-medium">
                    Score: {prospect.priority_score}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-2">{prospect.location || 'Sin ubicación'}</p>
                {prospect.potential_products && (
                  <div className="text-xs text-slate-200">
                    <span className="font-medium text-white">Productos potenciales:</span>
                    <span className="ml-2">{prospect.potential_products.join(', ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligencePanel;
