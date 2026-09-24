// Vocabulario del circuito de cotizaciones (OPERACIONES-0008). Los códigos
// son los del backend (app/services/art_tandas.py); acá sólo viven las
// etiquetas. Un código que no esté en estos mapas se muestra CRUDO, no se
// esconde: significa que el backend sumó un valor y la pantalla no lo sabe.
import { MOTIVOS_RECHAZO_ART } from './artCarteraConstants';

// Las cinco bandejas, en el orden del circuito (ETAPAS_BANDEJA).
export const ETAPAS_BANDEJA = [
  { id: 'PEDIDA', label: 'Pedidas' },
  { id: 'EN_TECNICA', label: 'En técnica' },
  { id: 'RECIBIDA', label: 'Recibidas' },
  { id: 'ENTREGADA', label: 'Entregadas' },
  { id: 'CERRADA', label: 'Cerradas' },
];

// Las bandejas donde la compañía todavía no contestó: ahí se carga la
// respuesta.
export const ETAPAS_CON_RESPUESTA_PENDIENTE = ['PEDIDA', 'EN_TECNICA'];

export const CANALES_TANDA = [
  { id: 'SILICON_BROKERS', label: 'Silicon Brokers' },
  { id: 'CODIGO_PROPIO', label: 'Código propio' },
];

export const canalLabel = (id) => CANALES_TANDA.find((c) => c.id === id)?.label
  || (typeof id === 'string' && id ? id : '—');

// Filtro `respuesta` de la bandeja Recibidas (RESPUESTAS_BANDEJA).
export const RESPUESTAS_FILTRO = [
  { id: 'ALICUOTA', label: 'Tarifa' },
  { id: 'RECHAZADA', label: 'Rechazada' },
  { id: 'BLOQUEADA', label: 'Bloqueada' },
];

export const TIPO_RESPUESTA = {
  ALICUOTA: { label: 'Tarifa', clase: 'bg-green-500/20 text-green-300' },
  TECNICA: { label: 'Técnica', clase: 'bg-purple-500/20 text-purple-300' },
  RECHAZADA: { label: 'Rechazada', clase: 'bg-red-500/20 text-red-300' },
  BLOQUEADA: { label: 'Bloqueada', clase: 'bg-orange-500/20 text-orange-300' },
};

// Estado derivado de un par (PedidoParItem.estado). SIN_RESPUESTA es el que
// marca el SLA vencido: lo decide el backend contra el SLA del canal.
export const ESTADO_PAR = {
  PEDIDA: { label: 'Pedida', clase: 'bg-blue-500/20 text-blue-300' },
  SIN_RESPUESTA: { label: 'Sin respuesta (SLA vencido)', clase: 'bg-red-500/20 text-red-300' },
  RECIBIDA: { label: 'Recibida', clase: 'bg-green-500/20 text-green-300' },
  PRESENTADA: { label: 'Presentada', clase: 'bg-cyan-500/20 text-cyan-300' },
  ACEPTADA: { label: 'Aceptada', clase: 'bg-emerald-500/30 text-emerald-200' },
  RECHAZADA_CLIENTE: { label: 'Rechazada por el cliente', clase: 'bg-slate-500/30 text-slate-300' },
};

export const slaVencido = (par) => par?.estado === 'SIN_RESPUESTA';

// Los cuatro tipos de respuesta que se cargan a mano.
export const TIPOS_CARGA_RESPUESTA = [
  { id: 'ALICUOTA', label: 'Tarifa (alícuota)' },
  { id: 'TECNICA', label: 'Pasó a técnica' },
  { id: 'RECHAZADA', label: 'Rechazada' },
  { id: 'BLOQUEADA', label: 'Bloqueada por otro productor' },
];

export { MOTIVOS_RECHAZO_ART };

// "8,5" y "8.5" son la misma alícuota: el operador tipea con coma.
const aNumero = (texto) => {
  const limpio = String(texto ?? '').trim().replace(',', '.');
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : NaN;
};

// Arma el body de POST /art/cotizaciones/respuesta desde el formulario.
// Devuelve `{body, error}`: con error no se llama al backend. Sólo viajan
// los campos que corresponden al tipo -un `motivo` en una ALICUOTA sería
// un dato que el backend descarta y el operador cree cargado-.
export const armarBodyRespuesta = ({ empresa_id, aseguradora }, form) => {
  const body = { empresa_id, aseguradora, respuesta: form.tipo };
  if (form.tipo === 'ALICUOTA') {
    const alicuota = aNumero(form.alicuota);
    if (alicuota === null || Number.isNaN(alicuota) || alicuota <= 0) {
      return { body: null, error: 'Cargá la alícuota (por ejemplo 8,5).' };
    }
    body.alicuota_pct = alicuota;
  } else if (form.tipo === 'TECNICA') {
    const dias = aNumero(form.dias_sla);
    if (Number.isNaN(dias) || (dias !== null && (dias <= 0 || !Number.isInteger(dias)))) {
      return { body: null, error: 'Los días de SLA tienen que ser un número entero.' };
    }
    if (dias !== null) body.dias_sla = dias;
  } else if (form.tipo === 'RECHAZADA') {
    if (!form.motivo) return { body: null, error: 'Elegí el motivo del rechazo.' };
    body.motivo = form.motivo;
  } else if (form.tipo === 'BLOQUEADA') {
    const productor = (form.productor_bloqueante || '').trim();
    if (!productor) return { body: null, error: 'Cargá el productor que tiene el bloqueo.' };
    body.productor_bloqueante = productor;
  } else {
    return { body: null, error: 'Elegí el tipo de respuesta.' };
  }
  if (form.fecha_respuesta) body.fecha_respuesta = form.fecha_respuesta;
  const nota = (form.nota || '').trim();
  if (nota) body.nota = nota;
  return { body, error: null };
};

// Arma el body de POST /art/tandas desde la selección. Por empresa:
//   - todas las aseguradoras propuestas tildadas -> el id pelado (el
//     backend le pide a todas las del canal menos las impedidas);
//   - un subconjunto -> `{empresa_id, aseguradoras}` (override);
//   - ninguna -> la empresa no viaja.
// `seleccion` es {empresa_id: {incluida, aseguradoras: Set|Array}} y
// `propuesta` son los items de GET /art/tandas/propuesta, en su orden.
export const armarBodyTanda = ({ canal, propuesta, seleccion, nota }) => {
  const empresa_ids = [];
  (propuesta || []).forEach((item) => {
    const sel = seleccion?.[item.empresa_id];
    if (!sel?.incluida) return;
    const tildadas = new Set(sel.aseguradoras || []);
    const propuestas = item.aseguradoras || [];
    const elegidas = propuestas.filter((a) => tildadas.has(a));
    if (elegidas.length === 0) return;
    if (elegidas.length === propuestas.length) {
      empresa_ids.push(item.empresa_id);
    } else {
      empresa_ids.push({ empresa_id: item.empresa_id, aseguradoras: elegidas });
    }
  });
  const body = { canal, empresa_ids };
  const n = (nota || '').trim();
  if (n) body.nota = n;
  return body;
};
