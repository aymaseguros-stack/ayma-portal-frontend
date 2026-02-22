import React, { useState, useEffect } from 'react';

const API_URL = 'https://ayma-portal-backend.onrender.com/api/v1';

function MarketingPanel({ token }) {
  const [contenidos, setContenidos] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      console.error('MarketingPanel: No token provided');
      setError('No hay token de autenticación');
      setLoading(false);
      return;
    }
    
    console.log('MarketingPanel: Fetching data with token:', token.substring(0, 20) + '...');
    fetchDashboard();
    fetchContenidosPendientes();
  }, [token]); // AGREGADO TOKEN COMO DEPENDENCIA

  const fetchDashboard = async () => {
    try {
      console.log('Fetching dashboard...');
      const response = await fetch(`${API_URL}/marketing/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Dashboard response status:', response.status);
      if (!response.ok) throw new Error('Error al cargar dashboard');
      const data = await response.json();
      console.log('Dashboard data:', data);
      setStats(data);
    } catch (err) {
      console.error('Error dashboard:', err);
    }
  };

  const fetchContenidosPendientes = async () => {
    try {
      setLoading(true);
      console.log('Fetching contenidos pendientes...');
      const response = await fetch(`${API_URL}/marketing/contenido/pendiente`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Contenidos response status:', response.status);
      if (!response.ok) throw new Error('Error al cargar contenidos');
      const data = await response.json();
      console.log('Contenidos data:', data);
      setContenidos(data.contenidos || []);
    } catch (err) {
      console.error('Error contenidos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAprobar = async (tokenContenido) => {
    try {
      const response = await fetch(`${API_URL}/marketing/contenido/${tokenContenido}/aprobar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ aprobado_por: 'admin' })
      });
      if (!response.ok) throw new Error('Error al aprobar');
      alert('✅ Contenido aprobado exitosamente');
      fetchContenidosPendientes();
      fetchDashboard();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  const handleRechazar = async (tokenContenido) => {
    const motivo = prompt('Motivo del rechazo:');
    if (!motivo) return;
    
    try {
      const response = await fetch(`${API_URL}/marketing/contenido/${tokenContenido}/rechazar`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ motivo, rechazado_por: 'admin' })
      });
      if (!response.ok) throw new Error('Error al rechazar');
      alert('❌ Contenido rechazado');
      fetchContenidosPendientes();
      fetchDashboard();
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  if (loading) return (
    <div className="p-8 text-center">
      <div className="text-lg">⏳ Cargando contenidos de marketing...</div>
    </div>
  );
  
  if (error) return (
    <div className="p-8 text-center">
      <div className="text-red-500 text-lg">❌ Error: {error}</div>
      <button 
        onClick={() => {setError(null); setLoading(true); fetchContenidosPendientes();}}
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
      >
        Reintentar
      </button>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-3xl font-bold mb-6">📢 Panel de Marketing</h2>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Total Contenidos</div>
            <div className="text-2xl font-bold">{stats.total_contenidos || 0}</div>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Pendientes</div>
            <div className="text-2xl font-bold">{stats.pendientes || 0}</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Aprobados</div>
            <div className="text-2xl font-bold">{stats.aprobados || 0}</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Tasa Aprobación</div>
            <div className="text-2xl font-bold">{stats.tasa_aprobacion || 0}%</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-xl font-semibold">
            ⏳ Contenidos Pendientes de Aprobación ({contenidos.length})
          </h3>
        </div>
        <div className="p-4">
          {contenidos.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              📭 No hay contenidos pendientes de aprobación
            </p>
          ) : (
            <div className="space-y-4">
              {contenidos.map((contenido) => (
                <div key={contenido.token} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {contenido.token}
                      </span>
                      <div className="mt-2 text-sm">
                        <strong>Canal:</strong> <span className="capitalize">{contenido.channel}</span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        <strong>Fecha:</strong> {new Date(contenido.created_at).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded mt-3 border-l-4 border-blue-500">
                    <p className="text-sm whitespace-pre-wrap">{contenido.copy_text}</p>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleAprobar(contenido.token)}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                    >
                      ✅ Aprobar
                    </button>
                    <button
                      onClick={() => handleRechazar(contenido.token)}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                    >
                      ❌ Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MarketingPanel;
