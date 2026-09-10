// Fechas del módulo ART: un único parseo para TODOS los renders.
//
// EL BUG QUE CIERRA. El backend manda los campos `date` (fecha_evento,
// fecha_caducidad, valida_hasta, fecha_emision, fecha_entrega,
// fecha_inicio/fecha_fin de contratos...) como 'YYYY-MM-DD' pelado. Ese
// formato, pasado a `new Date()`, se interpreta como MEDIANOCHE UTC - no
// como fecha local (ECMA-262, date-only forms). En Argentina (UTC-3),
// `new Date('2026-09-10').toLocaleDateString('es-AR')` devuelve
// **09/09/2026**: un día MENOS que el que mandó el backend.
//
// En esta pantalla eso no es cosmético. "Caduca el 30/09" mostrado como
// 29/09 es una empresa que se llama un día antes o un día tarde; una
// propuesta que dice vencer el día anterior al que el backend considera
// vigente contradice al `dias_restantes` que viene al lado, calculado en
// el servidor. Cada archivo tenía su propia copia de `fechaCorta` con el
// mismo `new Date(valor)`, así que el error estaba en los ocho.
//
// LA REGLA: una fecha SIN hora es un día del calendario, no un instante;
// se arma con el constructor de componentes locales y nunca cruza zonas
// horarias. Una fecha CON hora sí es un instante y se deja pasar tal cual
// a `new Date`, que es lo correcto para un timestamp.

// 'YYYY-MM-DD' exacto. Un ISO con hora ('2026-09-10T12:00:00') NO matchea
// a propósito: ese sí es un instante.
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// El Date que corresponde a `valor`, o null si no es una fecha válida.
// Exportada porque hay lecturas que necesitan el Date y no el texto (ver
// `anioDeFecha`), y todas tienen que entrar por el mismo parseo.
export const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const partes = typeof valor === 'string' ? valor.match(SOLO_FECHA) : null;
  const fecha = partes
    ? new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]))
    : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// dd/mm/aaaa. Devuelve null cuando no hay dato (cada pantalla decide su
// propio guion de vacío) y el valor CRUDO cuando llegó algo que no se
// puede parsear: perder el texto original escondería un problema de datos
// del backend detrás de un "—".
export const fechaCorta = (valor) => {
  if (!valor) return null;
  const fecha = aFecha(valor);
  return fecha === null ? valor : fecha.toLocaleDateString('es-AR');
};

// El año calendario de una fecha. Mismo parseo, así que un '2020-01-01'
// es 2020 y no 2019 - que es lo que devolvía `new Date(...).getFullYear()`
// al oeste de Greenwich.
export const anioDeFecha = (valor) => {
  const fecha = aFecha(valor);
  return fecha === null ? null : fecha.getFullYear();
};
