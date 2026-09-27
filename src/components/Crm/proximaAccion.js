// C-9d - la próxima acción: la forma, la validación y el cuerpo del pedido.
//
// UN SOLO CONTRATO PARA LAS DOS PUERTAS. El backend (`ProximaAccionIn`) pide
// exactamente lo mismo al cerrar un toque (`POST /crm/seguimientos/{id}/
// registrar`) y al completar una tarea de próxima acción (`PATCH /crm/tareas/
// {id}/completar`). Por eso la forma, la validación y el payload viven acá,
// una vez, y los dos modales dibujan el mismo <ProximaAccionForm>.
//
// EL VOCABULARIO NO ESTÁ ACÁ. Los tipos, los motivos de LOOP, los canales y
// los topes salen de `GET /crm/catalogos/proxima-accion`. Lo único que vive
// en el front son las ETIQUETAS en castellano, y un código que no tenga
// etiqueta se muestra crudo: un tipo nuevo del backend aparece igual.
//
// LA VALIDACIÓN NO REEMPLAZA AL 422: lo evita. Las reglas son las de
// `crm_proxima_accion.validar_proxima_accion` y, para el LOOP, las de D-B8
// (`validarLoop` de declaracionLoop.js, reusada, no copiada).
import { authHeader, formatApiError } from '../../utils/api';
import { FORM_LOOP_VACIO, validarLoop, payloadLoop } from './declaracionLoop';

export const TIPO_LOOP = 'SIN_ACCION_LOOP';
export const MOTIVO_OTRO = 'OTRO';
export const TRACK_CON_ALICUOTA = 'ART';
export const HORA_DEFAULT = '10:00';
export const DIAS_RAPIDOS_ACCION = [3, 5, 7, 15, 30];
export const DIAS_RAPIDOS_RECONTACTO = [30, 60, 90, 180];
export const MAX_NOTA = 500;

export const TIPO_ACCION_LABEL = {
  WHATSAPP: 'WhatsApp',
  LLAMAR: 'Llamar',
  RECOTIZAR: 'Recotizar',
  PEDIR_DATOS: 'Pedir datos',
  REUNION: 'Reunión',
  EMITIR: 'Emitir',
  SIN_ACCION_LOOP: 'Sin próxima acción → LOOP',
};
export const etiquetaTipoAccion = (t) => (t ? (TIPO_ACCION_LABEL[t] || t) : '—');

export const LOOP_MOTIVO_LABEL = {
  SIN_RESPUESTA: 'Sin respuesta',
  PRECIO: 'Precio',
  RENOVO_CON_ACTUAL: 'Renovó con la actual',
  NO_INTERESADO: 'No le interesa',
  MAS_ADELANTE: 'Más adelante',
  OTRO: 'Otro',
};
export const etiquetaLoopMotivo = (m) => (m ? (LOOP_MOTIVO_LABEL[m] || m) : '—');

export const CANAL_LABEL = { WHATSAPP: 'WhatsApp', LLAMADA: 'Llamada' };
export const CANAL_DEFAULT = 'WHATSAPP';

// ---------------------------------------------------------------------------
// Fechas en HORA ARGENTINA (offset fijo -3, como `whatsapp.ZONA_AR` del
// backend). El backend mide "futura" y los topes contra el día argentino; un
// navegador con otra zona no puede correr el día.
// ---------------------------------------------------------------------------
const OFFSET_AR_MS = 3 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' de hoy en Argentina. */
export const hoyAr = (ahora = new Date()) =>
  new Date(ahora.getTime() - OFFSET_AR_MS).toISOString().slice(0, 10);

