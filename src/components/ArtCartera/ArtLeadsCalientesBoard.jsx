import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarLeadsSinCobertura } from './artCarteraApi';
import { numeroAr } from './artCarteraConstants';

const LIMIT = 50;

const labelClass = 'block text-slate-400 text-xs mb-1';
const inputClass = 'px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm placeholder-slate-500';

const fechaCorta = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString('es-AR');
};

const FilaSkeleton = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3"><div className="h-3 bg-slate-700 rounded w-full max-w-[100px]" /></td>
    ))}
  </tr>
);

// Sub-pestaña "Leads Calientes" (BLOQUE 7) - empresas verificadas SIN ART
// vigente que SÍ tuvieron cobertura antes (perdieron cobertura, no "nunca
// tuvieron"). GET /art/leads-sin-cobertura (backend ya existe, PR #49) -
// solo lectura, sin acciones de escritura todavía. El backend ya ordena:
// con historial primero (más reciente primero), sin historial al final
// (alfabético) - el cliente no reordena.
const ArtLeadsCalientesBoard = ({ token, onAbrirFicha }) => {
  const [motivoFin, setMotivoFin] = useState('');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setOffset(0); }, [motivoFin]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    const t = setTimeout(async () => {
      try {
        const resultado = await listarLeadsSinCobertura(token, { motivo_fin: motivoFin || undefined, limit: LIMIT, offset });
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
  }, [token, motivoFin, offset]);

  const puedeAnterior = offset > 0;
  const puedeSiguiente = offset + LIMIT < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Leads Calientes</h2>
          <p className="text-slate-400 text-sm mt-1">
            Empresas sin ART vigente que tuvieron cobertura y la perdieron - a diferencia de las que nunca tuvieron
            contrato, acá el historial (fecha y motivo de baja) ya está confirmado en la SRT.
          </p>
        </div>
        <div>
          <label className={labelClass}>Motivo de baja</label>
          <input
            type="text"
            value={motivoFin}
            onChange={(e) => setMotivoFin(e.target.value)}
            placeholder="Ej. falta de pago"
            className={`${inputClass} w-56`}
          />
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudieron cargar los leads calientes. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Razón social</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CUIT</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">ART anterior</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Motivo de baja</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha de baja</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Días desde baja</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Dotación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <FilaSkeleton key={i} />)
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay leads calientes para estos filtros.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const clickable = Boolean(it.cuit);
                  return (
                    <tr
                      key={`${it.cuit || it.razon_social}-${idx}`}
                      onClick={clickable && onAbrirFicha ? () => onAbrirFicha(it.cuit) : undefined}
                      className={clickable && onAbrirFicha ? 'hover:bg-slate-700/30 transition cursor-pointer' : 'opacity-70'}
                    >
                      <td className="px-4 py-3 text-sm font-medium">
                        <div className="flex items-center gap-2">
                          {it.razon_social}
                          {!it.tiene_historial && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-500/20 text-slate-400">
                              Sin historial
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{it.cuit || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 capitalize">{it.ultima_art || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{it.motivo_baja || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300">{fechaCorta(it.fecha_baja) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-right text-slate-300">{numeroAr(it.dias_desde_baja) ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">{it.dotacion ?? '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
          <span>{total > 0 ? `${total.toLocaleString('es-AR')} en total` : ''}</span>
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

export default ArtLeadsCalientesBoard;
