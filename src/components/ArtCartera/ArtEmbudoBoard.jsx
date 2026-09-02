import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { numeroSeguro } from '../../utils/api';
import { obtenerEmbudoArt } from './artCarteraApi';
import { ASEGURADORAS_ART, numeroAr, decimalAr } from './artCarteraConstants';

const CANTIDAD_DESTACADOS = 3;

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 11 }).map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[70px]" /></td>
    ))}
  </tr>
);

const th = 'px-3 py-3 text-left text-sm font-medium text-slate-300 whitespace-nowrap';
const thNum = 'px-3 py-3 text-right text-sm font-medium text-slate-300 whitespace-nowrap';
const tdNum = 'px-3 py-3 text-sm text-right text-slate-300 whitespace-nowrap';

// Calcula qué aseguradoras destacar: las de mayor `delta_alicuota` (perdedora
// - ganadora) son donde más margen hay para bajar la alícuota ganadora y
// llevarse más cuentas - ver instrucción del Bloque 6b. Top 3 por delta
// numérico válido; si hay menos de 3 con delta, destaca las que haya.
const calcularDestacadas = (items) => {
  const conDelta = (items || [])
    .map((it) => ({ aseguradora: it?.aseguradora, delta: Number(it?.delta_alicuota) }))
    .filter((it) => it.aseguradora && Number.isFinite(it.delta));
  conDelta.sort((a, b) => b.delta - a.delta);
  return new Set(conDelta.slice(0, CANTIDAD_DESTACADOS).map((it) => it.aseguradora));
};

// Pestaña 1 del tablero de gestión (Bloque 6b) - Embudo comercial por
// aseguradora. GET /art/embudo?desde&hasta (app/api/v1/art_dashboard.py).
// Siempre 12 filas en el orden fijo de ASEGURADORAS_ART, incluso si el
// backend manda menos (campos faltantes) o nada (null/error).
const ArtEmbudoBoard = ({ token }) => {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [items, setItems] = useState([]);
  const [referenciaHistorica, setReferenciaHistorica] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await obtenerEmbudoArt(token, { desde, hasta });
        if (cancelado) return;
        setItems(Array.isArray(resultado.items) ? resultado.items : []);
        setReferenciaHistorica(resultado.referencia_historica || null);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, desde, hasta]);

  const porAseguradora = new Map((items || []).map((it) => [it?.aseguradora, it]));
  const destacadas = calcularDestacadas(items);
  const hayFiltros = Boolean(desde || hasta);

  const COLUMNAS_INT = ['en_gestion', 'cotizadas', 'ganadas', 'perdidas', 'rechazadas', 'bloqueadas', 'tecnica'];
  const totales = COLUMNAS_INT.reduce((acc, col) => {
    acc[col] = ASEGURADORAS_ART.reduce((sum, a) => sum + (numeroSeguro(porAseguradora.get(a.id)?.[col]) ?? 0), 0);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Embudo</h2>
          <p className="text-slate-400 text-sm mt-1">Embudo comercial por aseguradora: en gestión, cotizadas, ganadas y perdidas.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="block text-slate-400 text-xs mb-1">Desde</label>
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1">Hasta</label>
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
            />
          </div>
          {hayFiltros && (
            <button
              type="button"
              onClick={() => { setDesde(''); setHasta(''); }}
              className="px-3 py-2 text-sm text-slate-400 hover:text-white transition"
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex items-start gap-3">
        <Icon name="chart-bar" className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="text-slate-300">
            Referencia histórica (planilla): alícuota promedio ganadora{' '}
            <strong>{decimalAr(referenciaHistorica?.alicuota_promedio_ganadora, { maximumFractionDigits: 3 }) ?? '—'}%</strong>
            {' '}· perdedora{' '}
            <strong>{decimalAr(referenciaHistorica?.alicuota_promedio_perdedora, { maximumFractionDigits: 3 }) ?? '—'}%</strong>
            {' '}· delta{' '}
            <strong>{decimalAr(referenciaHistorica?.delta_alicuota, { maximumFractionDigits: 3 }) ?? '—'}%</strong>
          </p>
          <p className="text-slate-500 text-xs mt-1">
            Se destacan en verde las {CANTIDAD_DESTACADOS} aseguradoras con mayor delta entre alícuota perdedora y
            ganadora: ahí hay más margen para bajar precio y ganar más cuentas.
          </p>
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar el embudo. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className={th}>Aseguradora</th>
                <th className={thNum}>En gestión</th>
                <th className={thNum}>Cotizadas</th>
                <th className={thNum}>Ganadas</th>
                <th className={thNum}>Perdidas</th>
                <th className={thNum}>Rechazadas</th>
                <th className={thNum}>Bloqueadas</th>
                <th className={thNum}>Técnica</th>
                <th className={thNum}>Alíc. ganadora</th>
                <th className={thNum}>Alíc. perdedora</th>
                <th className={thNum}>Delta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => <FilaSkeleton key={i} />)
              ) : (
                ASEGURADORAS_ART.map((a) => {
                  const item = porAseguradora.get(a.id) || {};
                  const destacada = destacadas.has(a.id);
                  return (
                    <tr key={a.id} className={destacada ? 'bg-green-500/10' : ''}>
                      <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {a.label}
                          {destacada && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/20 text-green-300">
                              Mayor margen
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={tdNum}>{numeroAr(item.en_gestion) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.cotizadas) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.ganadas) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.perdidas) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.rechazadas) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.bloqueadas) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.tecnica) ?? '0'}</td>
                      <td className={tdNum}>
                        {decimalAr(item.alicuota_promedio_ganadora, { maximumFractionDigits: 3 })
                          ? `${decimalAr(item.alicuota_promedio_ganadora, { maximumFractionDigits: 3 })}%` : '—'}
                      </td>
                      <td className={tdNum}>
                        {decimalAr(item.alicuota_promedio_perdedora, { maximumFractionDigits: 3 })
                          ? `${decimalAr(item.alicuota_promedio_perdedora, { maximumFractionDigits: 3 })}%` : '—'}
                      </td>
                      <td className={`${tdNum} ${destacada ? 'text-green-400 font-semibold' : ''}`}>
                        {decimalAr(item.delta_alicuota, { maximumFractionDigits: 3 })
                          ? `${decimalAr(item.delta_alicuota, { maximumFractionDigits: 3 })}%` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {!loading && (
              <tfoot className="bg-slate-700/30 border-t border-slate-600 font-semibold">
                <tr>
                  <td className="px-3 py-3 text-sm">Totales</td>
                  <td className={tdNum}>{totales.en_gestion.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.cotizadas.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.ganadas.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.perdidas.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.rechazadas.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.bloqueadas.toLocaleString('es-AR')}</td>
                  <td className={tdNum}>{totales.tecnica.toLocaleString('es-AR')}</td>
                  <td className={tdNum} colSpan={3}>—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default ArtEmbudoBoard;
