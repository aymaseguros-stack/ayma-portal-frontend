// Cliente HTTP de QR-EMI, lado del PORTAL
// (backend: app/api/v1/crm_solicitudes_emision.py, PR #190 / 11755e3).
//
// SEIS ENDPOINTS Y UNO NO ES COMO LOS OTROS CINCO. Generar, revocar,
// listar, aprobar y observar cuelgan de `require_admin_o_agente` y no
// muestran un solo dato del formulario. `verSolicitud` -el detalle- cuelga
// de `require_admin`, devuelve el DNI, el CBU y el domicilio DESCIFRADOS, y
// el backend deja cada acceso en `auditoria_accesos`. Por eso vive en una
// función aparte con su propio nombre y por eso NINGUNA pantalla la llama
// al montar: la dispara un clic explícito.
//
// EL TOKEN EN CLARO SALE UNA SOLA VEZ, en la respuesta de `generarSolicitud`
// (y de `observarSolicitud` con `regenerar_link`). La base guarda su
// SHA-256 y ningún otro endpoint lo devuelve: si se pierde, hay que generar
// uno nuevo -y eso revoca el anterior, que es el punto-.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = `${API_URL}/api/v1/crm`;

const headersJson = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

const leer = async (res) => {
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Espejo de app/models/crm/solicitud_emision.py::ESTADOS_SOLICITUD, en el
// orden en que se miran: lo que espera revisión primero, lo muerto al final.
export const ESTADOS_SOLICITUD = [
  'PENDIENTE_REVISION',
  'OBSERVADA',
  'GENERADA',
  'ABIERTA',
  'APROBADA',
  'VENCIDA',
  'REVOCADA',
];

export const ESTADO_LABEL = {
  GENERADA: 'Generada',
  ABIERTA: 'Abierta por el cliente',
  PENDIENTE_REVISION: 'Pendiente de revisión',
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  VENCIDA: 'Vencida',
  REVOCADA: 'Revocada',
};

export const ESTADO_BADGE = {
  GENERADA: 'bg-slate-600/40 text-slate-200 border-slate-500/50',
  ABIERTA: 'bg-blue-500/15 text-blue-200 border-blue-500/40',
  PENDIENTE_REVISION: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  APROBADA: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  OBSERVADA: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
  VENCIDA: 'bg-slate-700/60 text-slate-400 border-slate-600',
  REVOCADA: 'bg-red-500/15 text-red-200 border-red-500/40',
};

// Desde dónde se aprueba u observa (ESTADOS_REVISABLES del backend). Un
// botón ofrecido fuera de estos dos estados es un 409 asegurado.
export const ESTADOS_REVISABLES = ['PENDIENTE_REVISION', 'OBSERVADA'];

// Los estados en los que el link todavía puede usarse. Con la solicitud en
// uno de éstos, generar otra INVALIDA la anterior y hay que avisarlo antes.
export const ESTADOS_LINK_VIVO = ['GENERADA', 'ABIERTA'];

// Track de la oportunidad habilitado para pedir datos de emisión
// (emision_formulario.TRACKS_HABILITADOS). MOTO todavía no existe en
// TRACKS_VALIDOS del backend: está declarado para el día que se cree.
export const TRACKS_HABILITADOS = ['AUTO', 'MOTO'];
export const ESTADOS_CRM_HABILITADOS = ['POTENCIAL', 'CLIENTE'];

export const puedePedirDatos = (oportunidad) => {
  const track = String(oportunidad?.track || '').trim().toUpperCase();
  const estado = String(oportunidad?.estado_crm || '').trim().toUpperCase();
  return TRACKS_HABILITADOS.includes(track) && ESTADOS_CRM_HABILITADOS.includes(estado);
};

// El PNG viene en base64 en la respuesta del POST, no por un endpoint
// aparte: por eso acá alcanza con el data: URI y no hace falta el blob
// autenticado que sí necesita el QR de los puntos de contacto.
export const qrDataUri = (base64) => (base64 ? `data:image/png;base64,${base64}` : null);

export const generarSolicitud = async (token, oportunidadId, cuerpo = {}) => {
  const res = await fetch(`${BASE}/oportunidades/${oportunidadId}/solicitud-emision`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify(cuerpo),
  });
  return leer(res);
};

