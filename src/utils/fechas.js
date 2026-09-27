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

// C-9g: UN INSTANTE SIN ZONA ES UTC. El backend guarda los timestamps en
// columnas `DateTime` sin zona con hora UTC (`datetime.utcnow`, y
// `crm_proxima_accion` convierte la hora argentina a UTC antes de guardar) y
// Pydantic los serializa sin "Z": "2026-10-04T13:00:00". `new Date()` toma
// un ISO con hora y sin zona como hora LOCAL (ECMA-262), así que en
// Argentina todo instante se mostraba 3 horas corrido: la tarea de las
// 10:00 aparecía a las 13:00. Se le agrega la Z sólo si no trae zona; un
// valor con "Z" u offset pasa tal cual.
const INSTANTE_SIN_ZONA = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)$/;

// La hora de la app es la argentina, siempre, y no la del reloj de la
// máquina: es la misma hora con la que el backend arma "hoy".
export const ZONA_AR = 'America/Argentina/Buenos_Aires';

// El Date que corresponde a `valor`, o null si no es una fecha válida.
// Exportada porque hay lecturas que necesitan el Date y no el texto (ver
// `anioDeFecha`, `diasDesde`), y todas tienen que entrar por el mismo parseo.
export const aFecha = (valor) => {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  const texto = typeof valor === 'string' ? valor.trim() : null;
  const partes = texto ? texto.match(SOLO_FECHA) : null;
  const sinZona = texto && !partes ? texto.match(INSTANTE_SIN_ZONA) : null;
  let fecha;
  if (partes) fecha = new Date(Number(partes[1]), Number(partes[2]) - 1, Number(partes[3]));
  else if (sinZona) fecha = new Date(`${sinZona[1]}T${sinZona[2]}Z`);
  else fecha = new Date(valor);
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

// dd/mm/aaaa HH:mm para los campos que SÍ son un instante (created_at,
// fecha_programada, ultima_sync, la fecha de un mail). Mismo contrato de
// vacío/crudo que `fechaCorta`, para que ninguna pantalla tenga que
// hand-rollear el `? ... : '-'` alrededor de un `new Date` pelado.
//
// C-9g: SIEMPRE en hora argentina y en 24 h. Sin `hourCycle`, el ICU de
// Chrome formatea es-AR en 12 h: "13:00 p. m." en la agenda y "01:00:00" (sin
// meridiano) en la ficha. El formato por default se arma a mano con
// `formatToParts` para no depender de los separadores de cada runtime.
// `opciones` (otro formato para una pantalla puntual) no puede cambiar ni la
// zona ni el reloj de 24 h.
const PARTES_AR = new Intl.DateTimeFormat('es-AR', {
  timeZone: ZONA_AR, hourCycle: 'h23',
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const formatoCanonico = (fecha) => {
  const p = Object.fromEntries(PARTES_AR.formatToParts(fecha).map(({ type, value }) => [type, value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
};

export const fechaHora = (valor, opciones) => {
  if (!valor) return null;
  const fecha = aFecha(valor);
  if (fecha === null) return valor;
  if (!opciones) return formatoCanonico(fecha);
  // eslint-disable-next-line no-unused-vars
  const { hour12, hourCycle, timeZone, ...resto } = opciones;
  return fecha.toLocaleString('es-AR', { ...resto, timeZone: ZONA_AR, hourCycle: 'h23' });
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
