import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { listarEmails, remitentesFrecuentes, ignorarRemitente } from './mailApi';

// Herramienta de limpieza masiva: arriba, el ranking de remitentes frecuentes
// dentro del ruido (GET /remitentes-frecuentes) con "Ignorar remitente"
// (POST /ignorar-remitente, marca retroactivo); abajo, el detalle de todo lo
// no relevante (GET /api/v1/email?relevante=false).
const RuidoTab = ({ token }) => {
  const [remitentes, setRemitentes] = useState([]);
  const [remitentesLoading, setRemitentesLoading] = useState(true);
  const [remitentesError, setRemitentesError] = useState(null);
  const [ignorando, setIgnorando] = useState(null);
  const [ultimoResultado, setUltimoResultado] = useState(null);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarRemitentes = () => {
    setRemitentesLoading(true);
    setRemitentesError(null);
    remitentesFrecuentes(token)
      .then(setRemitentes)
      .catch((err) => setRemitentesError(err.message))
      .finally(() => setRemitentesLoading(false));
  };

  const cargarRuido = () => {
    setLoading(true);
    setError(null);
    listarEmails(token, { relevante: false })
      .then(({ items }) => setItems(items))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { cargarRemitentes(); cargarRuido(); }, [token]);

  const handleIgnorar = async (remitente) => {
    setIgnorando(remitente);
    setUltimoResultado(null);
    try {
      const data = await ignorarRemitente(token, remitente);
      const marcados = data.marcados ?? data.count ?? 0;
      setUltimoResultado(`"${remitente}" ignorado. Se marcaron ${marcados} correos retroactivamente como ruido.`);
      cargarRemitentes();
      cargarRuido();
    } catch (err) {
      alert('No se pudo ignorar el remitente: ' + err.message);
    } finally {
      setIgnorando(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700">
          <h3 className="font-semibold">Remitentes frecuentes</h3>
          <p className="text-slate-500 text-sm mt-1">Ignorá un remitente para excluirlo a futuro y limpiar retroactivamente lo ya recibido.</p>
        </div>

        {ultimoResultado && (
          <div className="mx-4 mt-4 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 px-4 py-2 rounded-lg text-sm">
            {ultimoResultado}
          </div>
        )}

        {remitentesError ? (
          <div className="p-8 text-center">
            <p className="text-red-300 font-semibold">No se pudo cargar el ranking</p>
            <p className="text-red-400/80 text-sm mt-2">{remitentesError}</p>
          </div>
        ) : remitentesLoading ? (
          <p className="text-slate-400 text-center py-8">Cargando...</p>
        ) : remitentes.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Sin remitentes frecuentes</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Remitente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Cantidad</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {remitentes.map((r) => (
                  <tr key={r.remitente} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm">{r.remitente}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">{r.count ?? r.cantidad}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleIgnorar(r.remitente)}
                        disabled={ignorando === r.remitente}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 disabled:opacity-50 text-red-300 rounded transition text-sm whitespace-nowrap"
                      >
                        <Icon name="exclamation-triangle" size={14} />
                        {ignorando === r.remitente ? 'Ignorando...' : 'Ignorar remitente'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-semibold">Correos marcados como ruido</h3>
          <span className="text-sm text-slate-400">{items.length} mensajes</span>
        </div>
        {error ? (
          <div className="p-8 text-center">
            <p className="text-red-300 font-semibold">No se pudo cargar el listado</p>
            <p className="text-red-400/80 text-sm mt-2">{error}</p>
          </div>
        ) : loading ? (
          <p className="text-slate-400 text-center py-8">Cargando...</p>
        ) : items.length === 0 ? (
          <p className="text-slate-500 text-center py-8">Sin ruido registrado</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Remitente</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Asunto</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-sm max-w-[200px] truncate">{m.remitente_nombre || m.remitente_email}</td>
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
    </div>
  );
};

export default RuidoTab;
