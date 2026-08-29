import React, { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const RecuperablesPanel = ({ token }) => {
  const [recuperables, setRecuperables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarRecuperables();
  }, []);

  const cargarRecuperables = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/admin/recuperables`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Error ' + res.status);
      const data = await res.json();
      setRecuperables(Array.isArray(data) ? data : (data?.recuperables || []));
    } catch (err) {
      console.error('Error cargando recuperables:', err);
      setError('No se pudieron cargar los clientes recuperables');
    } finally {
      setLoading(false);
    }
  };

  const hoy = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes Recuperables</h2>
        <button
          onClick={cargarRecuperables}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
        >
          🔄 Actualizar
        </button>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Nombre</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Motivo de Baja</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Fecha de Recontacto</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Valor Cartera Perdida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Cargando...</td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-red-400">{error}</td>
                </tr>
              ) : recuperables.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No hay clientes recuperables</td>
                </tr>
              ) : (
                recuperables.map((r, idx) => {
                  const vencido = !!r.fecha_recontacto && r.fecha_recontacto <= hoy;
                  const nombre = r.nombre || `${r.cliente?.nombre || ''} ${r.cliente?.apellido || ''}`.trim() || '-';
                  return (
                    <tr key={r.id || idx} className="hover:bg-slate-700/30 transition">
                      <td className="px-4 py-3 text-sm">{nombre}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {r.motivo_baja || '-'}
                        {r.motivo_baja_detalle ? ` · ${r.motivo_baja_detalle}` : ''}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          vencido ? 'bg-red-500/20 text-red-400' : 'text-slate-300'
                        }`}>
                          {r.fecha_recontacto ? new Date(r.fecha_recontacto).toLocaleDateString('es-AR') : '-'}
                          {vencido ? ' ⚠️ Vencido' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-orange-400">
                        ${Number(r.valor_cartera_perdida || 0).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecuperablesPanel;
