// Cliente HTTP del circuito de cotizaciones ART (OPERACIONES-0008, backend
// PR #204 y #205): bandejas, respuesta de la compañía, tandas a canal y la
// dotación DECLARADA. Mismo patrón que artCarteraApi.js: fetch crudo +
// authHeader/formatApiError.
//
// NINGÚN CÁLCULO ACÁ. Las etapas, los estados derivados de cada par, los
// contadores, el SLA y las impedidas los resuelve el backend; este módulo
// sólo arma el pedido y devuelve la respuesta tal cual.
//
// LOS TRES ENDPOINTS QUE ESCRIBEN POR TANDA SON `dry_run=true` POR DEFAULT
// EN EL BACKEND. Por eso `dryRun` viaja SIEMPRE explícito en la query
// string (nunca en el body: ahí es 422) y el default de acá también es
// `true`: escribir tiene que ser una decisión que se ve en el código que
// llama, no un olvido.
import { authHeader, formatApiError } from '../../utils/api';
import { API_URL } from './artCarteraApi';

const headers = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

const query = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// El error lleva `.status`: el 409 de la dotación (la empresa tiene F.931)
// y el 422 de una respuesta mal armada se muestran en el modal, no como
// "no se pudo cargar".
const fallar = async (res) => {
  const err = new Error(await formatApiError(res));
  err.status = res.status;
  throw err;
};

const getJson = async (token, path) => {
  const res = await fetch(`${API_URL}${path}`, { headers: headers(token) });
  if (!res.ok) await fallar(res);
  return res.json();
};

const postJson = async (token, path, body) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) await fallar(res);
  return res.json();
};

// GET /art/cotizaciones/bandeja - una fila por par empresa-aseguradora en la
// etapa que derivan sus eventos. `resumen.por_etapa` cuenta con todos los
// filtros menos `etapa`: son los contadores de las solapas.
export const obtenerBandejaCotizaciones = (token, {
  etapa, canal, tanda_id, aseguradora, respuesta, limit = 500, offset = 0,
} = {}) => getJson(
  token,
  `/api/v1/art/cotizaciones/bandeja${query({ etapa, canal, tanda_id, aseguradora, respuesta, limit, offset })}`,
);

// POST /art/cotizaciones/respuesta - lo que contestó la compañía. No tiene
// dry_run en el backend: la confirmación la pide el modal antes de llamar.
export const registrarRespuestaCotizacion = (token, body) => postJson(
  token, '/api/v1/art/cotizaciones/respuesta', body,
);

// GET /art/tandas - enviadas / devueltas / faltan / sin_respuesta, derivado.
export const listarTandas = (token) => getJson(token, '/api/v1/art/tandas');

// GET /art/tandas/{id} - por empresa y por par, el estado derivado.
export const obtenerTanda = (token, tandaId) => getJson(
  token, `/api/v1/art/tandas/${encodeURIComponent(tandaId)}`,
);

// GET /art/tandas/propuesta - SOLO LECTURA: la próxima tanda sugerida.
export const proponerTanda = (token, { canal, n = 20 } = {}) => getJson(
  token, `/api/v1/art/tandas/propuesta${query({ canal, n })}`,
);

// POST /art/tandas?dry_run= - arma la tanda. Con dryRun=true (default) el
// backend recorre la MISMA decisión y no escribe nada.
export const armarTanda = (token, body, { dryRun = true } = {}) => postJson(
  token, `/api/v1/art/tandas${query({ dry_run: dryRun ? 'true' : 'false' })}`, body,
);

// POST /art/empresas/{id}/dotacion?dry_run= (ADMIN) - dotación DECLARADA.
// 409 si la empresa tiene F.931: un dato declarado no pisa uno confirmado.
export const declararDotacion = (token, empresaId, { dotacion, nota }, { dryRun = true } = {}) => {
  const body = { dotacion, fuente: 'DECLARADA' };
  if (nota && nota.trim()) body.nota = nota.trim();
  return postJson(
    token,
    `/api/v1/art/empresas/${encodeURIComponent(empresaId)}/dotacion${query({ dry_run: dryRun ? 'true' : 'false' })}`,
    body,
  );
};

