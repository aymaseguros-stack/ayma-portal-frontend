// Cliente HTTP de QR-EMI, lado del PORTAL
// (backend: app/api/v1/crm_solicitudes_emision.py, C-6h / 27cfd4d).
//
// SIETE ENDPOINTS Y DOS NO SON COMO LOS OTROS CINCO. Generar, revocar,
// listar, aprobar y observar cuelgan de `require_admin_o_agente` y no
// muestran un solo dato del formulario. `verSolicitud` -el detalle- cuelga
// de `require_admin`, devuelve el DNI, el CBU y el domicilio DESCIFRADOS, y
// el backend deja cada acceso en `auditoria_accesos`. Por eso vive en una
// función aparte con su propio nombre y por eso NINGUNA pantalla la llama
// al montar: la dispara un clic explícito.
//
// `purgarSolicitud` es ADMIN por el motivo SIMÉTRICO: borra esos mismos
// datos y no se deshace. Sus tres candados son del backend y acá no se
// aflojan: ADMIN, `?dry_run=true` por default y un `simulacion_id` que sale
// del dry_run. La pantalla suma el suyo -tipear PURGAR- porque el default
// protege de quien no leyó la firma y la credencial de quien la leyó, pero
// ninguno de los dos protege del clic de más.
//
// EL TOKEN EN CLARO SALE UNA SOLA VEZ, en la respuesta de `generarSolicitud`
// (y de `observarSolicitud` con `regenerar_link`). La base guarda su
// SHA-256 y ningún otro endpoint lo devuelve: si se pierde, hay que generar
// uno nuevo -y eso revoca el anterior, que es el punto-.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = `${API_URL}/api/v1/crm`;

const headersJson = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

const leer = async (res) => {
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// Espejo de app/models/crm/solicitud_emision.py::ESTADOS_SOLICITUD, en el
// orden en que se miran: lo que espera revisión primero, lo muerto al final.
export const ESTADOS_SOLICITUD = [
  'PENDIENTE_REVISION',
  'OBSERVADA',
  'GENERADA',
  'ABIERTA',
  'APROBADA',
  'VENCIDA',
  'REVOCADA',
];

export const ESTADO_LABEL = {
  GENERADA: 'Generada',
  ABIERTA: 'Abierta por el cliente',
  PENDIENTE_REVISION: 'Pendiente de revisión',
  APROBADA: 'Aprobada',
  OBSERVADA: 'Observada',
  VENCIDA: 'Vencida',
  REVOCADA: 'Revocada',
};

export const ESTADO_BADGE = {
  GENERADA: 'bg-slate-600/40 text-slate-200 border-slate-500/50',
  ABIERTA: 'bg-blue-500/15 text-blue-200 border-blue-500/40',
  PENDIENTE_REVISION: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  APROBADA: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  OBSERVADA: 'bg-orange-500/15 text-orange-200 border-orange-500/40',
  VENCIDA: 'bg-slate-700/60 text-slate-400 border-slate-600',
  REVOCADA: 'bg-red-500/15 text-red-200 border-red-500/40',
};

// Desde dónde se aprueba u observa (ESTADOS_REVISABLES del backend). Un
// botón ofrecido fuera de estos dos estados es un 409 asegurado.
export const ESTADOS_REVISABLES = ['PENDIENTE_REVISION', 'OBSERVADA'];

// Los estados en los que el link todavía puede usarse. Con la solicitud en
// uno de éstos, generar otra INVALIDA la anterior y hay que avisarlo antes.
export const ESTADOS_LINK_VIVO = ['GENERADA', 'ABIERTA'];

// Track de la oportunidad habilitado para pedir datos de emisión
// (emision_formulario.TRACKS_HABILITADOS). MOTO todavía no existe en
// TRACKS_VALIDOS del backend: está declarado para el día que se cree.
export const TRACKS_HABILITADOS = ['AUTO', 'MOTO'];
export const ESTADOS_CRM_HABILITADOS = ['POTENCIAL', 'CLIENTE'];

export const puedePedirDatos = (oportunidad) => {
  const track = String(oportunidad?.track || '').trim().toUpperCase();
  const estado = String(oportunidad?.estado_crm || '').trim().toUpperCase();
  return TRACKS_HABILITADOS.includes(track) && ESTADOS_CRM_HABILITADOS.includes(estado);
};

// El PNG viene en base64 en la respuesta del POST, no por un endpoint
// aparte: por eso acá alcanza con el data: URI y no hace falta el blob
// autenticado que sí necesita el QR de los puntos de contacto.
export const qrDataUri = (base64) => (base64 ? `data:image/png;base64,${base64}` : null);

export const generarSolicitud = async (token, oportunidadId, cuerpo = {}) => {
  const res = await fetch(`${BASE}/oportunidades/${oportunidadId}/solicitud-emision`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify(cuerpo),
  });
  return leer(res);
};

