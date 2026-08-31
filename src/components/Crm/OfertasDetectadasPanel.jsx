import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '../Icons';
import { authHeader, formatApiError } from '../../utils/api';
import { formatMoneda } from './oportunidadConstants';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const TIPOS_ENTIDAD = [
  { value: 'persona', label: 'Persona' },
  { value: 'empresa', label: 'Empresa' },
  { value: 'grupo', label: 'Grupo' },
];

const scoreBadgeClase = (score) => {
  const n = Number(score) || 0;
  if (n >= 90) return 'bg-red-500/20 text-red-300 border border-red-500/40';
  if (n >= 70) return 'bg-orange-500/20 text-orange-300 border border-orange-500/40';
  if (n >= 50) return 'bg-blue-500/20 text-blue-300 border border-blue-500/40';
  return 'bg-slate-500/20 text-slate-400 border border-slate-600';
};

// Fila 2, tab "Oportunidades" (sub-tab "Detectadas"): ranking global de toda
// la cartera, calculado por el backend con POST /crm/ofertas/evaluar-cartera
// (puede tardar unos segundos, de ahí el botón "Recalcular" con spinner en
// vez de recargar solo).
const OfertasDetectadasPanel = ({ token, onIrAFicha }) => {
  const [filas, setFilas] = useState([]);
  const [total, setTotal] = useState(0);
  const [sumaEstimada, setSumaEstimada] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState(null);
  const [creandoKey, setCreandoKey] = useState(null);

  const [scoreMinimo, setScoreMinimo] = useState(0);
  const [filtroTipoEntidad, setFiltroTipoEntidad] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('');

  const headers = { ...authHeader(token), 'Content-Type': 'application/json' };

  const evaluarCartera = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/ofertas/evaluar-cartera`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data?.items ?? []);
      setFilas(items);
      setTotal(Array.isArray(data) ? items.length : (data?.total ?? items.length));
      setSumaEstimada(Array.isArray(data) ? null : (data?.suma_estimada ?? data?.prima_estimada_total ?? null));
    } catch (err) {
      console.error('Error evaluando cartera:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    (async () => { setLoading(true); await evaluarCartera(); setLoading(false); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recalcular = async () => {
    setRecalculando(true);
    await evaluarCartera();
    setRecalculando(false);
  };

  const productosDisponibles = useMemo(() => {
    const set = new Map();
    filas.forEach((f) => { if (f.producto_codigo) set.set(f.producto_codigo, f.producto_nombre || f.producto_codigo); });
    return Array.from(set.entries());
  }, [filas]);

  const filasFiltradas = useMemo(() => {
    return filas
      .filter((f) => (Number(f.score) || 0) >= scoreMinimo)
      .filter((f) => !filtroTipoEntidad || f.tipo_entidad === filtroTipoEntidad)
      .filter((f) => !filtroProducto || f.producto_codigo === filtroProducto)
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  }, [filas, scoreMinimo, filtroTipoEntidad, filtroProducto]);

  const crearOportunidad = async (fila) => {
    const key = `${fila.tipo_entidad}-${fila.entidad_id}-${fila.producto_codigo}`;
    setCreandoKey(key);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/v1/crm/ofertas/${fila.tipo_entidad}/${fila.entidad_id}/crear-oportunidad`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ producto_codigo: fila.producto_codigo }),
      });
      if (!res.ok) throw new Error(await formatApiError(res));
      await evaluarCartera();
    } catch (err) {
      console.error('Error creando oportunidad desde oferta detectada:', err);
      setError(err.message);
    } finally {
      setCreandoKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Oportunidades detectadas</h2>
          <p className="text-slate-400 text-sm mt-1">
            {total} oferta{total === 1 ? '' : 's'} detectada{total === 1 ? '' : 's'} en toda la cartera
            {sumaEstimada != null && <> · {formatMoneda(sumaEstimada)} estimados</>}
          </p>
        </div>
        <button
          onClick={recalcular}
          disabled={recalculando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition text-sm font-medium"
        >
          <Icon name="arrow-path" className={recalculando ? 'animate-spin' : ''} />
          {recalculando ? 'Recalculando...' : 'Recalcular'}
        </button>
      </div>

      <div className="flex items-center gap-6 flex-wrap bg-slate-800/40 border border-slate-700 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3 min-w-[220px]">
          <label className="text-sm text-slate-400 whitespace-nowrap">Score mínimo: {scoreMinimo}</label>
          <input
            type="range"
            min={0}
            max={100}
            value={scoreMinimo}
            onChange={(e) => setScoreMinimo(Number(e.target.value))}
            className="w-full"
          />
        </div>
        <select
          value={filtroTipoEntidad}
          onChange={(e) => setFiltroTipoEntidad(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todas las entidades</option>
          {TIPOS_ENTIDAD.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select
          value={filtroProducto}
          onChange={(e) => setFiltroProducto(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
        >
          <option value="">Todos los productos</option>
          {productosDisponibles.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Evaluando cartera...</p>
      ) : filasFiltradas.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Sin ofertas detectadas con estos filtros</p>
      ) : (
        <div className="overflow-x-auto border border-slate-700 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Entidad</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Producto</th>
                <th className="px-4 py-3 text-left">Motivo</th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60">
              {filasFiltradas.map((f) => {
                const key = `${f.tipo_entidad}-${f.entidad_id}-${f.producto_codigo}`;
                return (
                  <tr key={key} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${scoreBadgeClase(f.score)}`}>
                        {f.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => onIrAFicha?.(f.tipo_entidad, f.entidad_id)}
                        className="text-blue-400 hover:text-blue-300 font-medium text-left"
                      >
                        {f.entidad_nombre}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-slate-400 capitalize">{f.tipo_entidad}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{f.producto_nombre}</span>
                      {f.obligatorio_legal && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-red-600/30 text-red-200 border border-red-500/50">
                          OBLIGATORIO POR LEY
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 max-w-md">{f.motivo}</td>
                    <td className="px-4 py-3 text-right">
                      {f.oportunidad_abierta ? (
                        <span className="text-slate-500 text-xs">Ya en trabajo</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => crearOportunidad(f)}
                          disabled={creandoKey === key}
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-xs font-medium transition"
                        >
                          {creandoKey === key ? 'Creando...' : 'Crear oportunidad'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OfertasDetectadasPanel;
