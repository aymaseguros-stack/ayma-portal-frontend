import React, { useState, useEffect } from 'react';
import { Icon } from './Icons';
import PolizasGrid from './PolizasGrid';
import { normalizeList, formatApiError } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const SUB_TABS = (admin) => [
  { id: 'todas', label: 'Todas' },
  { id: 'vehiculos', label: 'Vehículos' },
  ...(admin ? [{ id: 'art', label: 'ART' }] : []),
  ...(admin ? [{ id: 'integral', label: 'Comercio' }] : []),
];

const subTabButtonClass = (active) =>
  `px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
    active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
  }`;

// Vista unificada de "Gestión de Pólizas" con sub-pestañas en línea con el
// título: Todas | Vehículos | ART | Comercio. "Todas" usa el listado del
// cliente ya cargado; ART/Comercio consultan GET /api/v1/polizas/admin?ramo=...
// (que devuelve {items, total}, normalizado igual que el resto de la app).
const PolizasView = ({ token, isAdmin, todasPolizas, todasError, vehiculos, vehiculosError }) => {
  const [subTab, setSubTab] = useState('todas');
  const [ramoData, setRamoData] = useState({
    art: { items: [], loading: false, error: null, loaded: false },
    integral: { items: [], loading: false, error: null, loaded: false },
  });

  const ramoParam = { art: 'ART', integral: 'INTEGRAL' };

  useEffect(() => {
    if (subTab !== 'art' && subTab !== 'integral') return;
    if (ramoData[subTab].loaded || ramoData[subTab].loading) return;

    setRamoData(prev => ({ ...prev, [subTab]: { ...prev[subTab], loading: true, error: null } }));
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/v1/polizas/admin?ramo=${ramoParam[subTab]}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await formatApiError(res));
        const data = await res.json();
        const { items } = normalizeList(data);
        setRamoData(prev => ({ ...prev, [subTab]: { items, loading: false, error: null, loaded: true } }));
      } catch (err) {
        setRamoData(prev => ({ ...prev, [subTab]: { items: [], loading: false, error: err.message, loaded: true } }));
      }
    })();
  }, [subTab, token]);

  const contadorActivo = () => {
    if (subTab === 'todas') return todasPolizas.length;
    if (subTab === 'vehiculos') return vehiculos.length;
    return ramoData[subTab]?.items.length ?? 0;
  };

  const tabs = (
    <div className="flex gap-1 overflow-x-auto">
      {SUB_TABS(isAdmin).map(t => (
        <button
          key={t.id}
          onClick={() => setSubTab(t.id)}
          className={subTabButtonClass(subTab === t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (subTab === 'vehiculos') {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-2xl font-bold">Gestión de Pólizas</h2>
            {tabs}
          </div>
          <span className="text-slate-400">{contadorActivo()} vehículo(s)</span>
        </div>

        {vehiculosError ? (
          <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-12 text-center">
            <Icon name="exclamation-triangle" size={48} className="text-red-400 mx-auto" />
            <p className="text-red-300 font-semibold mt-4">No se pudieron cargar los vehículos</p>
            <p className="text-red-400/80 text-sm mt-2">{vehiculosError}</p>
          </div>
        ) : vehiculos.length === 0 ? (
          <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
            <span className="text-6xl">🚗</span>
            <p className="text-slate-400 mt-4">No tienes vehículos registrados</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {vehiculos.map(vehiculo => (
              <div key={vehiculo.id} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden hover:border-green-500/50 transition">
                <div className="bg-slate-700/50 px-6 py-4 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🚗</span>
                    <div>
                      <p className="font-bold">{vehiculo.marca} {vehiculo.modelo}</p>
                      <p className="text-slate-400 text-sm">{vehiculo.tipo_vehiculo}</p>
                    </div>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    vehiculo.estado === 'activo'
                      ? 'bg-green-600/30 text-green-300'
                      : 'bg-slate-600/30 text-slate-300'
                  }`}>
                    {vehiculo.estado}
                  </span>
                </div>

                <div className="p-6">
                  <div className="bg-slate-700/50 rounded-xl p-4 text-center mb-4">
                    <p className="text-slate-500 text-xs mb-1">Dominio/Patente</p>
                    <p className="text-3xl font-black text-blue-400 tracking-wider">{vehiculo.dominio}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Año</p>
                      <p className="font-bold text-2xl">{vehiculo.anio}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Uso</p>
                      <p className="font-medium capitalize">{vehiculo.uso || 'Particular'}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (subTab === 'art' || subTab === 'integral') {
    const { items, loading, error } = ramoData[subTab];
    return (
      <PolizasGrid
        titulo="Gestión de Pólizas"
        headerExtra={tabs}
        polizas={items}
        loading={loading}
        error={error}
        emptyText={subTab === 'art' ? 'Sin pólizas de ART cargadas' : 'Sin pólizas de Integral Comercio cargadas'}
      />
    );
  }

  return (
    <PolizasGrid
      titulo="Gestión de Pólizas"
      headerExtra={tabs}
      polizas={todasPolizas}
      error={todasError}
      emptyText="No tienes pólizas registradas"
    />
  );
};

export default PolizasView;
