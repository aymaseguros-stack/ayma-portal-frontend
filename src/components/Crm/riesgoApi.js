// C-17 / D-C25 / D-C23: la ficha de riesgo, el envío a cotizar y NO COLOCABLE.
// Backend: app/api/v1/crm_riesgo.py (PR #195, SHA 3a7888e).
//
// EL CATÁLOGO NO SE COPIA ACÁ, y es la regla del paquete. `GET /riesgo`
// devuelve `campos` -clave, título, tipo, opciones, requerido, editable- y con
// eso el formulario se dibuja entero. Una segunda copia del catálogo en el
// front es cómo un campo termina aceptado por el backend y ausente de la
// pantalla (o al revés), que es el bug de C-12A-b con otro disfraz. Lo único
// que vive de este lado son las ETIQUETAS de los motivos de NO COLOCABLE, y
// aun eso se coteja contra `GET /crm/catalogos/no-colocable`.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const base = (id) => `${API_URL}/api/v1/crm/oportunidades/${encodeURIComponent(id)}`;

const leer = async (res) => {
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// El 422 de "ficha incompleta" trae los faltantes EN EL DETALLE, y es lo que
// hay que mostrar: "no se puede" no dice qué hacer. Se conserva el status para
// que la pantalla pueda distinguirlo de un 409 (dada de baja / no colocable).
export class ErrorDeCotizacion extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.name = 'ErrorDeCotizacion';
    this.status = status;
  }
}

/** GET /crm/oportunidades/{id}/riesgo */
export const obtenerRiesgo = (token, oportunidadId) =>
  fetch(`${base(oportunidadId)}/riesgo`, { headers: authHeader(token) }).then(leer);

/**
 * PUT /crm/oportunidades/{id}/riesgo — MERGE.
 *
 * Lo que no se manda queda como estaba y un `null` explícito borra. Por eso
 * el formulario manda SÓLO lo que tocó: mandar el objeto entero con los
 * vacíos en '' convertiría cada guardado en un borrado silencioso de lo que
 * otra persona cargó desde otra pantalla.
 */
export const guardarRiesgo = (token, oportunidadId, valores) =>
  fetch(`${base(oportunidadId)}/riesgo`, {
    method: 'PUT',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ valores }),
  }).then(leer);

/** POST /crm/oportunidades/{id}/enviar-a-cotizar */
export const enviarACotizar = async (token, oportunidadId, { nota } = {}) => {
  const res = await fetch(`${base(oportunidadId)}/enviar-a-cotizar`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ nota: nota || null }),
  });
  if (!res.ok) throw new ErrorDeCotizacion(await formatApiError(res), res.status);
  return res.json();
};

/** GET /crm/oportunidades/para-cotizar — la cola de D-C25. */
export const colaParaCotizar = (token, { track, diasMin, limit } = {}) => {
  const url = new URL(`${API_URL}/api/v1/crm/oportunidades/para-cotizar`);
  if (track) url.searchParams.set('track', track);
  if (diasMin !== undefined && diasMin !== null && diasMin !== '') {
    url.searchParams.set('dias_min', String(diasMin));
  }
  if (limit) url.searchParams.set('limit', String(limit));
  return fetch(url.toString(), { headers: authHeader(token) }).then(leer);
};

/** GET /crm/catalogos/no-colocable */
export const catalogoNoColocable = (token) =>
  fetch(`${API_URL}/api/v1/crm/catalogos/no-colocable`, { headers: authHeader(token) }).then(leer);

/** POST /crm/oportunidades/{id}/no-colocable */
export const declararNoColocable = (token, oportunidadId, { motivo, compania, detalle }) =>
  fetch(`${base(oportunidadId)}/no-colocable`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      motivo,
      compania_consultada: compania || null,
      detalle: detalle && detalle.trim() ? detalle.trim() : null,
    }),
  }).then(leer);

/** POST /crm/oportunidades/{id}/reabrir */
export const reabrirNoColocable = (token, oportunidadId, { motivo } = {}) =>
  fetch(`${base(oportunidadId)}/reabrir`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ motivo: motivo && motivo.trim() ? motivo.trim() : null }),
  }).then(leer);

// ---------------------------------------------------------------------------
// Etiquetas
// ---------------------------------------------------------------------------

// El motivo OTRO exige detalle del lado del backend (422). El formulario lo
// pide antes: un 422 evitable es una pantalla que hace perder lo ya escrito.
export const MOTIVO_NO_COLOCABLE_OTRO = 'OTRO';

export const MOTIVO_NO_COLOCABLE_LABEL = {
  SIN_MERCADO: 'Sin mercado (ninguna compañía lo toma)',
  RIESGO_RECHAZADO: 'Riesgo rechazado',
  ZONA_NO_OPERADA: 'Zona no operada',
  ANTIGUEDAD_VEHICULO: 'Antigüedad del vehículo',
  SINIESTRALIDAD: 'Siniestralidad',
  PRECIO_INVIABLE: 'Precio inviable',
  OTRO: 'Otro',
};

// El prefijo de 8 que el backend calcula (LARGO_ID_CORTO). Se usa sólo como
// fallback para una fila vieja que no lo traiga: el valor bueno es el que
// manda el backend, y calcularlo acá como fuente sería la segunda copia.
export const idCorto = (oportunidad) =>
  oportunidad?.id_corto || (oportunidad?.id ? String(oportunidad.id).slice(0, 8) : null);
