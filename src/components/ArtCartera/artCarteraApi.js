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

// GET /art/empresas/{cuit} - ficha + matriz de 13 aseguradoras + historial +
// cálculo del motor. Devuelve el objeto completo tal cual lo manda el
// backend: {empresa, aseguradoras, historial, calculo, calculo_bloqueado_por}.
export const obtenerEmpresaArt = async (token, cuit) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/empresas/{cuit}/documentos?tipo= - checklist de documentos
// adjuntos (FORM_931/POLIZA_ACTUAL/OTRO). APPEND-ONLY en el backend (cada
// subida crea una fila nueva, nunca pisa la anterior): devuelve TODAS las
// filas ordenadas created_at desc, así que la primera fila de cada `tipo`
// es la vigente - ver app/models/crm/empresa_documento.py del backend. No
// es un envelope Page: el backend devuelve el array directo.
export const listarDocumentosArt = async (token, cuit, { tipo } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos${buildQuery({ tipo })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/empresas/{cuit}/documentos - multipart/form-data (Form `tipo` +
// File `archivo`). Subir el archivo marca conseguido=true automáticamente
// en el backend - ver docstring de subir_documento_empresa_art en
// app/api/v1/art_consultas.py. Ojo: NO se manda Content-Type a mano, el
// browser arma el boundary del multipart solo si dejamos que fetch lo
// infiera de un body FormData.
export const subirDocumentoArt = async (token, cuit, { tipo, archivo }) => {
  const body = new FormData();
  body.set('tipo', tipo);
  body.set('archivo', archivo);
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos`, {
    method: 'POST',
    headers: authHeader(token),
    body,
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// PATCH /art/empresas/{cuit}/documentos/{tipo}/conseguido - sin archivo, para
// cuando el cliente confirma verbalmente que ya tiene el documento antes de
// mandar el PDF. Idempotente: el backend reusa la fila vigente de ese tipo
// o crea una fila placeholder sin archivo - ver docstring de
// marcar_documento_empresa_art_conseguido en app/api/v1/art_consultas.py.
export const marcarDocumentoArtConseguido = async (token, cuit, tipo) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos/${encodeURIComponent(tipo)}/conseguido`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
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

// GET /art/referencial-tarifas - referencial HISTÓRICO de mercado (BLOQUE
// 7): únicamente fuente=PLANILLA_2025, agrupado SIEMPRE por CIIU x tramo
// de dotación x provincia normalizada, más `resumen_global` (total de
// registros y promedio/mediana sobre TODO el universo filtrado, no solo
// por celda) - ver app/schemas/art_dashboard.py::ReferencialTarifasResponse.
// `filtros` acepta: ciiu, provincia, tramo_dotacion, aseguradora. A
// propósito NO trae "ganadora"/"perdedora": esa etiqueta describía el
// resultado real de cada cotización en la planilla original y hoy no
// existe como columna - ver docstring de
// app/services/art_dashboard.py::referencial_tarifas.
export const obtenerReferencialTarifas = async (token, filtros = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/referencial-tarifas${buildQuery(filtros)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  const { items, total } = normalizeList(data);
  return { total, items, resumen_global: data?.resumen_global ?? null };
};

// GET /art/leads-sin-cobertura - empresas verificadas SIN ART vigente que
// tuvieron cobertura antes (lead caliente: perdió cobertura, no "nunca
// tuvo") - ver app/schemas/art_consultas.py::LeadSinCoberturaItem. El
// backend ya ordena (con historial, más reciente primero; sin historial,
// alfabético al final) - el cliente no reordena. `motivo_fin` es substring
// case-insensitive contra el motivo de baja del último contrato.
export const listarLeadsSinCobertura = async (token, { motivo_fin, limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/leads-sin-cobertura${buildQuery({ motivo_fin, limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/analisis - estadística agregada de toda la cartera: tarjetas de
// dotación/masa salarial/LRTM/tarifa/comisión (total/promedio/mediana),
// distribución por riesgo de suscripción y por estrategia, y "cartera a
// defender" (empresas ACTUAL por aseguradora, ya ordenada por comisión
// anual estimada descendente) - ver
// app/schemas/art_dashboard.py::AnalisisARTResponse.
export const obtenerAnalisisArt = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/art/analisis`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/mercado?periodo - cartera propia (mismo cálculo que "cartera a
// defender") comparada contra el boletín SSN/SRT importado con
// POST /art/mercado/importar. `mercado_sin_datos: true` si no hay ningún
// período cargado (o el pedido no existe) - en ese caso los campos de
// mercado/share de cada item vienen en null, NUNCA inventados. Si se omite
// `periodo`, el backend usa el último importado - ver
// app/schemas/art_dashboard.py::MercadoARTResponse.
export const obtenerMercadoArt = async (token, { periodo } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/mercado${buildQuery({ periodo })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/cola-alicuotas?limit=N - tanda de empresas para el "Modo
// Relevamiento" (carga rápida de alícuotas por teléfono): empresas con ART
// confirmada por SRT y sin evento ALICUOTA vigente. `total` es el tamaño
// real del universo pendiente, SIN el recorte de `limit` - ver
// app/schemas/art_consultas.py::ColaAlicuotasResponse.
export const obtenerColaAlicuotas = async (token, { limit = 20 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/cola-alicuotas${buildQuery({ limit })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/alicuotas/carga-rapida - registra en lote el resultado de una
// tanda del Modo Relevamiento. `items`: [{empresa_id, alicuota_pct?,
// art_declarada?, sin_dato}]. Append-only e idempotente por empresa_id +
// fecha_evento (ver app/schemas/art_consultas.py::CargaRapidaAlicuotasResponse).
export const registrarCargaRapidaAlicuotas = async (token, items) => {
  const res = await fetch(`${API_URL}/api/v1/art/alicuotas/carga-rapida`, {
    method: 'POST',
    headers: artHeaders(token),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
