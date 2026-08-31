import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { obtenerEmail, marcarEmailComoRuido, ESTADOS_VINCULACION_BADGE } from './mailApi';

// Panel lateral con el cuerpo de un correo, cargado a demanda (GET
// /api/v1/email/{id}) al hacer clic en una fila de la Bandeja o de Enviados.
// Expone Responder, Vincular y "Marcar como ruido".
const EmailDetailPanel = ({ token, emailId, onClose, onResponder, onVincular, onMarcadoRuido }) => {
  const [detalle, setDetalle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [marcando, setMarcando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    obtenerEmail(token, emailId)
      .then((data) => { if (!cancelado) setDetalle(data); })
      .catch((err) => { if (!cancelado) setError(err.message); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [token, emailId]);

  const marcarRuido = async () => {
    setMarcando(true);
    try {
      await marcarEmailComoRuido(token, emailId);
      onMarcadoRuido?.(emailId);
      onClose();
    } catch (err) {
      alert('No se pudo marcar como ruido: ' + err.message);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-xl bg-slate-800 border-l border-slate-700 z-50 overflow-y-auto shadow-2xl">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between sticky top-0 bg-slate-800">
          <h3 className="font-semibold truncate pr-4">{loading ? 'Cargando...' : (detalle?.asunto || '(sin asunto)')}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition shrink-0" aria-label="Cerrar">
            <Icon name="x-mark" size={20} />
          </button>
        </div>

        {loading ? (
          <p className="text-slate-400 text-center py-12">Cargando correo...</p>
        ) : error ? (
          <p className="text-red-400 text-center py-12 px-4">{error}</p>
        ) : detalle ? (
          <div className="p-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {detalle.estado_vinculacion && (
                <span className={`px-2 py-1 rounded text-xs font-medium ${ESTADOS_VINCULACION_BADGE[detalle.estado_vinculacion] || 'bg-slate-500/20 text-slate-400'}`}>
                  {detalle.estado_vinculacion === 'VINCULADO' ? 'Vinculado' : 'Sin vincular'}
                </span>
              )}
              {detalle.entidad_vinculada?.nombre && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                  {detalle.entidad_vinculada.nombre}
                </span>
              )}
            </div>

            <div className="text-sm space-y-1">
              <p><span className="text-slate-500">De:</span> {detalle.remitente_nombre ? `${detalle.remitente_nombre} <${detalle.remitente_email}>` : detalle.remitente_email}</p>
              {detalle.destinatario_email && <p><span className="text-slate-500">Para:</span> {detalle.destinatario_email}</p>}
              <p><span className="text-slate-500">Fecha:</span> {detalle.fecha ? new Date(detalle.fecha).toLocaleString('es-AR') : '-'}</p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => onResponder?.(detalle)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
              >
                <Icon name="arrow-right" size={14} />
                Responder
              </button>
              <button
                onClick={() => onVincular?.(detalle)}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition text-sm"
              >
                <Icon name="link" size={14} />
                Vincular
              </button>
              <button
                onClick={marcarRuido}
                disabled={marcando}
                className="inline-flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg transition text-sm"
              >
                <Icon name="exclamation-triangle" size={14} />
                {marcando ? 'Marcando...' : 'Marcar como ruido'}
              </button>
            </div>

            <div className="border-t border-slate-700 pt-4">
              {detalle.cuerpo_html ? (
                <div className="prose prose-invert prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: detalle.cuerpo_html }} />
              ) : (
                <p className="text-slate-300 whitespace-pre-wrap text-sm">{detalle.cuerpo || detalle.snippet || 'Sin contenido'}</p>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
};

export default EmailDetailPanel;
