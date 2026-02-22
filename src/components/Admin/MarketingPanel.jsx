import React, { useState, useEffect } from 'react';

const MarketingPanel = ({ token }) => {
  const [contenidos, setContenidos] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [pendientesRes, dashboardRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/marketing/contenido/pendiente`, { headers }),
        fetch(`${API_URL}/api/v1/marketing/dashboard`, { headers })
      ]);

      if (pendientesRes.ok) {
        const data = await pendientesRes.json();
        setPendientes(data.contenidos || []);
      }
      if (dashboardRes.ok) setDashboard(await dashboardRes.json());
    } catch (error) {
      console.error('Error cargando marketing:', error);
    } finally {
      setLoading(false);
    }
  };

  const aprobarContenido = async (tokenContenido, aprobado, comentarios = '') => {
    try {
      const res = await fetch(`${API_URL}/api/v1/marketing/contenido/${tokenContenido}/aprobar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ aprobado, comentarios })
      });

      if (res.ok) {
        alert(`Contenido ${aprobado ? 'aprobado' : 'rechazado'} exitosamente`);
        cargarDatos();
      }
    } catch (error) {
      alert('Error al procesar aprobación');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Marketing Autónomo</h2>

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Total Contenidos</p>
            <p className="text-2xl font-bold">{dashboard.total_contenidos || 0}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">
              {dashboard.por_estado?.pendientes || 0}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Aprobados</p>
            <p className="text-2xl font-bold text-green-600">
              {dashboard.por_estado?.aprobados || 0}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg shadow">
            <p className="text-sm text-gray-600">Tasa Aprobación</p>
            <p className="text-2xl font-bold text-blue-600">
              {dashboard.tasa_aprobacion || 0}%
            </p>
          </div>
        </div>
      )}

      {/* Presupuesto */}
      {dashboard?.presupuesto && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Presupuesto Mensual</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Google Ads</p>
              <p className="text-lg font-semibold">
                ${(dashboard.presupuesto.google_ads || 0).toLocaleString()} ARS
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Meta</p>
              <p className="text-lg font-semibold">
                ${(dashboard.presupuesto.meta || 0).toLocaleString()} ARS
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">LinkedIn</p>
              <p className="text-lg font-semibold">
                ${(dashboard.presupuesto.linkedin || 0).toLocaleString()} ARS
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">X/Twitter</p>
              <p className="text-lg font-semibold">
                ${(dashboard.presupuesto.x_twitter || 0).toLocaleString()} ARS
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contenidos Pendientes de Aprobación */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">
          Pendientes de Aprobación ({pendientes.length})
        </h3>
        
        {loading ? (
          <p>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p className="text-gray-500">No hay contenidos pendientes de revisión</p>
        ) : (
          <div className="space-y-4">
            {pendientes.map((contenido) => (
              <div key={contenido.token} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {contenido.token}
                    </span>
                    <div className="mt-2 flex gap-2">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {contenido.channel}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {new Date(contenido.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded mb-3">
                  <p className="text-sm whitespace-pre-wrap">{contenido.copy_text}</p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const comentarios = prompt('Comentarios de aprobación (opcional):');
                      if (comentarios !== null) {
                        aprobarContenido(contenido.token, true, comentarios);
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => {
                      const comentarios = prompt('Razón del rechazo:');
                      if (comentarios) {
                        aprobarContenido(contenido.token, false, comentarios);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    ✗ Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketingPanel;
