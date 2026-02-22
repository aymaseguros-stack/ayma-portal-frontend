import React, { useState, useEffect } from 'react';

const CompliancePanel = ({ token }) => {
  const [validaciones, setValidaciones] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [pendientesRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/v1/compliance/pending`, { headers }),
        fetch(`${API_URL}/api/v1/compliance/stats`, { headers })
      ]);

      if (pendientesRes.ok) setPendientes(await pendientesRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error('Error cargando compliance:', error);
    } finally {
      setLoading(false);
    }
  };

  const aprobarValidacion = async (validationToken, aprobado, notas) => {
    try {
      const res = await fetch(`${API_URL}/api/v1/compliance/human-decision`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          validation_token: validationToken,
          decision: aprobado ? 'approved' : 'rejected',
          reviewer_notes: notas
        })
      });

      if (res.ok) {
        alert(`Contenido ${aprobado ? 'aprobado' : 'rechazado'} exitosamente`);
        cargarDatos();
      }
    } catch (error) {
      alert('Error al procesar decisión');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Compliance Marketing - FERRETI</h2>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Total Validaciones</p>
            <p className="text-2xl font-bold">{stats.total_validations || 0}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Aprobadas</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved || 0}</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Pendientes</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.pending_human || 0}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600">Rechazadas</p>
            <p className="text-2xl font-bold text-red-600">{stats.rejected || 0}</p>
          </div>
        </div>
      )}

      {/* Pendientes de revisión */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Pendientes de Revisión Humana</h3>
        
        {loading ? (
          <p>Cargando...</p>
        ) : pendientes.length === 0 ? (
          <p className="text-gray-500">No hay validaciones pendientes</p>
        ) : (
          <div className="space-y-4">
            {pendientes.map((val) => (
              <div key={val.validation_token} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                      {val.validation_token}
                    </span>
                    <p className="mt-2 text-sm text-gray-600">
                      Content Token: {val.content_token}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm ${
                    val.risk_level === 'HIGH' ? 'bg-red-100 text-red-800' :
                    val.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    Risk: {val.risk_level} ({val.risk_score})
                  </span>
                </div>

                <div className="mt-3 space-y-2">
                  <p className="font-semibold">Cambios requeridos:</p>
                  <ul className="list-disc list-inside text-sm">
                    {val.required_changes?.map((change, idx) => (
                      <li key={idx}>{change}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      const notas = prompt('Notas de aprobación (opcional):');
                      if (notas !== null) aprobarValidacion(val.validation_token, true, notas);
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓ Aprobar
                  </button>
                  <button
                    onClick={() => {
                      const notas = prompt('Razón de rechazo:');
                      if (notas) aprobarValidacion(val.validation_token, false, notas);
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

export default CompliancePanel;
