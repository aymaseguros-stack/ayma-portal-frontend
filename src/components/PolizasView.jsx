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

// ART (establecimientos) y Comercio (locales) son entidades propias de
// gestión de bienes/riesgos asegurados, NO un filtro por ramo sobre
// pólizas: cada una tiene sus propios datos y su propio endpoint.
const ENTIDADES = {
  art: {
    endpoint: '/api/v1/art/establecimientos',
    emptyText: 'Todavía no hay establecimientos ART cargados',
    columns: [
      { key: 'vinculado_nombre', label: 'Empresa/Persona vinculada' },
      { key: 'cuit', label: 'CUIT' },
      { key: 'ciiu', label: 'CIIU' },
      { key: 'cantidad_empleados', label: 'Cant. empleados' },
      { key: 'masa_salarial_mensual', label: 'Masa salarial mensual', tipo: 'moneda' },
      { key: 'alicuota_fija', label: 'Alícuota fija', tipo: 'porcentaje' },
      { key: 'alicuota_variable', label: 'Alícuota variable', tipo: 'porcentaje' },
      { key: 'cuota_mensual_estimada', label: 'Cuota mensual estimada', tipo: 'moneda' },
      { key: 'cantidad_establecimientos', label: 'Establecimientos' },
      { key: 'domicilio_planta', label: 'Domicilio de planta' },
      { key: 'compania', label: 'Compañía ART' },
      { key: 'numero_contrato', label: 'N° de contrato' },
      { key: 'fecha_afiliacion', label: 'Fecha de afiliación', tipo: 'fecha' },
      { key: 'estado', label: 'Estado', tipo: 'estado' },
    ],
  },
  integral: {
    endpoint: '/api/v1/comercio/locales',
    emptyText: 'Todavía no hay locales de Comercio cargados',
    columns: [
      { key: 'vinculado_nombre', label: 'Empresa/Persona vinculada' },
      { key: 'rubro', label: 'Rubro' },
      { key: 'domicilio', label: 'Domicilio' },
      { key: 'superficie_m2', label: 'Superficie m²' },
      { key: 'valor_contenido', label: 'Valor de contenido', tipo: 'moneda' },
      { key: 'valor_mercaderia', label: 'Valor de mercadería', tipo: 'moneda' },
      { key: 'valor_edificio', label: 'Valor de edificio', tipo: 'moneda' },
      { key: 'tipo_construccion', label: 'Tipo de construcción' },
      { key: 'medidas_seguridad', label: 'Medidas de seguridad' },
      { key: 'compania', label: 'Compañía' },
      { key: 'numero_poliza', label: 'N° de póliza' },
      { key: 'estado', label: 'Estado', tipo: 'estado' },
    ],
  },
};

const formatCelda = (valor, tipo) => {
  if (valor === null || valor === undefined || valor === '') return '-';
  if (tipo === 'moneda') return `$${Number(valor).toLocaleString('es-AR')}`;
  if (tipo === 'porcentaje') return `${valor}%`;
  if (tipo === 'fecha') return new Date(valor).toLocaleDateString('es-AR');
  return valor;
};

// Tabla genérica de solo lectura para ART/Comercio: consume el endpoint de
// la entidad, normaliza la respuesta (array plano u {items,total}) y trata
// un 404 (endpoint todavía no desplegado en el backend) igual que "sin
// datos" en vez de mostrarlo como error.
const EntityTable = ({ token, titulo, headerExtra, endpoint, columns, emptyText }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`${API_URL}${endpoint}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 404) {
          if (!cancelado) { setItems([]); setLoading(false); }
          return;
        }
        if (!res.ok) throw new Error(await formatApiError(res));
        const data = await res.json();
        if (!cancelado) { setItems(normalizeList(data).items); setLoading(false); }
      } catch (err) {
        if (!cancelado) { setError(err.message); setLoading(false); }
      }
    })();
    return () => { cancelado = true; };
  }, [endpoint, token]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-2xl font-bold">{titulo}</h2>
          {headerExtra}
        </div>
        <span className="text-slate-400">{items.length} registro(s)</span>
      </div>

      {error ? (
        <div className="bg-red-900/20 border border-red-500/40 rounded-xl p-12 text-center">
          <Icon name="exclamation-triangle" size={48} className="text-red-400 mx-auto" />
          <p className="text-red-300 font-semibold mt-4">No se pudo cargar el listado</p>
          <p className="text-red-400/80 text-sm mt-2">{error}</p>
        </div>
      ) : loading ? (
        <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
          <p className="text-slate-400">Cargando...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-12 text-center border border-slate-700">
          <Icon name="document-text" size={48} className="text-slate-600 mx-auto" />
          <p className="text-slate-400 mt-4">{emptyText}</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  {columns.map(col => (
                    <th key={col.key} className="px-4 py-3 text-left text-sm font-semibold text-slate-300 whitespace-nowrap">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-700/30 transition">
                    {columns.map(col => (
                      <td key={col.key} className="px-4 py-3 text-sm whitespace-nowrap">
                        {col.tipo === 'estado' ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            item.estado === 'ACTIVO' ? 'bg-green-500/20 text-green-400' : 'bg-slate-500/20 text-slate-400'
                          }`}>
                            {item.estado || '-'}
                          </span>
                        ) : (
                          formatCelda(item[col.key], col.tipo)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// Vista unificada de "Gestión de Pólizas" con sub-pestañas en línea con el
// título: Todas | Vehículos | ART | Comercio.
// - "Todas": el listado de pólizas del cliente ya cargado (sin filtro).
// - "Vehículos": la vista de vehículos que antes estaba en su propio tab.
// - "ART" y "Comercio": entidades propias (establecimientos / locales),
//   NO un filtro por ramo sobre pólizas — cada una consulta su propio
//   endpoint bajo /api/v1/art y /api/v1/comercio.
const PolizasView = ({ token, isAdmin, todasPolizas, todasError, vehiculos, vehiculosError }) => {
  const [subTab, setSubTab] = useState('todas');

  const contadorActivo = () => {
    if (subTab === 'todas') return todasPolizas.length;
    if (subTab === 'vehiculos') return vehiculos.length;
    return null; // ART/Comercio muestran su propio contador de registros
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
    const entidad = ENTIDADES[subTab];
    return (
      <EntityTable
        key={subTab}
        token={token}
        titulo="Gestión de Pólizas"
        headerExtra={tabs}
        endpoint={entidad.endpoint}
        columns={entidad.columns}
        emptyText={entidad.emptyText}
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
