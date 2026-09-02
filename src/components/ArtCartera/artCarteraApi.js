// Cliente HTTP del módulo "Cartera ART" (Bloque 5) - GET /art/empresas,
// GET /art/empresas/{cuit}, GET /art/desbloqueos, GET /art/tecnica-vencida y
// POST /art/estado (app/api/v1/art_consultas.py del backend). Mismo patrón
// que src/components/Mail/mailApi.js: fetch crudo + authHeader/formatApiError
// de utils/api, con normalizeList para los listados paginados (Page{total,
// items,limit,offset} - ver app/schemas/common.py del backend).
import { authHeader, formatApiError, normalizeList } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const artHeaders = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

// Arma el query string salteando params undefined/null/'' para no mandar
// filtros vacíos como querystring literal (ej. ciiu='' no debe ser ?ciiu=).
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') qs.set(key, value);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// GET /art/empresas - listado server-side paginado de la cartera ART.
// `filtros` acepta: ciiu, provincia, dotacion_min, dotacion_max,
// riesgo_suscripcion, estado_efectivo, aseguradora, estrategia_art, q,
// order_by, limit, offset (ver app/api/v1/art_consultas.py).
export const listarEmpresasArt = async (token, filtros = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas${buildQuery(filtros)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/empresas/{cuit} - ficha + matriz de 12 aseguradoras + historial +
// cálculo del motor. Devuelve el objeto completo tal cual lo manda el
// backend: {empresa, aseguradoras, historial, calculo, calculo_bloqueado_por}.
export const obtenerEmpresaArt = async (token, cuit) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/desbloqueos?dias=N - leads calientes: bloqueos que caducan dentro
// de los próximos N días.
export const listarDesbloqueos = async (token, { dias = 7, limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/desbloqueos${buildQuery({ dias, limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/tecnica-vencida - reclamos TECNICA cuyo SLA ya venció sin
// respuesta posterior de la aseguradora.
export const listarTecnicaVencida = async (token, { limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/tecnica-vencida${buildQuery({ limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// POST /art/estado - registra un evento nuevo (append-only) para
// empresa+aseguradora. `payload`: {cuit, aseguradora, tipo, alicuota?,
// motivo?, productor_bloqueante?, fecha_evento?, dias_vigencia?, dias_sla?,
// fuente?, nota?}. Devuelve {registro, riesgo_suscripcion}.
export const registrarEstadoArt = async (token, payload) => {
  const res = await fetch(`${API_URL}/api/v1/art/estado`, {
    method: 'POST',
    headers: artHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
