import React from 'react';
import { VISIBILIDADES, AYUDA_VISIBILIDAD } from './visibilidadListados';

// L-2: el selector de visibilidad y la marca de una fila dada de baja.
//
// El VOCABULARIO vive en `visibilidadListados.js` (sin JSX) y no acá: un
// archivo que exporta componentes y constantes a la vez rompe el fast refresh
// de Vite, y además las constantes las importan módulos que no dibujan nada.
const SelectorVisibilidad = ({ valor, onCambio, esAdmin, id = 'visibilidad', etiqueta = 'Ver' }) => {
  if (!esAdmin) return null;
  const ayuda = AYUDA_VISIBILIDAD[valor];
  return (
    <div>
      <label className="block text-slate-400 text-xs mb-1" htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="px-3 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm"
      >
        {VISIBILIDADES.map((v) => <option key={v.valor} value={v.valor}>{v.label}</option>)}
      </select>
      {ayuda && <p className="text-slate-500 text-xs mt-1 max-w-sm">{ayuda}</p>}
    </div>
  );
};

// La marca de una fila dada de baja: motivo, fecha y quién. Los tres juntos y
// no sólo el badge: "está de baja" no deja decidir nada, "duplicado, el 12/09,
// por Sebastián" sí -que es lo que uno necesita cuando está depurando y se
// pregunta si este registro ya se resolvió-.
export const MarcaDeBaja = ({ fila, motivoLabel = {}, formatearFecha = (v) => v }) => {
  if (!fila?.dada_de_baja_en) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs">
      <span className="px-2 py-0.5 bg-slate-600/40 text-slate-300 rounded">Dada de baja</span>
      <span className="text-slate-400">
        {motivoLabel[fila.baja_motivo] || fila.baja_motivo || 'sin motivo'}
        {fila.dada_de_baja_en && ` · ${formatearFecha(fila.dada_de_baja_en)}`}
        {fila.dada_de_baja_por && ` · por ${fila.dada_de_baja_por}`}
      </span>
      {fila.baja_detalle && <span className="text-slate-500">({fila.baja_detalle})</span>}
    </span>
  );
};

export default SelectorVisibilidad;
