import React, { useEffect, useState } from 'react';
import { listarEmails } from './mailApi';

// Correos enviados desde el portal (GET /api/v1/email?direccion=OUT).
const EnviadosTab = ({ token, onAbrirEmail }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { items } = await listarEmails(token, { direccion: 'OUT' });
        setItems(items);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center">
        <h3 className="font-semibold">Enviados</h3>
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
        <p className="text-slate-500 text-center py-12">Todavía no se envió ningún correo desde el portal</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Para</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Asunto</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {items.map((m) => (
                <tr key={m.id} onClick={() => onAbrirEmail(m.id)} className="hover:bg-slate-700/30 cursor-pointer">
                  <td className="px-4 py-3 text-sm max-w-[200px] truncate">{m.destinatario_email || m.destinatario_nombre}</td>
                  <td className="px-4 py-3 text-sm">{m.asunto || '(sin asunto)'}</td>
                  <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                    {m.fecha ? new Date(m.fecha).toLocaleString('es-AR') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EnviadosTab;
