import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarEmails, ESTADOS_VINCULACION_BADGE } from './mailApi';

const PAGE_SIZE = 25;

// Tabla de la bandeja de entrada relevante (GET /api/v1/email?direccion=IN&
// relevante=true), con buscador y paginación real: el backend tiene ~1000
// mensajes, así que se pagina server-side en vez de traer todo de una.
const BandejaTab = ({ token, onAbrirEmail, refreshKey }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [qDebounced, setQDebounced] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => { setQDebounced(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { items, total } = await listarEmails(token, { direccion: 'IN', relevante: true, q: qDebounced, page, page_size: PAGE_SIZE });
        if (cancelado) return;
        setItems(items);
        setTotal(total);
      } catch (err) {
        if (!cancelado) setError(err.message);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [token, qDebounced, page, refreshKey]);

  const totalPaginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
          <Icon name="magnifying-glass" size={16} />
        </span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por remitente, asunto..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-slate-700/50 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-red-300 font-semibold">No se pudo cargar la bandeja</p>
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-center py-12">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Sin mensajes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Remitente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Asunto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300 hidden md:table-cell">Vínculo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((m) => {
                  const noLeido = m.leido === false;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => onAbrirEmail(m.id)}
                      className="hover:bg-slate-700/30 cursor-pointer"
                    >
                      <td className={`px-4 py-3 text-sm max-w-[180px] truncate ${noLeido ? 'font-bold text-white' : 'text-slate-300'}`}>
                        {m.remitente_nombre || m.remitente_email}
                      </td>
                      <td className={`px-4 py-3 text-sm ${noLeido ? 'font-bold text-white' : ''}`}>
                        <span>{m.asunto || '(sin asunto)'}</span>
                        {m.snippet && <span className="text-slate-500 font-normal ml-2 hidden lg:inline">— {m.snippet}</span>}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${ESTADOS_VINCULACION_BADGE[m.estado_vinculacion] || 'bg-slate-500/20 text-slate-400'}`}>
                            {m.estado_vinculacion === 'VINCULADO' ? 'Vinculado' : 'Sin vincular'}
                          </span>
                          {m.entidad_vinculada?.nombre && (
                            <span className="text-slate-400 text-xs truncate max-w-[120px]">{m.entidad_vinculada.nombre}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                        {m.fecha ? new Date(m.fecha).toLocaleString('es-AR') : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && total > PAGE_SIZE && (
          <div className="p-4 border-t border-slate-700 flex items-center justify-between text-sm">
            <span className="text-slate-400">{total} mensajes · página {page} de {totalPaginas}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg transition"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}
                disabled={page >= totalPaginas}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BandejaTab;
