import React, { useEffect, useState } from 'react';
import { Icon } from '../Icons';
import { CANAL_ICON } from './oportunidadConstants';
import { obtenerTimeline, obtenerEmail } from '../Mail/mailApi';
import ComposeModal from '../Mail/ComposeModal';

const iconoPorItem = (item) => {
  if (item.tipo === 'tarea') return 'flag';
  if (item.tipo === 'cambio_estado') return 'arrow-path';
  if (item.tipo === 'email') return 'envelope';
  return CANAL_ICON[item.canal] || 'ellipsis-horizontal';
};

// Timeline unificado (GET /api/v1/crm/interacciones/timeline/{tipo}/{id}):
// interacciones + tareas + cambios de estado + emails en una sola línea de
// tiempo, con ícono distinto por tipo de evento. Los emails se expanden
// inline (GET /api/v1/email/{id} a demanda) y "Redactar" abre el compositor
// con el destinatario precargado. Compartido entre las fichas de Persona,
// Empresa, Grupo, Oportunidad, Lead y Siniestro.
const Timeline = ({ token, tipo, id, destinatarioEmail, oportunidadId }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);
  const [cuerpos, setCuerpos] = useState({});
  const [compose, setCompose] = useState(false);

  const cargar = () => {
    setLoading(true);
    setError(null);
    obtenerTimeline(token, tipo, id)
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tipo && id) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, id]);

  const toggleEmail = async (item) => {
    if (expandidoId === item.id) { setExpandidoId(null); return; }
    setExpandidoId(item.id);
    if (!cuerpos[item.id]) {
      setCuerpos((prev) => ({ ...prev, [item.id]: { loading: true } }));
      try {
        const detalle = await obtenerEmail(token, item.id);
        setCuerpos((prev) => ({ ...prev, [item.id]: { loading: false, detalle } }));
      } catch (err) {
        setCuerpos((prev) => ({ ...prev, [item.id]: { loading: false, error: err.message } }));
      }
    }
  };

  return (
    <div className="space-y-3">
      {destinatarioEmail && (
        <div className="flex justify-end">
          <button
            onClick={() => setCompose(true)}
            className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
          >
            <Icon name="envelope" size={14} />
            Redactar
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-slate-400 text-center py-8">Cargando timeline...</p>
      ) : error ? (
        <p className="text-red-400 text-center py-8 text-sm">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">Sin actividad registrada</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const esEmail = item.tipo === 'email';
            const expandido = esEmail && expandidoId === item.id;
            return (
              <div key={`${item.tipo}-${item.id}`} className="bg-slate-700/30 rounded-lg p-3">
                <div
                  className={`flex gap-3 ${esEmail ? 'cursor-pointer' : ''}`}
                  onClick={() => esEmail && toggleEmail(item)}
                >
                  <div className="shrink-0 mt-0.5 text-blue-400">
                    <Icon name={iconoPorItem(item)} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">{item.titulo || item.asunto || item.canal || 'Actividad'}</span>
                      <span className="text-slate-500 text-xs shrink-0">{item.fecha ? new Date(item.fecha).toLocaleString('es-AR') : ''}</span>
                    </div>
                    {item.detalle && <p className="text-slate-400 text-sm mt-1">{item.detalle}</p>}
                    {item.estado && <span className="inline-block mt-1 px-2 py-0.5 bg-slate-600 rounded text-xs">{item.estado}</span>}
                  </div>
                  {esEmail && (
                    <Icon name="chevron-down" size={14} className={`shrink-0 mt-1 transition-transform ${expandido ? 'rotate-180' : ''}`} />
                  )}
                </div>
                {expandido && (
                  <div className="mt-3 pt-3 border-t border-slate-600 text-sm">
                    {cuerpos[item.id]?.loading ? (
                      <p className="text-slate-400">Cargando correo...</p>
                    ) : cuerpos[item.id]?.error ? (
                      <p className="text-red-400">{cuerpos[item.id].error}</p>
                    ) : (
                      <p className="text-slate-300 whitespace-pre-wrap">
                        {cuerpos[item.id]?.detalle?.cuerpo || cuerpos[item.id]?.detalle?.snippet || 'Sin contenido'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {compose && (
        <ComposeModal
          token={token}
          destinatarioInicial={destinatarioEmail}
          tipoEntidad={tipo}
          entidadId={id}
          oportunidadId={oportunidadId}
          onClose={() => setCompose(false)}
          onEnviado={cargar}
        />
      )}
    </div>
  );
};

export default Timeline;
