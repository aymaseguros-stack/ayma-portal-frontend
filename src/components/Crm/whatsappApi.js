// C-4c: WhatsApp en el CRM. Backend: app/api/v1/whatsapp.py (PR #198 y #199).
//
//   GET  /crm/whatsapp/sin-clasificar               la bandeja (D-C31)
//   POST /crm/whatsapp/sin-clasificar/{wa_id}/alta  es un cliente
//   POST /crm/whatsapp/sin-clasificar/{wa_id}/personal  es personal
//   GET  /crm/whatsapp/mensajes                     metadata, NUNCA el texto
//   GET  /admin/whatsapp/salud                      ADMIN
//
// EL TEXTO NO ESTÁ Y NO SE PIDE. El backend guarda en la base sólo el SHA-256
// del texto (D-C27); el cuerpo vive en un JSONL del Drive. Esta pantalla no
// lo busca, no lo muestra y no arma un link a ese JSONL: la ficha dice QUE
// hubo conversación, no QUÉ se dijo.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const leer = async (res) => {
  if (!res.ok) {
    const err = new Error(await formatApiError(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
};

const qs = (params) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
};

// --- La bandeja sin clasificar -------------------------------------------

/** GET /crm/whatsapp/sin-clasificar -> {total, limit, offset, items[]} */
export const listarSinClasificar = (token, { limit = 200, offset = 0 } = {}) =>
  fetch(`${API_URL}/api/v1/crm/whatsapp/sin-clasificar${qs({ limit, offset })}`, {
    headers: authHeader(token),
  }).then(leer);

// Los campos vacíos NO se mandan: el backend los toma como "no vino" y la
// persona nace como "WhatsApp +54...". Mandar "" chocaría con EmailStr (422).
const sinVacios = (datos = {}) => Object.fromEntries(
  Object.entries(datos)
    .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    .filter(([, v]) => v !== undefined && v !== null && v !== ''),
);

const clasificar = (token, waId, accion, datos) =>
  fetch(`${API_URL}/api/v1/crm/whatsapp/sin-clasificar/${encodeURIComponent(waId)}/${accion}`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(sinVacios(datos)),
  }).then(leer);

/** POST .../{wa_id}/alta {nombre?, apellido?, email?} -> ClasificacionOut */
export const altaDesdeBandeja = (token, waId, datos) => clasificar(token, waId, 'alta', datos);

/** POST .../{wa_id}/personal {nombre?} -> ClasificacionOut */
export const marcarPersonal = (token, waId, datos) => clasificar(token, waId, 'personal', datos);

// --- Mensajes de una ficha -----------------------------------------------

/** GET /crm/whatsapp/mensajes?persona_id|oportunidad_id -> {total, items[]} */
export const listarMensajes = (token, { personaId, oportunidadId, limit = 100, offset = 0 } = {}) =>
  fetch(`${API_URL}/api/v1/crm/whatsapp/mensajes${qs({
    persona_id: personaId, oportunidad_id: oportunidadId, limit, offset,
  })}`, { headers: authHeader(token) }).then(leer);

/**
 * PATCH /crm/personas/{id} {excluir_whatsapp}. Sólo ADMIN: el backend le
 * contesta 403 a un EMPLEADO y no escribe nada (C-4c).
 */
export const cambiarExcluirWhatsapp = (token, personaId, valor) =>
  fetch(`${API_URL}/api/v1/crm/personas/${encodeURIComponent(personaId)}`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ excluir_whatsapp: Boolean(valor) }),
  }).then(leer);

// --- Salud (admin) --------------------------------------------------------

/** GET /admin/whatsapp/salud */
export const saludWhatsapp = (token) =>
  fetch(`${API_URL}/api/v1/admin/whatsapp/salud`, { headers: authHeader(token) }).then(leer);

// --- Presentación ---------------------------------------------------------

// LA HORA DE META LLEGA EN UTC SIN ZONA. El backend la arma con
// `datetime.utcfromtimestamp(timestamp)` y la serializa como
// "2026-09-24T15:04:05", sin "Z". `new Date()` toma un ISO con hora y sin
// zona como hora LOCAL, así que en Argentina el mensaje aparecería tres horas
// antes de lo que Meta dice. Se le agrega la Z sólo si no trae zona.
const TIENE_ZONA = /(Z|[+-]\d{2}:?\d{2})$/i;

export const instanteUTC = (valor) => {
  if (!valor) return null;
  const texto = String(valor);
  const fecha = new Date(TIENE_ZONA.test(texto) ? texto : `${texto}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

// Hora argentina explícita: es el mismo "día" con el que el backend arma el
// JSONL diario, y así la pantalla no depende del reloj de la máquina.
export const horaMeta = (valor) => {
  const fecha = instanteUTC(valor);
  if (!fecha) return valor || '—';
  return fecha.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
};

// `media_storage_ref` es el id del archivo en Drive. Sólo se ofrece link con
// el archivo SUBIDO: PENDIENTE/FALLIDO todavía no está, y EXCLUIDO no existe
// (D-C30 / bandeja).
export const linkDrive = (mensaje) => (
  mensaje?.estado_media === 'SUBIDO' && mensaje?.media_storage_ref
    ? `https://drive.google.com/file/d/${encodeURIComponent(mensaje.media_storage_ref)}/view`
    : null
);

export const DIRECCION_LABEL = { IN: 'Entrante', OUT: 'Saliente' };

export const TIPO_LABEL = {
  text: 'Texto',
  image: 'Imagen',
  audio: 'Audio',
  video: 'Video',
  document: 'Documento',
  sticker: 'Sticker',
  location: 'Ubicación',
  contacts: 'Contacto',
  reaction: 'Reacción',
  interactive: 'Interactivo',
  button: 'Botón',
};

export const tipoLegible = (tipo) => TIPO_LABEL[tipo] || tipo || '—';

// Qué pasó con el adjunto, en castellano. `NO_APLICA` = el mensaje no
// traía archivo, y no se dibuja nada.
export const ESTADO_MEDIA_LABEL = {
  SUBIDO: 'En Drive',
  PENDIENTE: 'Subiendo',
  FALLIDO: 'Falló la subida',
  EXCLUIDO: 'No se guarda',
};

// Las claves de configuración de /salud, en el orden en que se cargan en
// Render. `faltan` las nombra; acá sólo se les da una descripción.
export const CONFIG_LABEL = {
  WHATSAPP_ENABLED: 'Módulo encendido',
  WHATSAPP_APP_SECRET: 'App secret (firma del webhook)',
  WHATSAPP_VERIFY_TOKEN: 'Verify token',
  WHATSAPP_ACCESS_TOKEN: 'Access token (multimedia)',
  WHATSAPP_PHONE_NUMBER_ID: 'Phone number ID',
};
