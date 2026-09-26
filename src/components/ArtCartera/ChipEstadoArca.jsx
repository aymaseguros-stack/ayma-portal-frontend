import React from 'react';
import { fechaCorta } from '../../utils/fechas';
import { ESTADO_ARCA_INFO, fuenteEstadoArcaLabel, tooltipEstadoArca } from './estadoArcaConstants';

// Chip de estado. ACTIVO (o sin estado) no dibuja nada.
export const ChipEstadoArca = ({ estado, fuente, fecha, nota, conDetalle = false, className = '' }) => {
  if (!estado || estado === 'ACTIVO') return null;
  const info = ESTADO_ARCA_INFO[estado] || { label: estado, clase: 'bg-slate-500/20 text-slate-400' };
  const detalle = [fuente && fuenteEstadoArcaLabel(fuente), fecha && fechaCorta(fecha)].filter(Boolean).join(' · ');
  return (
    <span
      data-testid="chip-estado-arca"
      data-estado={estado}
      className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium ${info.clase} ${className}`}
      title={tooltipEstadoArca({ fuente, fecha, nota }) || undefined}
    >
      {info.label}
      {conDetalle && detalle ? ` · ${detalle}` : ''}
    </span>
  );
};

export default ChipEstadoArca;
