// Pipeline comercial dirigido por actos (backend: app/api/v1/crm_pipeline.py,
// PR #176) y la agenda de seguimientos.
//
// LA REGLA QUE ESTE MÓDULO HACE CUMPLIR DEL LADO DEL NAVEGADOR: `estado_crm`
// NO se manda. Es consecuencia del acto registrado. No hay acá ninguna función
// que acepte un estado del embudo como argumento, y es a propósito: mientras
// existiera una, alguna pantalla iba a volver a ofrecer el desplegable. Los
// dos únicos destinos que se piden a mano son LOOP y RECUPERABLE, y para eso
// está `pedirTransicion`, que exige los campos de cada uno.
//
// El estado se deriva así (tabla del backend, acá sólo para leerla al lado del
// código que la usa):
//
//   CONTACTO → DATO · CALIFICACION → PROSPECTO · COTIZACION → POTENCIAL ·
//   EMISION → CLIENTE
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

export const MAX_TOQUES = 3;

// Una clave por INTENTO del usuario, no por request: si el fetch se corta y la
// persona vuelve a apretar "Confirmar", la clave tiene que ser la misma para
// que el backend devuelva la cotización que ya registró en vez de entregarla
// dos veces (26 puntos y dos cadencias sobre el mismo prospecto). Por eso la
// genera el componente una sola vez al abrir el modal y la pasa acá.
export const nuevaIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Sin crypto.randomUUID (navegador viejo, contexto no seguro): alcanza con
  // que sea única por intento, no hace falta que sea criptográfica.
  return `cot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * POST /crm/oportunidades/{id}/cotizacion-entregada
 *
 * Una sola llamada: acto COTIZACION, PDF adjunto, POTENCIAL, 13 puntos y el
 * toque 1 a +24 h. `multipart/form-data`, así que NO se setea Content-Type a
 * mano: el navegador tiene que poner el boundary.
 */
export const registrarCotizacionEntregada = async (token, oportunidadId, datos, idempotencyKey) => {
  const body = new FormData();
  body.append('compania', datos.compania);
  body.append('premio', String(datos.premio));
  if (datos.vehiculo) body.append('vehiculo', datos.vehiculo);
  if (datos.resumen) body.append('resumen', datos.resumen);
  if (datos.archivo) body.append('archivo', datos.archivo);

  const headers = { ...authHeader(token) };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const res = await fetch(
    `${API_URL}/api/v1/crm/oportunidades/${encodeURIComponent(oportunidadId)}/cotizacion-entregada`,
    { method: 'POST', headers, body },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/**
 * POST /crm/oportunidades/{id}/transicion — LOOP o RECUPERABLE, nada más.
 *
 * Los campos obligatorios los exige el backend (409 con el motivo), y el
 * formulario los pide antes: un 409 evitable es una pantalla que hace perder
 * el texto que la persona ya escribió.
 */
export const pedirTransicion = async (token, oportunidadId, datos) => {
  const res = await fetch(
    `${API_URL}/api/v1/crm/oportunidades/${encodeURIComponent(oportunidadId)}/transicion`,
    {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        estado_crm: datos.estado_crm,
        fecha_recontacto: datos.fecha_recontacto || null,
        fecha_baja: datos.fecha_baja || null,
        motivo_baja: datos.motivo_baja || null,
        nota: datos.nota || null,
      }),
    },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/** POST /crm/oportunidades/{id}/acto — el acto deriva el estado. */
export const registrarActo = async (token, oportunidadId, datos) => {
  const res = await fetch(
    `${API_URL}/api/v1/crm/oportunidades/${encodeURIComponent(oportunidadId)}/acto`,
    {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo_acto: datos.tipo_acto,
        canal: datos.canal || null,
        asunto: datos.asunto || null,
        resumen: datos.resumen || null,
      }),
    },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/** GET /crm/seguimientos/hoy — pendientes hasta hoy, vencidos incluidos. */
export const seguimientosDeHoy = async (token, { soloMios = false } = {}) => {
  const url = new URL(`${API_URL}/api/v1/crm/seguimientos/hoy`);
  if (soloMios) url.searchParams.set('solo_mios', 'true');
  const res = await fetch(url.toString(), { headers: authHeader(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/** POST /crm/seguimientos/{id}/registrar — resultado del toque. */
export const registrarSeguimiento = async (token, seguimientoId, datos) => {
  const res = await fetch(
    `${API_URL}/api/v1/crm/seguimientos/${encodeURIComponent(seguimientoId)}/registrar`,
    {
      method: 'POST',
      headers: { ...authHeader(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultado: datos.resultado,
        hubo_respuesta: datos.hubo_respuesta !== false,
        canal: datos.canal || 'WHATSAPP',
      }),
    },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
