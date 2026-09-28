// Cliente HTTP de @PAZ (OPERACIONES-0016, backend PR #242 y #243, f5e21d1):
// la bandeja de contactos propuestos, los hallazgos sin CUIT, el diagnóstico
// de teléfonos (ART-116), la métrica y el padrón de fuentes de datos. Mismo
// patrón que artCotizacionesApi.js: fetch crudo + authHeader/formatApiError.
//
// NINGÚN CÁLCULO ACÁ. Alertas, `bloquea_lote`, fracciones de la métrica y
// conteos del diagnóstico los resuelve el backend.
//
// El alta de directorio es `dry_run=true` POR DEFAULT en el backend: acá
// `dryRun` viaja SIEMPRE explícito en la query string y el default también
// es `true` (PROC-2: escribir es una decisión visible en el que llama).
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

// El error lleva `.status`: el 409 de aceptar (la propuesta caducó) se
// muestra distinto de un 422 o un 500.
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
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) await fallar(res);
  return res.json();
};

const BASE = '/api/v1/art';

// GET /art/workers/paz/metrica (ADMIN o EMPLEADO).
export const obtenerMetricaPaz = (token) => getJson(token, `${BASE}/workers/paz/metrica`);

// GET /art/contacto-propuestas (ADMIN) - una página.
export const listarPropuestasContacto = (token, {
  estado = 'PENDIENTE', tipo, fuente, bloquea_lote, limit = 100, offset = 0,
} = {}) => getJson(
  token,
  `${BASE}/contacto-propuestas${query({ estado, tipo, fuente, bloquea_lote, limit, offset })}`,
);

// Todas las páginas (limit=100 + offset hasta `total`). Devuelve la última
// página con los `items` acumulados: `total` sigue siendo el del backend.
export const listarTodasPropuestasContacto = async (token, filtros = {}) => {
  const LIMIT = 100;
  let offset = 0;
  let items = [];
  let pagina;
  do {
    pagina = await listarPropuestasContacto(token, { ...filtros, limit: LIMIT, offset });
    const lote = Array.isArray(pagina?.items) ? pagina.items : [];
    items = items.concat(lote);
    offset += LIMIT;
    if (!lote.length) break;
  } while (offset < (pagina?.total ?? 0));
  return { ...pagina, items };
};

// POST /art/contacto-propuestas/{id}/aceptar - sin body. 409 = caduca
// (YA_EXISTE / YA_EXISTE_INACTIVO): la propuesta queda CADUCA.
export const aceptarPropuestaContacto = (token, id) => postJson(
  token, `${BASE}/contacto-propuestas/${encodeURIComponent(id)}/aceptar`, {},
);

// POST /art/contacto-propuestas/{id}/rechazar - `motivo` obligatorio, ≤ 500.
export const rechazarPropuestaContacto = (token, id, motivo) => postJson(
  token, `${BASE}/contacto-propuestas/${encodeURIComponent(id)}/rechazar`, { motivo },
);

// POST /art/contacto-propuestas/aceptar-lote - cada ítem en su transacción;
// el resultado viene por ítem (ACEPTADA · BLOQUEADA_POR_ALERTA · ERROR).
export const aceptarLotePropuestasContacto = (token, ids) => postJson(
  token, `${BASE}/contacto-propuestas/aceptar-lote`, { ids },
);

// GET /art/workers/paz/sin-cuit (ADMIN).
export const listarSinCuit = (token, { fuente, limit = 100, offset = 0 } = {}) => getJson(
  token, `${BASE}/workers/paz/sin-cuit${query({ fuente, limit, offset })}`,
);

// GET /art/workers/paz/diagnostico-telefonos (ADMIN, ART-116). Sólo conteos.
export const obtenerDiagnosticoTelefonos = (token) => getJson(
  token, `${BASE}/workers/paz/diagnostico-telefonos`,
);

// GET /art/fuentes-datos (ADMIN) - `permitida_worker` es la EFECTIVA.
export const listarFuentesDatos = (token) => getJson(token, `${BASE}/fuentes-datos`);

// POST /art/fuentes-datos/directorios?dry_run= (ADMIN).
export const altaDirectorio = (token, body, { dryRun = true } = {}) => postJson(
  token,
  `${BASE}/fuentes-datos/directorios${query({ dry_run: dryRun ? 'true' : 'false' })}`,
  body,
);

// POST /art/workers/paz/saneamiento?dry_run= (ADMIN con JWT, ART-116 · PR 3).
// Sin body. Sólo contadores y una muestra (empresa, fuente, tipo): el
// backend no devuelve un solo valor de contacto. `dryRun` viaja SIEMPRE
// explícito y el default es `true`.
export const sanearTelefonosPaz = (token, { dryRun = true } = {}) => postJson(
  token,
  `${BASE}/workers/paz/saneamiento${query({ dry_run: dryRun ? 'true' : 'false' })}`,
);
