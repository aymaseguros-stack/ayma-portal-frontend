import React from 'react';
import { Icon } from '../Icons';

// C-4c · Las marcas de contacto de una persona, visibles en la cabecera de su
// ficha -en TODAS las pestañas, no sólo en Datos-.
//
// `no_contactar` es "no lo persigas por teléfono" (no se programan
// seguimientos); `excluir_whatsapp` es "lo que te escribe no se archiva"
// (D-C30). Son dos cosas distintas y se muestran separadas: quien abre la
// ficha para llamar tiene que ver la primera antes de marcar el número.
const MarcasContacto = ({ persona }) => {
  if (!persona?.no_contactar && !persona?.excluir_whatsapp) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="marcas-contacto">
      {persona.no_contactar && (
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/15 border border-red-500/50 text-red-200 rounded-full text-xs font-semibold"
          title={persona.no_contactar_motivo || undefined}
        >
          <Icon name="exclamation-triangle" size={14} />
          NO CONTACTAR
          {persona.no_contactar_motivo && (
            <span className="font-normal text-red-200/80">· {persona.no_contactar_motivo}</span>
          )}
        </span>
      )}
      {persona.excluir_whatsapp && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/15 border border-amber-500/50 text-amber-200 rounded-full text-xs font-semibold">
          <Icon name="chat-bubble" size={14} />
          WhatsApp: sólo metadata
        </span>
      )}
    </div>
  );
};

export default MarcasContacto;
