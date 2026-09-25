// Cliente HTTP de la carga versionada de los Cuadros 1 y 2 de la SRT
// (OPERACIONES-0010 paso 3, backend PR #221).
//
//   GET  /art/cuadros-srt/version              la versión vigente (ADMIN)
//   POST /art/cuadros-srt/carga?dry_run=       multipart `archivo` (ADMIN)
//
// NINGÚN CÁLCULO ACÁ: la versión (sale del TÍTULO de la hoja, no del nombre
// del archivo), la cantidad de CIIU y el diff contra la vigente los arma el
// backend. `dry_run` viaja SIEMPRE explícito en la query string y el
// default de acá también es `true`, igual que el backend.
//
// NUNCA SE REINTENTA. El 409 (versión más vieja que la vigente) y el 422
// (hoja, título o columna faltante) son respuestas, no fallas de red: el
// error conserva `status` y el `detail` crudo.
import { authHeader } from '../../utils/api';
import { API_URL } from './artCarteraApi';
import { textoDetail } from './artF931Api';

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

export const obtenerVersionCuadros = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/art/cuadros-srt/version`, { headers: authHeader(token) });
  if (!res.ok) await fallar(res);
  return res.json();
};

// SIN Content-Type: el navegador arma el boundary del multipart.
export const cargarCuadrosSrt = async (token, archivo, { dryRun = true } = {}) => {
  const form = new FormData();
  form.append('archivo', archivo);
  const res = await fetch(
    `${API_URL}/api/v1/art/cuadros-srt/carga?dry_run=${dryRun ? 'true' : 'false'}`,
    { method: 'POST', headers: authHeader(token), body: form },
  );
  if (!res.ok) await fallar(res);
  return res.json();
};
