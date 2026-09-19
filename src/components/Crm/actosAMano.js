// Actos de la máquina escritos a mano como interacción.
//
// El pipeline se mueve por ACTOS (POST /crm/oportunidades/{id}/acto y su
// atajo /cotizacion-entregada): el acto suma su puntaje y deriva el estado.
// Una interacción NO es un acto: suma +2 y deja el estado donde está.
//
// En producción (AYMA-OPP-20260915-4FF380A64DDC, Cristian Peralta) el usuario
// venía registrando la entrega de la cotización como una interacción con el
// asunto escrito a mano "ENTREGA COTIZACION". La oportunidad sumaba +2 y se
// quedaba en PROSPECTO: ni el estado se movió, ni nació la cadencia de
// seguimientos, ni quedó la compañía ni el premio.
//
// Acá NO se convierte nada: detectar no es decidir. Una interacción con ese
// asunto puede ser perfectamente una nota legítima ("me preguntó por la
// cotización"), y reescribirla sola emitiría un acto que el usuario no pidió,
// con su puntaje y su cadencia. Se avisa y decide la persona.

// Frases que delatan un acto escrito a mano. Se comparan contra el asunto
// NORMALIZADO (sin acentos, sin signos, mayúsculas, espacios colapsados), que
// es lo que hace que "Entregué cotización" y "ENTREGA COTIZACION" sean lo
// mismo.
export const ASUNTOS_DE_ACTO = [
  { frase: 'ENTREGA COTIZACION', acto: 'COTIZACION' },
  { frase: 'ENTREGUE COTIZACION', acto: 'COTIZACION' },
  { frase: 'COTIZACION ENTREGADA', acto: 'COTIZACION' },
  { frase: 'COTIZACION', acto: 'COTIZACION' },
  { frase: 'COTIZE', acto: 'COTIZACION' },
  { frase: 'EMISION', acto: 'EMISION' },
  { frase: 'EMITIDA', acto: 'EMISION' },
  { frase: 'EMITI', acto: 'EMISION' },
];

// Sin `normalize('NFD')` un asunto con tilde ("Cotización") no coincide con
// ninguna frase y el aviso no aparece justo en el caso más común.
export const normalizarAsunto = (texto) => (texto || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

// El acto que un asunto insinúa, o null. Es `includes` y no igualdad: nadie
// escribe exactamente "ENTREGA COTIZACION", escribe "Entrega cotizacion Sancor".
export const actoInsinuadoPor = (asunto) => {
  const normalizado = normalizarAsunto(asunto);
  if (!normalizado) return null;
  const encontrada = ASUNTOS_DE_ACTO.find((a) => normalizado.includes(a.frase));
  return encontrada ? encontrada.acto : null;
};

// Las interacciones de la ficha que parecen un acto escrito a mano.
export const interaccionesQueParecenActo = (interacciones) => (interacciones || [])
  .map((i) => ({ interaccion: i, acto: actoInsinuadoPor(i?.asunto) }))
  .filter((x) => x.acto !== null);
