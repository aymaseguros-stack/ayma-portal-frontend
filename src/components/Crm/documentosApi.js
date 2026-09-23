// El EXPEDIENTE (`documentos`), que NO es `crm_adjuntos`.
//
// SON DOS MÓDULOS DISTINTOS Y ESTO IMPORTA. Un `crm_adjunto` cuelga de una
// interacción y vive en el timeline del CRM (es lo que muestra la pestaña
// Documentos hasta esta línea). Un `documento` es el expediente sobre Drive,
// con clasificación, retención legal y auditoría de accesos - y es el ÚNICO de
// los dos que tiene el reemplazo de D-C26. Por eso la sección del expediente
// se dibuja aparte y no mezclada con los adjuntos: un "marcar como
// reemplazado" que apareciera sobre un adjunto del CRM sería un botón que
// contesta 404.
//
// Backend: app/api/v1/documentos.py (PR #195).
import { authHeader, formatApiError, normalizeList } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const leer = async (res) => {
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Espejo de `app/models/documento.py::TIPOS_DOCUMENTO` (16 desde D-C26). Es
// una copia declarada: el POST valida contra la lista del backend y un tipo
// que no esté ahí es 422 con los valores permitidos en el detalle.
export const TIPOS_DOCUMENTO = [
  'POLIZA', 'CERTIFICADO_PROVISORIO', 'F931', 'POLIZA_VIGENTE_TERCERO',
  'FOTO_INSPECCION', 'FOTO_SINIESTRO', 'DNI', 'CUIT', 'FORMULARIO_08',
  'CEDULA_VERDE', 'VTV', 'FACTURA', 'CONTRATO', 'ADJUNTO_EMAIL',
  'PRESUPUESTO', 'OTRO',
];

export const TIPO_DOCUMENTO_LABEL = {
  POLIZA: 'Póliza definitiva',
  CERTIFICADO_PROVISORIO: 'Certificado provisorio',
  F931: 'F.931',
  POLIZA_VIGENTE_TERCERO: 'Póliza vigente del tercero',
  FOTO_INSPECCION: 'Foto de inspección',
  FOTO_SINIESTRO: 'Foto de siniestro',
  DNI: 'DNI',
  CUIT: 'CUIT',
  FORMULARIO_08: 'Formulario 08',
  CEDULA_VERDE: 'Cédula verde',
  VTV: 'VTV',
  FACTURA: 'Factura',
  CONTRATO: 'Contrato',
  ADJUNTO_EMAIL: 'Adjunto de email',
  PRESUPUESTO: 'Presupuesto',
  OTRO: 'Otro',
};

/** GET /documentos?oportunidad_id= */
export const listarDocumentos = (token, { oportunidad_id, persona_id, empresa_id } = {}) => {
  const url = new URL(`${API_URL}/api/v1/documentos`);
  if (oportunidad_id) url.searchParams.set('oportunidad_id', oportunidad_id);
  if (persona_id) url.searchParams.set('persona_id', persona_id);
  if (empresa_id) url.searchParams.set('empresa_id', empresa_id);
  // `GET /documentos` devuelve un ARRAY plano, no el envelope paginado que usa
  // medio backend. Se normaliza igual: una respuesta que no sea una lista
  // (un 200 con otra forma, un mock) tiene que dejar la pantalla vacía, no
  // reventarla con un `.map is not a function`.
  return fetch(url.toString(), { headers: authHeader(token) })
    .then(leer)
    .then((data) => normalizeList(data).items);
};

/**
 * POST /documentos — multipart.
 *
 * La respuesta trae `reemplazables` (D-C26): los documentos que ÉSTE podría
 * dejar históricos. Viaja en la subida y no en un endpoint aparte porque el
 * único momento en que una persona puede decidirlo es justo cuando acaba de
 * subir la definitiva y tiene las dos delante.
 *
 * NO se setea Content-Type: el navegador tiene que poner el boundary.
 */
export const subirDocumento = (token, { archivo, tipo, descripcion, fecha_documento }, vinculo = {}) => {
  const body = new FormData();
  body.append('archivo', archivo);
  body.append('tipo', tipo);
  if (descripcion) body.append('descripcion', descripcion);
  if (fecha_documento) body.append('fecha_documento', fecha_documento);
  for (const [clave, valor] of Object.entries(vinculo)) {
    if (valor) body.append(clave, valor);
  }
  return fetch(`${API_URL}/api/v1/documentos`, {
    method: 'POST', headers: authHeader(token), body,
  }).then(leer);
};

/**
 * PATCH /documentos/{id}/reemplazado-por — D-C26.
 *
 * NADA SE BORRA: el binario queda, la retención legal sigue corriendo y
 * `activo` no se toca. Lo único que cambia es que el viejo deja de contar como
 * vigente. Es lo que permite probar que el cliente estuvo cubierto entre el
 * día 1 y el día 30 con el provisorio, que es justo lo que se pierde cuando la
 * salida que encuentra la gente es borrar el viejo.
 */
export const marcarReemplazado = (token, documentoId, reemplazadoPorId) =>
  fetch(`${API_URL}/api/v1/documentos/${encodeURIComponent(documentoId)}/reemplazado-por`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ reemplazado_por_id: reemplazadoPorId }),
  }).then(leer);
