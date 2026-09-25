import React from 'react';
import { TOOLTIP_TECHO_NO_SUMADO, numeroAr, pesosAr } from './artCarteraConstants';

// Renglón "Techo no sumado (masa BAJA)" - D-OP10-1 (backend #219).
// `techo` = {cantidad, suma_comision_actual, suma_comision_oferta}, tal cual
// lo manda el backend: los montos son Decimal serializado (string) y no se
// suman acá. Con cantidad 0 (o sin el campo) no se muestra nada.
// `suma_comision_oferta` null = ese bloque no calcula oferta
// (resumen-direccion): se omite el tramo, no se muestra "$ 0".
const TechoNoSumado = ({ techo, formatear = pesosAr, className = 'text-xs' }) => {
  const cantidad = Number(techo?.cantidad);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const actual = formatear(techo.suma_comision_actual);
  const oferta = techo.suma_comision_oferta === null || techo.suma_comision_oferta === undefined
    ? null
    : formatear(techo.suma_comision_oferta);
  return (
    <p
      className={`text-slate-500 ${className}`}
      title={TOOLTIP_TECHO_NO_SUMADO}
      data-testid="techo-no-sumado"
    >
      Techo no sumado (masa BAJA): {numeroAr(cantidad)} {cantidad === 1 ? 'empresa' : 'empresas'}
      {actual ? ` · ≤ ${actual} comisión actual` : ''}
      {oferta ? ` · ≤ ${oferta} oferta` : ''}
    </p>
  );
};

export default TechoNoSumado;
