import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarEmails } from './mailApi';
import VincularBuscador from './VincularBuscador';

// Correos que llegaron pero no quedaron atados a ninguna ficha del CRM
// (GET /api/v1/email?estado_vinculacion=SIN_VINCULAR). Cada fila tiene su
// botón "Vincular" para resolverlo ahí mismo, sin abrir el detalle.
const SinVincularTab = ({ token }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [emailAVincular, setEmailAVincular] = useState(null);

  const cargar = async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await listarEmails(token, { estado_vinculacion: 'SIN_VINCULAR' });
      setItems(items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [token]);

  return (
    <div className="space-y-4">
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold">Correos sin vincular</h3>
          <span className="text-sm text-slate-400">{items.length} mensajes</span>
        </div>

        {error ? (
          <div className="p-8 text-center">
            <p className="text-red-300 font-semibold">No se pudo cargar el listado</p>
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-center py-12">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center py-12">Todo vinculado, sin pendientes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Remitente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Asunto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">{m.remitente_nombre || m.remitente_email}</td>
                    <td className="px-4 py-3 text-sm">
                      <span>{m.asunto || '(sin asunto)'}</span>
                      {m.snippet && <span className="text-slate-500 ml-2 hidden lg:inline">— {m.snippet}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {m.fecha ? new Date(m.fecha).toLocaleString('es-AR') : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEmailAVincular(m.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 rounded transition text-sm whitespace-nowrap"
                      >
                        <Icon name="link" size={14} />
                        Vincular
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {emailAVincular && (
        <VincularBuscador
          token={token}
          emailId={emailAVincular}
          onClose={() => setEmailAVincular(null)}
          onVinculado={cargar}
        />
      )}
    </div>
  );
};

export default SinVincularTab;