/** 'YYYY-MM-DD' + n días, sin cruzar zonas. */
export const sumarDias = (iso, n) => {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Forma, validación, payload
// ---------------------------------------------------------------------------

/** Sin un solo default de decisión: ni tipo, ni fecha, ni resultado_loop. */
export const FORM_PROXIMA_ACCION_VACIO = {
  tipo: '',
  fecha: '',
  hora: HORA_DEFAULT,
  nota: '',
  fecha_recontacto: '',
  loop_motivo: '',
  loop_motivo_detalle: '',
  ...FORM_LOOP_VACIO,
};

/**
 * El mensaje del primer problema, o null.
 *
 * `contexto`:
 *   - plazoAccion / plazoRecontacto: los topes del catálogo.
 *   - track: el track de la oportunidad, si se conoce.
 *   - trackEstado: 'ok' | 'cargando' | 'error'. Sólo pesa con CON_EFECTO.
 *   - hoy: 'YYYY-MM-DD' (para los tests).
 */
export const validarProximaAccion = (form, contexto = {}) => {
  const {
    plazoAccion = 90, plazoRecontacto = 365, track = null, trackEstado = 'ok', hoy = hoyAr(),
  } = contexto;

  if (!form.tipo) return 'Elegí la próxima acción.';

  if (form.tipo !== TIPO_LOOP) {
    if (!form.fecha) return 'Elegí cuándo.';
    if (form.fecha <= hoy) return 'La fecha tiene que ser futura.';
    if (form.fecha > sumarDias(hoy, plazoAccion)) {
      return `La próxima acción no puede estar a más de ${plazoAccion} días. Más lejos que eso es un LOOP.`;
    }
    if (!/^\d{2}:\d{2}$/.test(form.hora || '')) return 'Indicá la hora.';
    if ((form.nota || '').length > MAX_NOTA) return `La nota admite hasta ${MAX_NOTA} caracteres.`;
    return null;
  }

  if (!form.loop_motivo) return 'Elegí el motivo del LOOP.';
  if (form.loop_motivo === MOTIVO_OTRO && !form.loop_motivo_detalle.trim()) {
    return 'Con motivo "Otro" escribí el detalle: un motivo que no dice nada no se puede recontactar.';
  }
  if (!form.fecha_recontacto) return 'Elegí la fecha de recontacto.';
  if (form.fecha_recontacto <= hoy) return 'La fecha de recontacto tiene que ser futura.';
  if (form.fecha_recontacto > sumarDias(hoy, plazoRecontacto)) {
    return `El recontacto no puede estar a más de ${plazoRecontacto} días.`;
  }

  // D-B8, sin default. El texto y la regla son los de declaracionLoop.js.
  if (!form.resultado_loop) return validarLoop(form);
  if (form.resultado_loop !== 'CON_EFECTO') return null;

  // CON_EFECTO exige las alícuotas, y las alícuotas sólo se muestran en ART.
  if (trackEstado === 'cargando') return 'Esperá: se está leyendo el ramo de la oportunidad.';
  if (trackEstado === 'error') {
    return 'No se pudo leer el ramo de la oportunidad y "Con efecto" necesita las alícuotas. Reintentá.';
  }
  if (track !== TRACK_CON_ALICUOTA) {
    return `"Con efecto" exige las alícuotas previa y posterior, que sólo existen en ART (esta oportunidad es ${track || 'de otro ramo'}). Declarala "Sin efecto".`;
  }
  return validarLoop(form);
};

/** El `proxima_accion` del cuerpo. Sólo los campos que el tipo acepta. */
export const payloadProximaAccion = (form, { track = null } = {}) => {
  if (form.tipo !== TIPO_LOOP) {
    const nota = (form.nota || '').trim();
    return {
      tipo: form.tipo,
      // SIN zona: el backend la toma como hora argentina.
      fecha: `${form.fecha}T${form.hora || HORA_DEFAULT}:00`,
      nota: nota || null,
    };
  }
  const detalle = form.loop_motivo_detalle.trim();
  const loop = track === TRACK_CON_ALICUOTA
    ? payloadLoop(form)
    : { resultado_loop: form.resultado_loop || null };
  return {
    tipo: TIPO_LOOP,
    fecha_recontacto: form.fecha_recontacto,
    loop_motivo: form.loop_motivo,
    loop_motivo_detalle: detalle || null,
    ...loop,
  };
};

/**
 * ¿El backend exige la próxima acción al cerrar este toque?
 * Con respuesta, siempre; sin respuesta, sólo en el último toque.
 * `huboRespuesta` null = todavía no se eligió: no se muestra nada.
 */
export const toqueExigeProximaAccion = (huboRespuesta, numeroDeToque, maxToques) =>
  huboRespuesta === true || (huboRespuesta === false && numeroDeToque >= maxToques);

export const TAREA_ORIGEN_PROXIMA_ACCION = 'PROXIMA_ACCION';
export const esTareaProximaAccion = (tarea) => tarea?.origen === TAREA_ORIGEN_PROXIMA_ACCION;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';
const BASE = `${API_URL}/api/v1/crm`;

let catalogoEnCurso = null;

/** GET /crm/catalogos/proxima-accion. Se pide una vez; si falla, se vuelve a pedir. */
export const catalogoProximaAccion = (token) => {
  if (!catalogoEnCurso) {
    catalogoEnCurso = fetch(`${BASE}/catalogos/proxima-accion`, { headers: authHeader(token) })
      .then(async (res) => {
        if (!res.ok) throw new Error(await formatApiError(res));
        const c = await res.json();
        if (!Array.isArray(c?.tipos) || !Array.isArray(c?.loop_motivos)) {
          throw new Error('el catálogo de próxima acción llegó incompleto');
        }
        return c;
      })
      .catch((err) => { catalogoEnCurso = null; throw err; });
  }
  return catalogoEnCurso;
};

/** Para los tests: olvidar el catálogo pedido. */
export const olvidarCatalogoProximaAccion = () => { catalogoEnCurso = null; };

/** GET /crm/oportunidades/{id} - sólo para leer el track. */
export const trackDeOportunidad = async (token, oportunidadId) => {
  const res = await fetch(`${BASE}/oportunidades/${encodeURIComponent(oportunidadId)}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return data?.track || null;
};

/** PATCH /crm/tareas/{id}/completar. `proxima_accion` sólo si viene. */
export const completarTarea = async (token, tareaId, { resultado, proxima_accion } = {}) => {
  const cuerpo = {};
  if (resultado) cuerpo.resultado = resultado;
  if (proxima_accion) cuerpo.proxima_accion = proxima_accion;
  const res = await fetch(`${BASE}/tareas/${encodeURIComponent(tareaId)}/completar`, {
    method: 'PATCH',
    headers: { ...authHeader(token), 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/** GET /crm/metricas/sin-proxima-accion (ADMIN). */
export const sinProximaAccion = async (token, { limit = 200 } = {}) => {
  const res = await fetch(`${BASE}/metricas/sin-proxima-accion?limit=${limit}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

/** Texto del aviso con lo que quedó programado (ProximaAccionOut). */
export const resumenProgramado = (out, formatear) => {
  if (!out) return null;
  if (out.tipo === TIPO_LOOP) {
    return `Pasó a LOOP · recontacto ${formatear.fecha(out.fecha_recontacto)}${out.loop_motivo ? ` · ${etiquetaLoopMotivo(out.loop_motivo)}` : ''}`;
  }
  return `Próxima acción: ${etiquetaTipoAccion(out.tipo)} el ${formatear.fechaHora(out.fecha_programada)}`;
};
