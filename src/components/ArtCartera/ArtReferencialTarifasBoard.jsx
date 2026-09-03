import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerReferencialTarifas } from './artCarteraApi';
import { ASEGURADORAS_ART, numeroAr, decimalAr } from './artCarteraConstants';

const TRAMOS_DOTACION = ['1-10', '11-25', '26-50', '51-100', '100+', 'sin_dato'];

const FILTROS_INICIALES = { ciiu: '', provincia: '', tramo_dotacion: '', aseguradora: '' };

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500';
const th = 'px-3 py-3 text-left text-sm font-medium text-slate-300 whitespace-nowrap';
const thNum = 'px-3 py-3 text-right text-sm font-medium text-slate-300 whitespace-nowrap';
const tdNum = 'px-3 py-3 text-sm text-right text-slate-300 whitespace-nowrap';

const anio = (fecha) => {
  if (!fecha) return null;
  const d = new Date(fecha);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
};

// Badge de antigüedad (pedido explícito, ej. "dato 2020-2025, no vigente")
// para que ninguna celda de este referencial histórico se confunda con una
// alícuota actual - se muestra SIEMPRE, nunca condicional, porque TODA fila
// de esta tabla es histórico (fuente=PLANILLA_2025, ver
// app/services/art_dashboard.py::referencial_tarifas).
const BadgeAntiguedad = ({ item }) => {
  const anioMin = anio(item.fecha_dato_mas_antiguo);
  const anioMax = anio(item.fecha_dato_mas_nuevo);
  const rango = anioMin && anioMax ? (anioMin === anioMax ? `${anioMin}` : `${anioMin}-${anioMax}`) : '—';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-amber-500/15 text-amber-300 whitespace-nowrap"
      title={item.antiguedad_dias != null ? `Dato más reciente: hace ${numeroAr(item.antiguedad_dias)} días` : undefined}
    >
      <Icon name="clock" size={12} />
      dato {rango}, no vigente
    </span>
  );
};

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 8 }).map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[80px]" /></td>
    ))}
  </tr>
);

// Sub-pestaña "Referencial de Tarifas" (BLOQUE 7) - reemplaza a la vieja
// pestaña "Embudo", que mezclaba el embudo comercial (actividad propia de
// AYMA en este ciclo) con la referencia histórica de la planilla en una
// sola vista. GET /art/referencial-tarifas: ÚNICAMENTE fuente=PLANILLA_2025,
// agrupado por CIIU x tramo de dotación x provincia - nunca actividad
// comercial de este ciclo (esa es la matriz de Cartera/Desbloqueos/Técnica
// vencida). Mismos filtros visuales que ArtCarteraListado (Pantalla A).
const ArtReferencialTarifasBoard = ({ token }) => {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [items, setItems] = useState([]);
  const [resumenGlobal, setResumenGlobal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const filtrosKey = JSON.stringify(filtros);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const resultado = await obtenerReferencialTarifas(token, filtros);
        if (cancelado) return;
        setItems(resultado.items);
        setResumenGlobal(resultado.resumen_global);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    }, 350);
    return () => { cancelado = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filtrosKey]);

  const cambiarFiltro = (campo, valor) => setFiltros((prev) => ({ ...prev, [campo]: valor }));
  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== '');
  const limpiarFiltros = () => setFiltros(FILTROS_INICIALES);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Referencial de Tarifas</h2>
          <p className="text-slate-400 text-sm mt-1">
            Histórico de la planilla heredada (fuente=PLANILLA_2025): a qué alícuota se cotizaba por rubro, tamaño y
            provincia. No es actividad comercial de este ciclo - eso está en Cartera/Desbloqueos/Técnica vencida.
          </p>
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs uppercase tracking-wide mb-3">
          <Icon name="funnel" size={14} />
          Filtros
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
              placeholder="Ej. Santa Fe"
              className={`${inputClass} w-full`}
            />
          </div>
          <div>
            <label className={labelClass}>Tramo de dotación</label>
            <select
              value={filtros.tramo_dotacion}
              onChange={(e) => cambiarFiltro('tramo_dotacion', e.target.value)}
              className={`${inputClass} w-full`}
            >
              <option value="">Todos</option>
              {TRAMOS_DOTACION.map((t) => <option key={t} value={t}>{t}</option>)}
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
        </div>
        {hayFiltrosActivos && (
          <button type="button" onClick={limpiarFiltros} className="mt-3 text-sm text-slate-400 hover:text-white transition">
            Limpiar filtros
          </button>
        )}
      </div>

      {resumenGlobal && !loading && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex items-start gap-3">
          <Icon name="chart-bar" className="text-blue-400 shrink-0 mt-0.5" />
          <p className="text-sm text-slate-300">
            <strong>{numeroAr(resumenGlobal.total_registros) ?? '0'}</strong> registros históricos ·
            alícuota promedio <strong>{decimalAr(resumenGlobal.alicuota_promedio_global, { maximumFractionDigits: 3 }) ?? '—'}%</strong> ·
            mediana <strong>{decimalAr(resumenGlobal.alicuota_mediana_global, { maximumFractionDigits: 3 }) ?? '—'}%</strong>
          </p>
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar el referencial de tarifas. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className={th}>CIIU</th>
                <th className={th}>Provincia</th>
                <th className={th}>Tramo dotación</th>
                <th className={thNum}>Cant.</th>
                <th className={thNum}>Alíc. mín.</th>
                <th className={thNum}>Alíc. máx.</th>
                <th className={thNum}>Alíc. prom.</th>
                <th className={thNum}>Alíc. mediana</th>
                <th className={th}>Antigüedad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => <FilaSkeleton key={i} />)
              ) : items.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-500">No hay datos históricos para estos filtros</td></tr>
              ) : (
                items.map((it, idx) => (
                  <tr key={`${it.ciiu}-${it.tramo_dotacion}-${it.provincia}-${idx}`} className="hover:bg-slate-700/30 transition">
                    <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">{it.ciiu}</td>
                    <td className="px-3 py-3 text-sm text-slate-300 whitespace-nowrap">{it.provincia}</td>
                    <td className="px-3 py-3 text-sm text-slate-300 whitespace-nowrap">{it.tramo_dotacion}</td>
                    <td className={tdNum}>{numeroAr(it.cantidad_observaciones) ?? '0'}</td>
                    <td className={tdNum}>{decimalAr(it.alicuota_minima, { maximumFractionDigits: 3 }) ?? '—'}</td>
                    <td className={tdNum}>{decimalAr(it.alicuota_maxima, { maximumFractionDigits: 3 }) ?? '—'}</td>
                    <td className={tdNum}>{decimalAr(it.alicuota_promedio, { maximumFractionDigits: 3 }) ?? '—'}</td>
                    <td className={tdNum}>{decimalAr(it.alicuota_mediana, { maximumFractionDigits: 3 }) ?? '—'}</td>
                    <td className="px-3 py-3"><BadgeAntiguedad item={it} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArtReferencialTarifasBoard;
