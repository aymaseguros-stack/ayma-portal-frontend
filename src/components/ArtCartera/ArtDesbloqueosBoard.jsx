import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarDesbloqueos } from './artCarteraApi';
import { aseguradoraLabel } from './artCarteraConstants';

const LIMIT = 50;
const OPCIONES_DIAS = [7, 15, 30];

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

// Pantalla C.1 - Desbloqueos (leads calientes): bloqueos que caducan dentro
// de los próximos N días. GET /art/desbloqueos?dias=N. 0 resultados es un
// estado normal, no un error - se muestra como empty state explícito.
const ArtDesbloqueosBoard = ({ token, onAbrirFicha }) => {
  const [dias, setDias] = useState(7);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { setOffset(0); }, [dias]);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resultado = await listarDesbloqueos(token, { dias, limit: LIMIT, offset });
        if (cancelado) return;
        setItems(resultado.items);
        setTotal(resultado.total);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, dias, offset]);

  const puedeAnterior = offset > 0;
  const puedeSiguiente = offset + LIMIT < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Desbloqueos</h2>
          <p className="text-slate-400 text-sm mt-1">Bloqueos que caducan pronto: la aseguradora vuelve a estar disponible.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-xs">Próximos</label>
          <select
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            className="px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm"
          >
            {OPCIONES_DIAS.map((d) => <option key={d} value={d}>{d} días</option>)}
          </select>
        </div>
      </div>

      {error && !loading && (
        <div className="bg-red-500/15 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
          <Icon name="exclamation-triangle" className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-200 text-sm">No se pudieron cargar los desbloqueos. {error}</p>
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Razón social</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">CUIT</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Dotación</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Aseguradora</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Bloqueado por</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Caduca</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Teléfono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <FilaSkeleton key={i} />)
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay desbloqueos en los próximos {dias} días. No es un error: hoy la cola está vacía.
                  </td>
                </tr>
              ) : (
                items.map((it, idx) => {
                  const clickable = Boolean(it.cuit);
                  return (
                    <tr
                      key={`${it.cuit || it.razon_social}-${it.aseguradora}-${idx}`}
                      onClick={clickable ? () => onAbrirFicha(it.cuit) : undefined}
                      className={clickable ? 'hover:bg-slate-700/30 transition cursor-pointer' : 'opacity-70'}
                    >
                      <td className="px-4 py-3 text-sm font-medium">{it.razon_social}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{it.cuit || '-'}</td>
                      <td className="px-4 py-3 text-sm text-center">{it.dotacion ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-300 capitalize">{aseguradoraLabel(it.aseguradora)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{it.productor_bloqueante || '-'}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-slate-300">{fechaCorta(it.fecha_caducidad)}</span>
                        <span className="text-slate-500"> · {it.dias_restantes} días</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400">{it.telefono || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700 text-sm text-slate-400">
          <span>{total > 0 ? `${total} en total` : ''}</span>
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

export default ArtDesbloqueosBoard;
