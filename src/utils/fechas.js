// Fechas de TODA la app: un único parseo para todos los renders.
//
// EL BUG QUE CIERRA. El backend manda los campos `date` (art_vigencia_desde,
// fecha_vencimiento, fecha_evento, fecha_caducidad, valida_hasta,
// fecha_recontacto, fecha_cierre_estimada...) como 'YYYY-MM-DD' pelado. Ese
// formato, pasado a `new Date()`, se interpreta como MEDIANOCHE UTC - no
// como fecha local (ECMA-262, date-only forms). En Argentina (UTC-3),
// `new Date('2026-09-10').toLocaleDateString('es-AR')` devuelve
// **09/09/2026**: un día MENOS que el que mandó el backend.
//
// No es cosmético. "Vigencia desde el 1/10" mostrado como 30/9 es un
// contrato que arranca un día antes del que figura en la póliza; "caduca el
// 30/09" mostrado como 29/09 es una empresa que se llama un día tarde; una
// propuesta que dice vencer el día anterior al que el backend considera
// vigente contradice al `dias_restantes` que viene al lado, calculado en el
// servidor. Cada archivo tenía su propia copia de `fechaCorta` con el mismo
// `new Date(valor)`, así que el error estaba en todos.
//
// LA REGLA: una fecha SIN hora es un día del calendario, no un instante;
// se arma con el constructor de componentes locales y nunca cruza zonas
// horarias. Una fecha CON hora sí es un instante y se deja pasar tal cual
// a `new Date`, que es lo correcto para un timestamp.
//
// Vive en utils/ y no en components/ArtCartera/ porque el problema no era
// de ART: lo tenían por igual las pólizas, la agenda, los recuperables y el
// panel admin.

// 'YYYY-MM-DD' exacto. Un ISO con hora ('2026-09-10T12:00:00') NO matchea
// a propósito: ese sí es un instante.
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

// El Date que corresponde a `valor`, o null si no es una fecha válida.
// Exportada porque hay lecturas que necesitan el Date y no el texto (ver
// `anioDeFecha`, `diasDesde`), y todas tienen que entrar por el mismo parseo.
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
//
// `opciones` es el segundo argumento de `toLocaleDateString`, para las
// pantallas que muestran la fecha en otro formato (el día de la semana en la
// agenda, día/mes en los ejes de los gráficos). El parseo es el mismo: el
// formato cambia, el día no.
export const fechaCorta = (valor, opciones) => {
  if (!valor) return null;
  const fecha = aFecha(valor);
  return fecha === null ? valor : fecha.toLocaleDateString('es-AR', opciones);
};

// dd/mm/aaaa hh:mm:ss para los campos que SÍ son un instante (created_at,
// fecha_programada, ultima_sync, la fecha de un mail). Mismo contrato de
// vacío/crudo que `fechaCorta`, para que ninguna pantalla tenga que
// hand-rollear el `? ... : '-'` alrededor de un `new Date` pelado.
export const fechaHora = (valor, opciones) => {
  if (!valor) return null;
  const fecha = aFecha(valor);
  return fecha === null ? valor : fecha.toLocaleString('es-AR', opciones);
};

// El año calendario de una fecha. Mismo parseo, así que un '2020-01-01'
// es 2020 y no 2019 - que es lo que devolvía `new Date(...).getFullYear()`
// al oeste de Greenwich.
export const anioDeFecha = (valor) => {
  const fecha = aFecha(valor);
  return fecha === null ? null : fecha.getFullYear();
};

// El día de HOY como 'YYYY-MM-DD' local, para comparar contra los campos
// `date` del backend (que son días del calendario, no instantes).
//
// Reemplaza a `new Date().toISOString().slice(0, 10)`, que devuelve el día
// en UTC: en Argentina (UTC-3), de 21:00 a medianoche eso ya es MAÑANA. Con
// esa versión, una tarea para hoy se marcaba vencida a las 21:00 y el
// encabezado "Hoy" de la agenda saltaba al día siguiente antes de tiempo.
export const hoyISO = (fecha = new Date()) => {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
};

// `hoyISO` corrido N días (negativo hacia atrás). El corrimiento se hace en
// componentes locales y no sumando 86400000 ms, que se pasa de largo o se
// queda corto en los días de cambio de horario.
export const diaISO = (offsetDias, desde = new Date()) => {
  const fecha = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + offsetDias);
  return hoyISO(fecha);
};
