import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icons';
import {
  DIRECCION_LABEL, ESTADO_MEDIA_LABEL, cambiarExcluirWhatsapp, horaMeta,
  linkDrive, listarMensajes, tipoLegible,
} from './whatsappApi';

// C-4c · La sección "WhatsApp" de la ficha de persona y de oportunidad.
//
// METADATA Y NADA MÁS. Dirección, hora de Meta, tipo y, si había archivo y
// ya está en Drive, el link. EL TEXTO NUNCA: la base no lo tiene (D-C27) y
// esta sección no lo va a buscar al JSONL. Una ficha que mostrara lo que el
// cliente escribió convertiría cada pantalla del CRM en un lector de chats.
//
// El toggle "Excluir WhatsApp" sólo aparece en la ficha de PERSONA (es un
// atributo de ella, no de una oportunidad) y sólo lo puede mover un ADMIN:
// el agente lo ve como estado, no como control. El backend igual le contesta
// 403 a un EMPLEADO.

const ToggleExcluir = ({ token, persona, esAdmin, onPersonaActualizada }) => {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const activo = Boolean(persona.excluir_whatsapp);

  const cambiar = async () => {
    if (guardando) return;
    const nuevo = !activo;
    const pregunta = nuevo
      ? 'Desde ahora, de los WhatsApp de esta persona se guarda SÓLO metadata: ni texto ni archivos. ¿Confirmás?'
      : 'Desde ahora, el texto y los archivos de sus WhatsApp se vuelven a archivar en el Drive. Lo que llegó mientras estuvo excluida NO se recupera. ¿Confirmás?';
    if (!window.confirm(pregunta)) return;
    setGuardando(true);
    setError(null);
    try {
      const actualizada = await cambiarExcluirWhatsapp(token, persona.id, nuevo);
      onPersonaActualizada?.(actualizada);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-sm font-medium">Excluir WhatsApp (solo metadata)</p>
          <p className="text-xs text-slate-400">
            Con esto activo no se guarda el texto ni los archivos de sus mensajes; sólo quién, cuándo y de qué tipo.
          </p>
        </div>
        {esAdmin ? (
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            aria-label="Excluir WhatsApp (solo metadata)"
            onClick={cambiar}
            disabled={guardando}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${activo ? 'bg-amber-500' : 'bg-slate-600'}`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${activo ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        ) : (
          <span className={`px-2 py-1 rounded text-xs font-medium ${activo ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-600/40 text-slate-300'}`}>
            {activo ? 'Activo' : 'Inactivo'} · sólo ADMIN lo cambia
          </span>
        )}
      </div>
      {error && <p role="alert" className="text-red-300 text-xs">{error}</p>}
    </div>
  );
};

const WhatsappSeccion = ({ token, personaId, oportunidadId, persona, esAdmin, onPersonaActualizada }) => {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await listarMensajes(token, { personaId, oportunidadId });
      setItems(res.items || []);
      setTotal(res.total ?? (res.items || []).length);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, [token, personaId, oportunidadId]);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="space-y-4">
      {persona && (
        <ToggleExcluir token={token} persona={persona} esAdmin={esAdmin} onPersonaActualizada={onPersonaActualizada} />
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">
          Sólo metadata: el texto de los mensajes no se muestra en el CRM.
        </p>
        <span className="text-xs text-slate-400">{total} mensaje(s)</span>
      </div>

      {error ? (
        <p role="alert" className="text-red-300 text-sm">No se pudieron cargar los mensajes: {error}</p>
      ) : cargando ? (
        <p className="text-slate-400 text-sm py-4 text-center">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500 text-sm py-4 text-center">Sin mensajes de WhatsApp registrados.</p>
      ) : (
        <ul className="divide-y divide-slate-700 border border-slate-700 rounded-lg" aria-label="Mensajes de WhatsApp">
          {items.map((m) => {
            const link = linkDrive(m);
            const estadoMedia = ESTADO_MEDIA_LABEL[m.estado_media];
            const entrante = m.direccion === 'IN';
            return (
              <li key={m.id} className="px-3 py-2 flex items-center gap-3 flex-wrap text-sm" data-testid={`wa-${m.id}`}>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${entrante ? 'bg-green-500/20 text-green-300' : 'bg-blue-500/20 text-blue-300'}`}
                >
                  {entrante ? '↓' : '↑'} {DIRECCION_LABEL[m.direccion] || m.direccion}
                </span>
                <span className="text-slate-300 whitespace-nowrap">{horaMeta(m.enviado_en)}</span>
                <span className="text-slate-400">{tipoLegible(m.tipo)}</span>
                {m.origen === 'HISTORIAL' && <span className="text-xs text-slate-500">historial</span>}
                {m.origen === 'ECO_APP' && <span className="text-xs text-slate-500">desde la app</span>}
                <span className="ml-auto flex items-center gap-2">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-300 hover:text-blue-200 underline text-xs"
                    >
                      <Icon name="arrow-top-right-on-square" size={12} />
                      Adjunto en Drive
                    </a>
                  ) : estadoMedia ? (
                    <span className={`text-xs ${m.estado_media === 'FALLIDO' ? 'text-red-300' : 'text-slate-500'}`}>
                      Adjunto: {estadoMedia}
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WhatsappSeccion;