export const listarSolicitudes = async (token, { estado, oportunidad_id, limit, offset } = {}) => {
  const qs = new URLSearchParams();
  if (estado) qs.set('estado', estado);
  if (oportunidad_id) qs.set('oportunidad_id', oportunidad_id);
  if (limit) qs.set('limit', String(limit));
  if (offset) qs.set('offset', String(offset));
  const sufijo = qs.toString() ? `?${qs.toString()}` : '';
  const res = await fetch(`${BASE}/solicitudes-emision${sufijo}`, { headers: authHeader(token) });
  const data = await leer(res);
  return Array.isArray(data) ? data : (data?.items || []);
};

// ADMIN. Devuelve los datos DESCIFRADOS y el backend audita el acceso.
// No se llama nunca al montar una pantalla.
export const verSolicitud = async (token, solicitudId) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}`, {
    headers: authHeader(token),
  });
  return leer(res);
};

export const revocarSolicitud = async (token, solicitudId, motivo) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/revocar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ motivo: motivo || null }),
  });
  return leer(res);
};

export const aprobarSolicitud = async (token, solicitudId, nota) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/aprobar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ nota: nota || null }),
  });
  return leer(res);
};

export const observarSolicitud = async (token, solicitudId, { motivo, regenerar_link = false }) => {
  const res = await fetch(`${BASE}/solicitudes-emision/${solicitudId}/observar`, {
    method: 'POST',
    headers: headersJson(token),
    body: JSON.stringify({ motivo, regenerar_link }),
  });
  return leer(res);
};

// La descarga de un adjunto de la solicitud es la MISMA de crm_adjuntos:
// stream autenticado, nunca un <a href> ni una URL compartible (son datos
// personales, Ley 25.326).
//
// EL 409 NO ES UN ERROR DE RED: el adjunto existe y su binario todavía está
// viajando a Drive en background (S9). Se traduce a un texto propio para
// que la pantalla no muestre "Error 409" sobre algo que se arregla solo.
export const SUBIENDO = 'El archivo todavía se está subiendo. Probá de nuevo en unos segundos.';

export const descargarAdjuntoSolicitud = async (token, adjunto) => {
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos/${adjunto.id}/descargar`, {
    headers: authHeader(token),
  });
  if (res.status === 409) throw new Error(SUBIENDO);
  if (res.status === 410) throw new Error('El adjunto fue anulado.');
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.blob();
};

export const bajarBlob = (blob, nombre) => {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre || 'adjunto';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
};

// EL LISTADO YA TRAE LA REFERENCIA Y EL NOMBRE (C-6g). Hasta el backend
// C-6h, `SolicitudOut` no los declaraba y esta pantalla pedía la ficha de
// la oportunidad UNA VEZ POR FILA para poder escribir de quién era cada
// solicitud: N pedidos para pintar una tabla, y cada uno un GET más sobre
// la oportunidad. Ahora vienen en la misma respuesta -`oportunidad_referencia`
// y `cliente_nombre`, y nada más: ni documento, ni teléfono, ni email-, así
// que esos N pedidos NO EXISTEN MÁS y no hay que reponerlos.
//
// El fallback es el id de la oportunidad, no un pedido de reserva: si el
// backend no mandó la referencia, mostrar el id deja encontrar la fila igual.
export const referenciaDe = (s) => s?.oportunidad_referencia || s?.oportunidad_id || '';
export const clienteDe = (s) => s?.cliente_nombre || null;

// ---------------------------------------------------------------------------
// Subida a Drive (C-6h punto 3)
// ---------------------------------------------------------------------------
// `en_drive=false` QUERÍA DECIR TRES COSAS A LA VEZ hasta C-6h: "no se
// despachó", "está viajando" y "falló y no va a llegar nunca". Por eso el
// detalle decía "todavía subiendo" sobre un archivo muerto. La columna
// `subida_estado` es la que decide; `en_drive` queda sólo para saber si hay
// binario que descargar.
export const SUBIDA_PENDIENTE = 'PENDIENTE';
export const SUBIDA_EN_CURSO = 'EN_CURSO';
export const SUBIDA_OK = 'OK';
export const SUBIDA_FALLIDA = 'FALLIDA';
export const ESTADOS_SUBIDA_EN_VUELO = [SUBIDA_PENDIENTE, SUBIDA_EN_CURSO];

