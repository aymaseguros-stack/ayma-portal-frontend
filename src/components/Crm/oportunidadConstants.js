// Constantes compartidas de Oportunidades (CRM Fase 2), en espejo de las
// listas válidas en app/schemas/crm_v2.py del backend.

export const TRACKS_VALIDOS = [
  'AUTO', 'ART', 'FLOTA', 'INTEGRAL', 'HYS', 'RC', 'INCENDIO', 'TRO',
  'TRANSPORTE', 'ROBO', 'CREDITO', 'CAUCION', 'VIDA', 'HOGAR', 'AP',
  'CLIMATICO', 'SILOS', 'MAQUINARIA', 'TECNICO',
];

// Orden fijo de columnas del Kanban, tal como lo pide el pipeline comercial
// (independiente de qué estados devuelva el backend con datos).
export const ESTADOS_CRM_ORDEN = ['DATO', 'PROSPECTO', 'POTENCIAL', 'CLIENTE', 'LOOP', 'RECUPERABLE'];

export const ESTADO_CRM_LABEL = {
  DATO: 'Dato',
  PROSPECTO: 'Prospecto',
  POTENCIAL: 'Potencial',
  CLIENTE: 'Cliente',
  LOOP: 'Loop',
  RECUPERABLE: 'Recuperable',
};

export const ESTADO_CRM_BADGE = {
  DATO: 'bg-slate-500/20 text-slate-400',
  PROSPECTO: 'bg-sky-500/20 text-sky-400',
  POTENCIAL: 'bg-blue-500/20 text-blue-400',
  CLIENTE: 'bg-green-500/20 text-green-400',
  LOOP: 'bg-yellow-500/20 text-yellow-400',
  RECUPERABLE: 'bg-orange-500/20 text-orange-400',
};

export const ETAPAS_SAIDA_VALIDAS = ['SONDEO', 'ATENCION', 'INTERES', 'DESEO', 'ACCION'];

export const CANALES_VALIDOS = ['EMAIL', 'WHATSAPP', 'LLAMADA', 'REUNION', 'VISITA', 'PORTAL', 'OTRO'];

export const CANAL_ICON = {
  EMAIL: 'envelope',
  WHATSAPP: 'chat-bubble',
  LLAMADA: 'phone',
  REUNION: 'video-camera',
  VISITA: 'map-pin',
  PORTAL: 'globe-alt',
  OTRO: 'ellipsis-horizontal',
};

export const MOTIVOS_PERDIDA_VALIDOS = [
  'PRECIO', 'SERVICIO', 'SINIESTRO', 'COMPANIA', 'VENTA_BIEN', 'MUDANZA', 'SIN_CONTACTO', 'OTRO',
];

export const TIPOS_TAREA_VALIDOS = ['LLAMADA', 'EMAIL', 'REUNION', 'COTIZAR', 'VISITA', 'SEGUIMIENTO', 'RENOVACION'];

export const PRIORIDADES_VALIDAS = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'];

export const formatMoneda = (valor) => {
  if (valor === null || valor === undefined || valor === '') return '-';
  const numero = Number(valor);
  if (Number.isNaN(numero)) return valor;
  return numero.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
};

// "Hace N días" a partir de una fecha ISO; usado como proxy de "última
// interacción" en las tarjetas del Kanban (el pipeline no trae el detalle
// de interacciones por oportunidad, así que se aproxima con updated_at).
export const diasDesde = (fechaISO) => {
  if (!fechaISO) return null;
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return null;
  const ms = Date.now() - fecha.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

export const estaVencida = (oportunidad) => {
  if (!oportunidad?.fecha_cierre_estimada) return false;
  const hoy = new Date().toISOString().slice(0, 10);
  return oportunidad.fecha_cierre_estimada < hoy;
};
