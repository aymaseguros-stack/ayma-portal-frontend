import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerMercadoArt } from './artCarteraApi';
import { ASEGURADORAS_ART, numeroAr, decimalAr } from './artCarteraConstants';

const th = 'px-3 py-3 text-left text-sm font-medium text-slate-300 whitespace-nowrap';
const thNum = 'px-3 py-3 text-right text-sm font-medium text-slate-300 whitespace-nowrap';
const tdNum = 'px-3 py-3 text-sm text-right text-slate-300 whitespace-nowrap';

const FilaSkeleton = ({ columnas }) => (
  <tr className="animate-pulse">
    {Array.from({ length: columnas }).map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[70px]" /></td>
    ))}
  </tr>
);

// Pestaña 3 del tablero de gestión (Bloque 6b) - Mercado. GET /art/mercado
// (app/api/v1/art_dashboard.py): cartera propia por aseguradora vs. el
// boletín SSN/SRT importado con POST /art/mercado/importar. Si no hay
// ningún período cargado (`mercado_sin_datos: true`, o el flag falta en
// una respuesta mal formada) se muestra un empty state explícito y la
// tabla se reduce a solo cartera propia - NUNCA se inventa un número de
// mercado o de share que el backend no mandó.
const ArtMercadoBoard = ({ token }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await obtenerMercadoArt(token);
        if (!cancelado) setData(resultado || {});
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const porAseguradora = new Map(items.map((it) => [it?.aseguradora, it]));
  const sinDatos = Boolean(data?.mercado_sin_datos) || items.length === 0;
  const periodo = data?.periodo;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Mercado</h2>
          <p className="text-slate-400 text-sm mt-1">Cartera propia por aseguradora comparada contra el boletín SSN/SRT.</p>
        </div>
        {!loading && periodo && (
          <span className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-300 text-sm">Período: {periodo}</span>
        )}
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudo cargar la comparación de mercado. {error}</p>
        </div>
      )}

      {!loading && !error && sinDatos && (
        <div className="bg-blue-500/10 border border-blue-500/40 rounded-lg p-4 flex items-start gap-3">
          <Icon name="document-text" className="text-blue-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="text-blue-200 font-medium">Todavía no se cargaron los datos de mercado.</p>
            <p className="text-slate-400 mt-1">
              Falta importar el boletín SSN/SRT del período (POST /art/mercado/importar) para poder comparar
              participación y share. Mientras tanto, la cartera propia por aseguradora se puede ver igual abajo.
            </p>
          </div>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className={th}>Aseguradora</th>
                <th className={thNum}>Empresas propias</th>
                <th className={thNum}>Trabajadores propios</th>
                {!sinDatos && (
                  <>
                    <th className={thNum}>Empleadores mercado</th>
                    <th className={thNum}>Trabajadores mercado</th>
                    <th className={thNum}>Participación % mercado</th>
                    <th className={thNum}>Share empleadores %</th>
                    <th className={thNum}>Share trabajadores %</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 12 }).map((_, i) => <FilaSkeleton key={i} columnas={sinDatos ? 3 : 8} />)
              ) : (
                ASEGURADORAS_ART.map((a) => {
                  const item = porAseguradora.get(a.id) || {};
                  return (
                    <tr key={a.id}>
                      <td className="px-3 py-3 text-sm font-medium whitespace-nowrap">{a.label}</td>
                      <td className={tdNum}>{numeroAr(item.empresas_propias) ?? '0'}</td>
                      <td className={tdNum}>{numeroAr(item.trabajadores_propios) ?? '0'}</td>
                      {!sinDatos && (
                        <>
                          <td className={tdNum}>{numeroAr(item.empleadores_mercado) ?? '—'}</td>
                          <td className={tdNum}>{numeroAr(item.trabajadores_mercado) ?? '—'}</td>
                          <td className={tdNum}>
                            {decimalAr(item.participacion_pct_mercado, { maximumFractionDigits: 3 })
                              ? `${decimalAr(item.participacion_pct_mercado, { maximumFractionDigits: 3 })}%` : '—'}
                          </td>
                          <td className={tdNum}>
                            {decimalAr(item.share_empleadores_pct, { maximumFractionDigits: 2 })
                              ? `${decimalAr(item.share_empleadores_pct, { maximumFractionDigits: 2 })}%` : '—'}
                          </td>
                          <td className={tdNum}>
                            {decimalAr(item.share_trabajadores_pct, { maximumFractionDigits: 2 })
                              ? `${decimalAr(item.share_trabajadores_pct, { maximumFractionDigits: 2 })}%` : '—'}
                          </td>
                        </>
                      )}
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

export default ArtMercadoBoard;