export const listarSolicitudes = async (token, { estado, oportunidad_id, limit, offset } = {}) => {
  const qs = new URLSearchParams();
  if (estado) qs.set('estado', estado);
  if (oportunidad_id) qs.set('oportunidad_id', oportunidad_id);
  if (limit) qs.set('limit', String(limit));
  if (offset) qs.set('offset', String(offset));
  const sufijo = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${BASE}/solicitudes-emision${sufijo}`, { headers: authHeader(token) });
  const data = await leer(res);
  return Array.isArray(data) ? data : (data?.items || []);
};

// ADMIN. Devuelve los datos DESCIFRADOS y el backend audita el acceso.
// No se llama nunca al montar una pantalla.
export const verSolicitud = async (token, solicitudId) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}`, {
    headers: authHeader(token),
  });
  return leer(res);
};

export const revocarSolicitud = async (token, solicitudId, motivo) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/revocar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ motivo: motivo || null }),
  });
  return leer(res);
};

export const aprobarSolicitud = async (token, solicitudId, nota) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/aprobar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ nota: nota || null }),
  });
  return leer(res);
};

export const observarSolicitud = async (token, solicitudId, { motivo, regenerar_link = false }) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/observar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ motivo, regenerar_link }),
  });
  return leer(res);
};

// La descarga de un adjunto de la solicitud es la MISMA de crm_adjuntos:
// stream autenticado, nunca un <a href> ni una URL compartible (son datos
// personales, Ley 25.326).
//
// EL 409 NO ES UN ERROR DE RED: el adjunto existe y su binario todavía está
// viajando a Drive en background (S9). Se traduce a un texto propio para
// que la pantalla no muestre "Error 409" sobre algo que se arregla solo.
export const SUBIENDO = 'El archivo todavía se está subiendo. Probá de nuevo en unos segundos.';

export const descargarAdjuntoSolicitud = async (token, adjunto) => {
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos/${adjunto.id}/descargar`, {
    headers: authHeader(token),
  });
  if (res.status === 409) throw new Error(SUBIENDO);
  if (res.status === 410) throw new Error('El adjunto fue anulado.');
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.blob();
};

export const bajarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre || 'adjunto';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

// EL LISTADO NO TRAE NI LA REFERENCIA DE LA OPORTUNIDAD NI EL NOMBRE DEL
// CLIENTE, y no es un olvido: `SolicitudOut` no declara un solo dato de la
// persona a propósito (los datos viven cifrados y su lectura es ADMIN y
// auditada). La referencia `AYMA-OPP-...` y el `nombre_vinculado` salen de
// la ficha de la oportunidad, que es otro endpoint.
//
// Se piden DE A UNA Y DEDUPLICADAS por oportunidad -varias solicitudes de
// la misma oportunidad son un solo pedido- y el fallo de una NO voltea la
// tabla: esa fila muestra el id, que es lo que igual permite encontrarla.
export const resolverOportunidad = async (token, oportunidadId) => {
  const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

export const resolverOportunidades = async (token, ids, yaConocidas = {}) => {
  const faltantes = [...new Set(ids.filter((id) => id && !yaConocidas[id]))];
  const resueltas = {};
  await Promise.all(faltantes.map(async (id) => {
    try {
      const o = await resolverOportunidad(token, id);
      resueltas[id] = { referencia: o?.token || null, cliente: o?.nombre_vinculado || null };
    } catch {
      resueltas[id] = { referencia: null, cliente: null };
    }
  }));
  return resueltas;
};
