import React from 'react';
import { TOOLTIP_TECHO_NO_SUMADO, numeroAr, pesosAr } from './artCarteraConstants';

// Renglón "Techo no sumado (masa BAJA)" - D-OP10-1 (backend #219).
// `techo` = {cantidad, suma_comision_actual, suma_comision_oferta}, tal cual
// lo manda el backend: los montos son Decimal serializado (string) y no se
// suman acá. Sin cantidad ni sin_comision no se muestra nada.
// `suma_comision_oferta` null = ese bloque no calcula oferta
// (resumen-direccion): se omite el tramo, no se muestra "$ 0".
// `sin_comision` (backend #220) = filas BAJA sin comisión actual (falta
// alícuota o masa): no están en `cantidad`; con > 0 se agrega el tramo.
//
// Con cantidad 0 y sin_comision > 0 (OPERACIONES-0010 paso 3) el renglón se
// muestra igual: "0 empresas · N sin dato". Los montos se omiten (con 0
// empresas no hay techo que acotar).
const TechoNoSumado = ({ techo, formatear = pesosAr, className = 'text-xs' }) => {
  const cantidadCruda = Number(techo?.cantidad);
  const cantidad = Number.isFinite(cantidadCruda) && cantidadCruda > 0 ? cantidadCruda : 0;
  const sinComision = Number(techo?.sin_comision);
  const haySinComision = Number.isFinite(sinComision) && sinComision > 0;
  if (cantidad <= 0 && !haySinComision) return null;
  const actual = cantidad > 0 ? formatear(techo.suma_comision_actual) : null;
  const oferta = cantidad <= 0 || techo.suma_comision_oferta === null || techo.suma_comision_oferta === undefined
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
      {haySinComision
        ? ` · ${numeroAr(sinComision)} sin dato (falta alícuota o masa)`
        : ''}
    </p>
  );
};

export default TechoNoSumado;
