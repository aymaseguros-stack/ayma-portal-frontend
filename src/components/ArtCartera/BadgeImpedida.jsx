import React from 'react';
import { textoComoRevertir } from './artCotizacionesConstants';

// Badge rojo "Impedida · <motivo>" (OPERACIONES-0012 · ART-115). El objeto
// `impedimento` es el de `impedimento_comercial` del backend, tal cual.
const badgeBase = 'inline-block text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap';

// Badge rojo de una fila con trabajo abierto sobre una empresa impedida.
// Sin impedimento no renderiza nada: la fila se ve igual que antes.
const BadgeImpedida = ({ impedimento, className = '' }) => {
  if (!impedimento) return null;
  return (
    <span
      className={`${badgeBase} bg-red-600/30 text-red-200 border border-red-500/50 ${className}`}
      title={textoComoRevertir(impedimento)}
      data-testid="badge-impedida"
    >
      Impedida · {impedimento.motivo}
    </span>
  );
};


export default BadgeImpedida;
