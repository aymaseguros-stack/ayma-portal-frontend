import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarEmpresasArt } from './artCarteraApi';
import { RIESGO_SUSCRIPCION_OPCIONES, ESTADOS_EFECTIVOS, ASEGURADORAS_ART, riesgoBadgeClass } from './artCarteraConstants';
import { ESTRATEGIA_ART_ORDEN, estrategiaArtInfo, estrategiaArtBadgeClass } from '../Crm/artEstrategia';

const LIMIT = 50;

const FILTROS_INICIALES = {
  q: '', ciiu: '', provincia: '', dotacion_min: '',
  riesgo_suscripcion: '', estado_efectivo: '', aseguradora: '', estrategia_art: '',
};

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500';

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 9 }).map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[100px]" /></td>
    ))}
  </tr>
);

// Pantalla A - Listado de cartera ART (/art). Tabla server-side paginada:
// son 9.119 empresas, así que `total` sale SIEMPRE del envelope del backend
// (nunca items.length) y los 7 filtros del endpoint van por querystring, no
// se filtra en el cliente (ver GET /art/empresas en app/api/v1/art_consultas.py).
const ArtCarteraListado = ({ token, onAbrirFicha }) => {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtrosKey = JSON.stringify(filtros);

  // Cualquier cambio de filtro vuelve a la primera página.
  useEffect(() => {
    setOffset(0);
  }, [filtrosKey]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const resultado = await listarEmpresasArt(token, { ...filtros, limit: LIMIT, offset });
        if (cancelado) return;
        setItems(resultado.items);
        setTotal(resultado.total);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, offset, filtrosKey]);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));
  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== '');
  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + LIMIT, total);
  const puedeAnterior = offset > 0;
  const puedeSiguiente = offset + LIMIT < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Cartera ART</h2>
        <p className="text-slate-400 text-sm">{total.toLocaleString('es-AR')} empresas</p>
      </div>

      {/* Barra de filtros - los 7 del endpoint (ciiu, provincia,
          dotacion_min, riesgo_suscripcion, estado_efectivo, aseguradora,
          estrategia) más búsqueda por razón social/CUIT. */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide mb-3">
          <Icon name="funnel" size={14} />
          Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-3 lg:col-span-2">
            <label className={labelClass}>Razón social o CUIT</label>
            <div className="relative">
              <Icon name="magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={filtros.q}
                onChange={(e) => cambiarFiltro('q', e.target.value)}
                placeholder="Buscar..."
                className={`${inputClass} w-full pl-9`}
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>CIIU</label>
            <input
              type="text"
              value={filtros.ciiu}
              onChange={(e) => cambiarFiltro('ciiu', e.target.value)}
              placeholder="Ej. 37"
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass}>Provincia</label>
            <input
              type="text"
              value={filtros.provincia}
              onChange={(e) => cambiarFiltro('provincia', e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass}>Dotación mínima</label>
            <input
              type="number"
              min="0"
              value={filtros.dotacion_min}
              onChange={(e) => cambiarFiltro('dotacion_min', e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass}>Riesgo de suscripción</label>
            <select
              value={filtros.riesgo_suscripcion}
              onChange={(e) => cambiarFiltro('riesgo_suscripcion', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {RIESGO_SUSCRIPCION_OPCIONES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Aseguradora</label>
            <select
              value={filtros.aseguradora}
              onChange={(e) => cambiarFiltro('aseguradora', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todas</option>
              {ASEGURADORAS_ART.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estado efectivo</label>
            <select
              value={filtros.estado_efectivo}
              onChange={(e) => cambiarFiltro('estado_efectivo', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {ESTADOS_EFECTIVOS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Estrategia</label>
            <select
              value={filtros.estrategia_art}
              onChange={(e) => cambiarFiltro('estrategia_art', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todas</option>
              {ESTRATEGIA_ART_ORDEN.map((key) => (
                <option key={key} value={key}>{estrategiaArtInfo(key).label}</option>
              ))}
            </select>
          </div>
        </div>
        {hayFiltrosActivos && (
          <button type="button" onClick={limpiarFiltros} className="mt-3 text-sm text-slate-400 hover:text-white transition">
            Limpiar filtros
          </button>
        )}
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar la cartera ART. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Razón social</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CUIT</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CIIU</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Provincia</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Dotación</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Riesgo</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Estrategia</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">ART vigente</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Vigentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <FilaSkeleton key={i} />)
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay empresas para estos filtros</td></tr>
              ) : (
                items.map((emp) => {
                  const info = estrategiaArtInfo(emp.estrategia_art);
                  const clickable = Boolean(emp.cuit);
                  return (
                    <tr
                      key={emp.cuit || emp.razon_social}
                      onClick={clickable ? () => onAbrirFicha(emp.cuit) : undefined}
                      className={clickable ? 'hover:bg-slate-700/30 transition cursor-pointer' : 'opacity-70'}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{emp.razon_social}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.cuit || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.ciiu || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{emp.provincia || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">{emp.dotacion ?? '-'}</td>
                      <td className="px-4 py-3">
                        {emp.riesgo_suscripcion ? (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${riesgoBadgeClass(emp.riesgo_suscripcion)}`}>
                            {emp.riesgo_suscripcion}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${estrategiaArtBadgeClass(emp.estrategia_art)}`}>
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">
                        {emp.art_actual_srt ? (
                          <>
                            {emp.art_actual_srt}
                            {emp.vigencia_srt && <span className="text-slate-500"> · hasta {fechaCorta(emp.vigencia_srt)}</span>}
                          </>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-slate-300">{emp.cantidad_estados_vigentes} / {ASEGURADORAS_ART.length}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
          <span>{total > 0 ? `Mostrando ${desde}-${hasta} de ${total.toLocaleString('es-AR')}` : ''}</span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!puedeAnterior || loading}
              onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!puedeSiguiente || loading}
              onClick={() => setOffset((o) => o + LIMIT)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtCarteraListado;
