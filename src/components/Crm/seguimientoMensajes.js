// El mensaje sugerido de cada toque de la cadencia, y el link de WhatsApp.
//
// LOS TRES TOQUES NO SON EL MISMO MENSAJE TRES VECES. Es la diferencia entre
// una cadencia y tres insistencias:
//
//   toque 1 (+24 h) - la pregunta directa: ¿llegó, se entendió, hay dudas?
//   toque 2 (+72 h) - un dato de VALOR. Es el único que se manda editable a
//                     propósito: el dato depende del caso concreto (que la
//                     compañía cubre granizo, que el premio se congela hasta
//                     fin de mes, que hay cuotas sin interés) y un texto fijo
//                     acá sería un "¿pudiste verla?" disfrazado, que es
//                     exactamente lo que hace que dejen de contestar.
//   toque 3 (+7 d)  - cierre ABIERTO. No pide una decisión, ofrece la salida
//                     digna: "¿la dejamos para más adelante?". Un "no" claro
//                     es un LOOP con fecha; un silencio no es nada.
//
// El texto se arma con lo que ya trae `GET /crm/seguimientos/hoy` (nombre,
// vehículo, compañía, premio): no hay una segunda vuelta al backend para
// escribir un mensaje.
import { formatMoneda } from './oportunidadConstants';

export const TOQUE_TITULO = {
  1: 'Toque 1 · ¿Pudiste verla?',
  2: 'Toque 2 · Dato de valor',
  3: 'Toque 3 · Cierre abierto',
};

// El toque 2 se abre editable; los otros dos también se pueden editar, pero el
// 2 es el que NO tiene un texto por defecto que sirva tal cual.
export const TOQUE_PIDE_EDICION = { 1: false, 2: true, 3: false };

const saludo = (nombre) => (nombre ? `Hola ${String(nombre).trim().split(/\s+/)[0]}` : 'Hola');

const referencia = (seguimiento) => {
  const partes = [];
  if (seguimiento?.vehiculo) partes.push(seguimiento.vehiculo);
  if (seguimiento?.compania) partes.push(seguimiento.compania);
  return partes.length ? ` de tu ${partes.join(' en ')}` : '';
};

/**
 * El mensaje sugerido del toque. Fuera del rango 1..3 cae en el toque 1: una
 * cadencia sin mensaje sería una fila con un botón que no hace nada.
 */
export const mensajeSugerido = (seguimiento) => {
  const nombre = saludo(seguimiento?.nombre);
  const cot = referencia(seguimiento);
  const premio = seguimiento?.premio ? ` (${formatMoneda(seguimiento.premio)})` : '';

  switch (Number(seguimiento?.numero_de_toque)) {
    case 2:
      return (
        `${nombre}, te sumo un dato sobre la cotización${cot}${premio}: ` +
        '[escribí acá el dato de valor: qué cubre, hasta cuándo se mantiene el premio, ' +
        'formas de pago]. Cualquier cosa me escribís. Sebastián - AYMA Advisors.'
      );
    case 3:
      return (
        `${nombre}, ¿cómo venís con la cotización${cot}? ` +
        'Si ahora no es el momento, ¿la dejamos para más adelante y te escribo en unos meses? ' +
        'Sin problema. Sebastián - AYMA Advisors.'
      );
    default:
      return (
        `${nombre}, ¿pudiste ver la cotización${cot}${premio} que te mandé? ` +
        '¿Alguna duda? Sebastián - AYMA Advisors.'
      );
  }
};

/**
 * El teléfono como lo quiere wa.me: sólo dígitos, con el 54 de Argentina.
 *
 * `https://wa.me/54${telefono}` pelado es el bug que ya se arregló en la tabla
 * de leads (ver AdminDashboard.test.jsx): con un teléfono guardado como
 * "+54 9 341 695-2259" produce una URL con espacios y un 54 duplicado, y wa.me
 * abre una pestaña con un error. Devuelve null cuando no hay con qué armar el
 * link: la fila muestra el botón deshabilitado en vez de un link roto.
 */
export const telefonoWhatsapp = (telefono) => {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (digitos.length < 8) return null;
  if (digitos.startsWith('54')) return digitos;
  // Un local con 0 adelante ("0341...") o un celular con 15: el 54 va delante
  // del número sin esos prefijos de discado nacional.
  return `54${digitos.replace(/^0/, '')}`;
};

export const linkWhatsapp = (telefono, mensaje) => {
  const numero = telefonoWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje || '')}`;
};
