// Cliente HTTP del módulo PUNTOS DE CONTACTO (app/api/v1/comercial.py del
// backend, PR #183 / 0fc7bcf). Mismo patrón que Direccion/direccionApi.js:
// fetch crudo + authHeader/formatApiError de utils/api.
//
// TODO EL ROUTER CUELGA DE require_admin (está puesto a nivel de
// APIRouter, no endpoint por endpoint), así que cualquier pantalla de acá es
// ADMIN-only: un EMPLEADO recibiría 403. El gate de isAdmin() en App.jsx es
// el mismo que usan las pantallas de Dirección.
//
// LO PÚBLICO DE ESTE MÓDULO NO SE LLAMA DESDE ACÁ: el redirector
// `GET /r/{slug}` vive en la raíz del backend y lo consume el navegador del
// visitante al escanear el QR, no el portal.
//
// Los listados devuelven ARRAYS PLANOS (List[...] en los response_model), no
// el Page{total,items} de /art/*.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/comercial';

const headers = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, v);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// Error con el cuerpo parseado colgado encima, igual que en direccionApi.
//
// EL 409 DEL SLUG es el caso que justifica guardarlo: el backend explica que
// un slug no se reusa "porque puede haber QR impresos con él", y ese texto
// es exactamente lo que quien está cargando necesita leer. formatApiError lo
// aplastaría a un "Error 409".
const errorDeRespuesta = async (res) => {
  let cuerpo = null;
  try {
    cuerpo = await res.clone().json();
  } catch {
    // no era JSON; nos quedamos con el status
  }
  const err = new Error(await formatApiError(res));
  err.status = res.status;
  err.cuerpo = cuerpo;
  if (res.status === 409 && typeof cuerpo?.detail === 'string') {
    err.message = cuerpo.detail;
    err.slugTomado = true;
  }
  return err;
};

const pedir = async (token, ruta, { metodo = 'GET', cuerpo, query } = {}) => {
  const res = await fetch(`${API_URL}${BASE}${ruta}${buildQuery(query)}`, {
    method: metodo,
    headers: headers(token),
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  if (!res.ok) throw await errorDeRespuesta(res);
  if (res.status === 204) return null;
  return res.json();
};

const lista = async (...args) => {
  const data = await pedir(...args);
  return Array.isArray(data) ? data : [];
};

// --- Puntos de contacto --------------------------------------------------
//
// GET /comercial/puntos-contacto -> PuntoContactoOut[]. `url_corta` y
// `vigente` vienen CALCULADOS por el backend al serializar (no están en la
// tabla): no se rearman acá o habría dos versiones del mismo dato.
export const listarPuntos = (token, filtros = {}) =>
  lista(token, '/puntos-contacto', { query: filtros });

// GET /comercial/puntos-contacto/ranking?orden=leads|conversion&limite=
//
// Va antes que /{punto_id} en el router del backend por una razón que acá no
// se nota pero conviene no romper: registrada al revés, la ruta fija se la
// comería el path parameter.
export const rankingPuntos = (token, { orden = 'leads', limite } = {}) =>
  lista(token, '/puntos-contacto/ranking', { query: { orden, limite } });

export const obtenerPunto = (token, id) =>
  pedir(token, `/puntos-contacto/${encodeURIComponent(id)}`);

export const crearPunto = (token, datos) =>
  pedir(token, '/puntos-contacto', { metodo: 'POST', cuerpo: datos });

// PATCH SIN `slug`: el backend no lo acepta (PuntoContactoPatch no lo
// declara) porque cambiarlo invalida todo lo ya impreso y deja el anterior
// libre para que otro punto se coma la atribución.
export const editarPunto = (token, id, datos) =>
  pedir(token, `/puntos-contacto/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });

// BAJA LÓGICA. El backend sella `deleted_at` y apaga `activo`; la fila no se
// borra nunca porque sus escaneos y sus leads la referencian. Idempotente.
export const darDeBajaPunto = (token, id) =>
  pedir(token, `/puntos-contacto/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

// GET /comercial/puntos-contacto/{id}/metricas -> MetricasPunto
//
// SIN RANGO DE FECHAS: el endpoint no lo acepta (ver metricas_de_punto en
// services/comercial.py). Los números son acumulados desde el alta del
// punto, y la pantalla lo dice en vez de ofrecer un selector que no filtra
// nada.
export const metricasPunto = (token, id) =>
  pedir(token, `/puntos-contacto/${encodeURIComponent(id)}/metricas`);

// --- El PNG del QR -------------------------------------------------------

// NO SE PUEDE USAR COMO `<img src>`: el endpoint cuelga de require_admin y
// un `<img>` no manda el header Authorization, así que la imagen volvería
// 401 y el navegador mostraría el ícono de rota. Se baja como blob con el
// token y se arma una object URL.
//
// Quien llame a esto DEBE llamar a `URL.revokeObjectURL` cuando termina: una
// object URL viva retiene el blob entero en memoria hasta que se recargue la
// página, y acá los blobs son PNG de hasta 2000 px de lado.
export const descargarQrPunto = async (token, id, size) => {
  const res = await fetch(
    `${API_URL}${BASE}/puntos-contacto/${encodeURIComponent(id)}/qr.png${buildQuery({ size })}`,
    { headers: authHeader(token) },
  );
  if (!res.ok) throw await errorDeRespuesta(res);
  return res.blob();
};

// --- Comisiones de referido ----------------------------------------------
//
// OJO CON EL SIGNO: `comisiones_referido` es lo que AYMA le DEBE a un canal
// (egreso). No es `comisiones_liquidadas` de Finanzas, que es lo que una
// compañía nos liquidó (ingreso). Son dos tablas distintas en el backend a
// propósito, y no se suman.
export const listarComisiones = (token, filtros = {}) =>
  lista(token, '/comisiones-referido', { query: filtros });

export const comisionesPendientes = (token, filtros = {}) =>
  lista(token, '/comisiones-referido/pendientes', { query: filtros });

export const obtenerComision = (token, id) =>
  pedir(token, `/comisiones-referido/${encodeURIComponent(id)}`);

// El `monto` lo CALCULA EL SERVIDOR desde `prima_base * comision_pct` si no
// se manda: mandarlo desde el navegador y que no coincida con el porcentaje
// es una discusión que se descubre el día de la liquidación.
export const crearComision = (token, datos) =>
  pedir(token, '/comisiones-referido', { metodo: 'POST', cuerpo: datos });

// Pasar a LIQUIDADA sella `liquidada_en` del lado del servidor, y esa fecha
// no se vuelve a correr en PATCHes posteriores.
export const editarComision = (token, id, datos) =>
  pedir(token, `/comisiones-referido/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });

// ANULA, no borra: la plata que se le reconoció a un canal y después se dio
// de baja tiene que poder auditarse. Idempotente.
export const anularComision = (token, id) =>
  pedir(token, `/comisiones-referido/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
