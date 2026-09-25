// Cliente HTTP de @VALENTINI - ingesta del F.931 desde el PDF
// (OPERACIONES-0010, backend PR #216). Mismo patrón que
// artCotizacionesApi.js: fetch crudo + authHeader.
//
//   POST /art/empresas/{cuit}/f931/pdf?dry_run=     multipart `archivo`
//   GET  /art/f931/propuestas?estado=&limit=&offset=
//   POST /art/f931/propuestas/{id}/aceptar          {motivo} (obligatorio)
//   POST /art/f931/propuestas/{id}/rechazar         {motivo?}
//   GET  /art/f931/censo                             (sólo lectura)
//
// Todos son ADMIN en el backend. NINGÚN CÁLCULO ACÁ: la validación, el
// estado final, la alícuota variable y la dotación antes/después vienen
// del backend tal cual.
//
// LOS ERRORES CONSERVAN EL `detail` CRUDO. El 422 del parser y el 409 de la
// ingesta devuelven un OBJETO (`{motivo, mensaje, campos_faltantes}` /
// `{causa, mensaje, ...}`), y `formatApiError` sólo lee `detail` string:
// sin esto, "El PDF es un escaneo" y "este F.931 ya está cargado" llegarían
// a la pantalla como "Error 422" pelado.
//
// NUNCA SE REINTENTA. Un 4xx es una respuesta, no una falla de red: volver
// a mandar el mismo PDF da el mismo 422, y reintentar un POST con
// dry_run=false es exactamente lo que el 409 existe para frenar.
import { authHeader } from '../../utils/api';
import { API_URL } from './artCarteraApi';

const query = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  });
  const s = qs.toString();
  return s ? `?${s}` : '';
};

// Mensaje legible de un `detail` de FastAPI: string, lista de errores de
// validación u objeto con `mensaje`.
export const textoDetail = (detail) => {
  if (!detail) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join('; ');
  if (typeof detail === 'object') return detail.mensaje || detail.message || JSON.stringify(detail);
  return String(detail);
};

const fallar = async (res) => {
  let detail = null;
  try {
    const body = await res.json();
    detail = body?.detail ?? null;
  } catch {
    // cuerpo no JSON: queda sólo el status
  }
  const texto = textoDetail(detail);
  const err = new Error(`Error ${res.status}${texto ? `: ${texto}` : ''}`);
  err.status = res.status;
  err.detail = detail;
  throw err;
};

const getJson = async (token, path) => {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeader(token) });
  if (!res.ok) await fallar(res);
  return res.json();
};

const postJson = async (token, path, body) => {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) await fallar(res);
  return res.json();
};

// POST /art/empresas/{cuit}/f931/pdf. `dryRun` explícito y `true` por
// default, igual que el backend: grabar es una decisión que se ve en el
// código que llama. SIN Content-Type: el navegador arma el boundary del
// multipart.
export const subirF931Pdf = async (token, cuit, archivo, { dryRun = true } = {}) => {
  const form = new FormData();
  form.append('archivo', archivo);
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/f931/pdf${query({ dry_run: dryRun ? 'true' : 'false' })}`,
    { method: 'POST', headers: authHeader(token), body: form },
  );
  if (!res.ok) await fallar(res);
  return res.json();
};

// GET /art/f931/propuestas - una página. `estado` PROPUESTO (default del
// backend) | APLICADO | RECHAZADO | SUPERADO | todos.
export const listarPropuestasF931 = (token, { estado = 'PROPUESTO', limit = 100, offset = 0 } = {}) => getJson(
  token, `/api/v1/art/f931/propuestas${query({ estado, limit, offset })}`,
);

// Todas las páginas (tope 500 del backend por página).
export const listarTodasPropuestasF931 = async (token, { estado = 'PROPUESTO' } = {}) => {
  const LIMIT = 500;
  let offset = 0;
  let items = [];
  let pagina;
  do {
    pagina = await listarPropuestasF931(token, { estado, limit: LIMIT, offset });
    const lote = Array.isArray(pagina?.items) ? pagina.items : [];
    items = items.concat(lote);
    offset += LIMIT;
    if (lote.length === 0) break;
  } while (offset < (pagina?.total ?? 0));
  return { ...pagina, items };
};

// POST /art/f931/propuestas/{id}/aceptar - `motivo` obligatorio (3..1000).
// 409 si el backend, al revalidar, lo considera no aplicable.
export const aceptarPropuestaF931 = (token, id, motivo) => postJson(
  token, `/api/v1/art/f931/propuestas/${encodeURIComponent(id)}/aceptar`, { motivo },
);

// POST /art/f931/propuestas/{id}/rechazar - el backend acepta motivo
// opcional; la pantalla lo exige igual (OPERACIONES-0010 FE).
export const rechazarPropuestaF931 = (token, id, motivo) => postJson(
  token, `/api/v1/art/f931/propuestas/${encodeURIComponent(id)}/rechazar`, { motivo },
);

// GET /art/f931/censo - sólo lectura.
export const obtenerCensoF931 = (token) => getJson(token, '/api/v1/art/f931/censo');
