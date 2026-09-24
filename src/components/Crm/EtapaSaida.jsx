import React from 'react';

// D-C33: la etapa SAIDA se DERIVA en el backend (crm_saida.derivar_de) del
// estado y de los actos registrados. Acá es un dato de SÓLO LECTURA: no hay
// selector, ni en el alta ni en la ficha, porque lo que el asesor elija el
// backend lo ignora. Mostrarla editable sería prometer algo que no se guarda.
//
// El valor se relee siempre del servidor después de cada acción (acto,
// cotización entregada, transición, cierre): no se calcula acá, porque una
// segunda copia de la tabla de derivación es cómo el front y el back terminan
// mostrando etapas distintas para la misma oportunidad.
export const TOOLTIP_ETAPA_SAIDA = 'Se calcula sola según el estado y los actos registrados';

export const EtapaSaidaDato = ({ valor }) => (
  <div data-testid="etapa-saida-dato">
    <p className="text-slate-500 text-xs uppercase tracking-wide flex items-center gap-1">
      Etapa SAIDA
      <span
        title={TOOLTIP_ETAPA_SAIDA}
        aria-label={TOOLTIP_ETAPA_SAIDA}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-500 text-[9px] leading-none normal-case cursor-help"
      >
        i
      </span>
    </p>
    <p className="mt-0.5" title={TOOLTIP_ETAPA_SAIDA}>{valor || '-'}</p>
  </div>
);

export const EtapaSaidaChip = ({ valor }) => {
  if (!valor) return null;
  return (
    <span
      title={`Etapa SAIDA: ${valor}. ${TOOLTIP_ETAPA_SAIDA}`}
      className="px-2 py-0.5 bg-slate-700/60 text-slate-400 rounded text-xs"
    >
      {valor}
    </span>
  );
};
