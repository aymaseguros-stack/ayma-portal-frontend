// Cliente HTTP para el módulo de Mail (bandeja de correo del portal).
// Mismo patrón que el resto del CRM: fetch crudo + authHeader/formatApiError
// de utils/api, con normalizeList para los listados paginados.
import { authHeader, formatApiError, normalizeList } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

export const mailHeaders = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

// Arma el query string salteando params undefined/null/'' para no mandar
// filtros vacíos (ej. q='' no debe convertirse en ?q=).
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// Listado general de correos. `params` acepta: direccion (IN/OUT),
// relevante (true/false), estado_vinculacion (SIN_VINCULAR), q, page, page_size.
export const listarEmails = async (token, params) => {
  const res = await fetch(`${API_URL}/api/v1/email${buildQuery(params)}`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// Detalle de un correo (con cuerpo), a demanda al abrir el panel lateral o
// al expandir un email dentro del timeline de una ficha.
export const obtenerEmail = async (token, id) => {
  const res = await fetch(`${API_URL}/api/v1/email/${id}`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Vincula un correo a una entidad del CRM (persona/empresa/grupo/oportunidad/lead).
export const vincularEmail = async (token, id, { tipoEntidad, entidadId }) => {
  const res = await fetch(`${API_URL}/api/v1/email/${id}/vincular`, {
    method: 'PATCH',
    headers: mailHeaders(token),
    body: JSON.stringify({ tipo_entidad: tipoEntidad, entidad_id: entidadId }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Marca un correo puntual como ruido (no relevante) desde el panel lateral.
export const marcarEmailComoRuido = async (token, id) => {
  const res = await fetch(`${API_URL}/api/v1/email/${id}`, {
    method: 'PATCH',
    headers: mailHeaders(token),
    body: JSON.stringify({ relevante: false }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Buscador del CRM (personas/empresas/grupos/oportunidades/leads), reutilizado
// para vincular un correo a una ficha. Mismo endpoint que usa PersonasPanel.
export const buscarEnCrm = async (token, q) => {
  const res = await fetch(`${API_URL}/api/v1/crm/buscar?q=${encodeURIComponent(q)}`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Ranking de remitentes frecuentes dentro del "ruido", para la limpieza masiva.
export const remitentesFrecuentes = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/email/remitentes-frecuentes`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return normalizeList(data).items;
};

// Ignora un remitente completo: lo excluye a futuro y marca retroactivamente
// todo lo que ya había entrado de ese remitente como ruido.
export const ignorarRemitente = async (token, remitente) => {
  const res = await fetch(`${API_URL}/api/v1/email/ignorar-remitente`, {
    method: 'POST',
    headers: mailHeaders(token),
    body: JSON.stringify({ remitente }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Cuentas de correo conectadas (con última sincronización y estado).
export const listarCuentas = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/email/cuentas`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json()).items;
};

// Dispara una sincronización manual de una cuenta, con la ventana de días
// elegida en el selector (30/90/180, default 90).
export const sincronizarCuenta = async (token, cuentaId, dias) => {
  const res = await fetch(`${API_URL}/api/v1/email/cuentas/${cuentaId}/sincronizar`, {
    method: 'POST',
    headers: mailHeaders(token),
    body: JSON.stringify({ dias }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Inicia el flujo OAuth para conectar una cuenta nueva; el backend devuelve
// la URL a la que hay que redirigir al usuario.
export const iniciarConexionCuenta = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/email/auth/iniciar`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return data.url || data.auth_url || data.redirect_url;
};

// Envía un correo desde el compositor (Responder en la bandeja, o Redactar
// desde el timeline de una ficha). Si se abre desde una oportunidad, se manda
// oportunidad_id para que el backend deje el token en el asunto.
export const enviarEmail = async (token, payload) => {
  const res = await fetch(`${API_URL}/api/v1/email/enviar`, {
    method: 'POST',
    headers: mailHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail?.[0]?.msg || err.detail || 'No se pudo enviar el correo');
  }
  return res.json();
};

// Timeline unificado de una ficha (interacciones + tareas + cambios de estado
// + emails), consumido tanto por Crm/Timeline.jsx como potencialmente por Mail.
export const obtenerTimeline = async (token, tipo, id) => {
  const res = await fetch(`${API_URL}/api/v1/crm/interacciones/timeline/${tipo}/${id}`, { headers: mailHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return data.items || [];
};

export const ESTADOS_VINCULACION_BADGE = {
  VINCULADO: 'bg-green-500/20 text-green-400',
  SIN_VINCULAR: 'bg-yellow-500/20 text-yellow-400',
};

export const TIPO_ENTIDAD_LABEL = {
  persona: 'Persona',
  empresa: 'Empresa',
  grupo: 'Grupo',
  oportunidad: 'Oportunidad',
  lead: 'Lead',
  siniestro: 'Siniestro',
};