export const estaEnVuelo = (a) => ESTADOS_SUBIDA_EN_VUELO.includes(a?.subida_estado);
export const fallo = (a) => a?.subida_estado === SUBIDA_FALLIDA;

// El texto NO es decorativo: la salida depende del estado. En vuelo se
// espera; FALLIDA no llega sola y hay que volver a pedir el archivo con
// "Observar" + link nuevo, que es lo que el backend contesta en su 409.
export const SUBIDA_TEXTO = {
  [SUBIDA_PENDIENTE]: 'Todavía subiendo. Actualizá en unos segundos.',
  [SUBIDA_EN_CURSO]: 'Todavía subiendo. Actualizá en unos segundos.',
  [SUBIDA_FALLIDA]: 'La subida falló: no va a llegar sola. Observá la solicitud y pedí el archivo de nuevo.',
};

// Lo que bloquea "Aprobar". El backend contesta 409 igual -esto no lo
// reemplaza-, pero ofrecer un botón que se sabe que va a rebotar es hacerle
// perder el viaje a quien revisa.
export const adjuntosQueBloquean = (adjuntos = []) =>
  adjuntos.filter((a) => !a?.purgado_en && (estaEnVuelo(a) || fallo(a)));

// Desde el listado, sin haber abierto los datos: el backend ya cuenta.
export const bloqueadaPorSubidas = (s) =>
  (s?.archivos_en_vuelo || 0) > 0 || (s?.archivos_fallidos || 0) > 0;

// ---------------------------------------------------------------------------
// Purga (C-6h) — ADMIN, irreversible
// ---------------------------------------------------------------------------
// DOS LLAMADAS Y NO UNA, y la segunda no existe sin la primera: el dry_run
// devuelve el plan y un `simulacion_id` que vale 10 minutos, una sola vez y
// atado a la HUELLA de lo que se mostró. Si entre una cosa y la otra llegó
// otro archivo, el backend rebota con 409 y hay que volver a mirar - que es
// el punto de la credencial: no que alguien haya mirado algo, sino ESTO.
export const ESTADO_PURGADA = 'PURGADA';

export const MOTIVOS_PURGA = [
  { valor: 'PRUEBA', titulo: 'Prueba: los datos no son de un cliente real' },
  { valor: 'SUPRESION_TITULAR', titulo: 'Supresión pedida por el titular (Ley 25.326 art. 16)' },
  { valor: 'OTRO', titulo: 'Otro (hay que decir de dónde salió el pedido)' },
];

export const MOTIVO_OTRO = 'OTRO';

// La palabra que hay que tipear para habilitar la corrida firme.
export const PALABRA_CONFIRMACION = 'PURGAR';

export const purgarSolicitud = async (token, solicitudId, { motivo, detalle, simulacion_id, dry_run }) => {
  const res = await fetch(
    `${BASE}/solicitudes-emision/${solicitudId}/purgar?dry_run=${dry_run ? 'true' : 'false'}`,
    {
      method: 'POST',
      headers: headersJson(token),
      // `dry_run` va en la QUERY STRING y NUNCA en el cuerpo: el backend
      // tiene un validador que rebota con 422 el que llegue ahí.
      body: JSON.stringify({
        motivo,
        detalle: detalle || null,
        simulacion_id: simulacion_id || null,
      }),
    },
  );
  return leer(res);
};

// ---------------------------------------------------------------------------
// Baja de la oportunidad (C-6i punto 3)
// ---------------------------------------------------------------------------
// El DELETE existente: asienta SIN_EFECTO y manda la oportunidad a LOOP. No
// borra un solo dato personal, así que NO reemplaza a la purga - por eso la
// ficha avisa antes cuando hay una solicitud con datos cargados.
export const eliminarOportunidad = async (token, oportunidadId) => {
  const res = await fetch(`${API_URL}/api/v1/crm/oportunidades/${oportunidadId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  return leer(res);
};

// Los estados en los que la solicitud TODAVÍA tiene datos personales
// guardados. `PURGADA` ya no; una que nunca se envió tampoco.
export const tieneDatosVivos = (s) =>
  !!s?.enviada_en && s?.estado !== ESTADO_PURGADA && !s?.purgada_en;