// ---------------------------------------------------------------------------
// @CERVI - propuestas de dotación (OPERACIONES-0009, backend PR #207 y #208)
// ---------------------------------------------------------------------------
// D-OP9-1: el worker PROPONE, una persona confirma. Nada de lo que sigue
// escribe en la empresa salvo `aceptar` / `aceptar-lote`, y los dos son
// require_admin en el backend.

// GET /art/workers/cervi/metrica - ventana_40 y % de comisión de Bloque 3
// sobre dotación MEDIA o más. Sólo lectura.
export const obtenerMetricaCervi = (token) => getJson(token, '/api/v1/art/workers/cervi/metrica');

// GET /art/workers/cervi/ciiu-sin-cuadro - los CIIU omitidos por no tener
// Cuadro 1. `origen` CORRIDA | RECALCULADO. Sólo lectura.
export const obtenerCiiuSinCuadro = (token) => getJson(token, '/api/v1/art/workers/cervi/ciiu-sin-cuadro');

// GET /art/dotacion-propuestas - una página. `por_revision` cuenta los dos
// grupos con el filtro de estado y sin el de revisión.
export const listarPropuestasDotacion = (token, {
  estado = 'PENDIENTE', revision = 'todas', limit = 100, offset = 0,
} = {}) => getJson(
  token,
  `/api/v1/art/dotacion-propuestas${query({ estado, revision, limit, offset })}`,
);

// Todas las páginas (limit=100 + offset hasta `total`), mismo criterio que
// la lista de Acción comercial. Devuelve la ÚLTIMA página con `items`
// acumulados, así `total` y `por_revision` siguen siendo los del backend.
export const listarTodasPropuestasDotacion = async (token, { estado = 'PENDIENTE', revision = 'todas' } = {}) => {
  const LIMIT = 100;
  let offset = 0;
  let items = [];
  let pagina;
  do {
    pagina = await listarPropuestasDotacion(token, { estado, revision, limit: LIMIT, offset });
    const lote = Array.isArray(pagina?.items) ? pagina.items : [];
    items = items.concat(lote);
    offset += LIMIT;
    if (lote.length === 0) break;
  } while (offset < (pagina?.total ?? 0));
  return { ...pagina, items };
};

// POST /art/dotacion-propuestas/{id}/aceptar - `valor` opcional: si difiere
// del propuesto la propuesta queda EDITADA. 409 = fuente superior.
export const aceptarPropuestaDotacion = (token, id, { valor } = {}) => {
  const body = {};
  if (valor !== undefined && valor !== null) body.valor = valor;
  return postJson(token, `/api/v1/art/dotacion-propuestas/${encodeURIComponent(id)}/aceptar`, body);
};

// POST /art/dotacion-propuestas/{id}/rechazar - `motivo` obligatorio.
export const rechazarPropuestaDotacion = (token, id, motivo) => postJson(
  token, `/api/v1/art/dotacion-propuestas/${encodeURIComponent(id)}/rechazar`, { motivo },
);

// POST /art/dotacion-propuestas/aceptar-lote - cada id con su valor
// PROPUESTO (el lote no acepta valores). Un grande sale REQUIERE_REVISION
// salvo que venga en `forzar_ids`; desde esta pantalla nunca se fuerza.
export const aceptarLotePropuestasDotacion = (token, ids, { forzarIds = [] } = {}) => {
  const body = { ids };
  if (forzarIds.length) body.forzar_ids = forzarIds;
  return postJson(token, '/api/v1/art/dotacion-propuestas/aceptar-lote', body);
};

// POST /art/workers/cervi/corrida?dry_run=&limit= (ADMIN). En seco no
// escribe nada, ni la corrida. Mismo criterio que la tanda: `dryRun`
// explícito y `true` por default.
export const correrCervi = (token, { limit = 50 } = {}, { dryRun = true } = {}) => postJson(
  token,
  `/api/v1/art/workers/cervi/corrida${query({ dry_run: dryRun ? 'true' : 'false', limit })}`,
  {},
);
