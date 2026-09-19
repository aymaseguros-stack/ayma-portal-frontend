// Constantes compartidas de Oportunidades (CRM Fase 2), en espejo de las
// listas válidas en app/schemas/crm_v2.py del backend.

import { aFecha, hoyISO } from '../../utils/fechas';

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
  const fecha = aFecha(fechaISO);
  if (fecha === null) return null;
  const ms = Date.now() - fecha.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
};

// `fecha_cierre_estimada` es un campo `date`: se compara contra el día LOCAL.
// Con el UTC de `toISOString`, una oportunidad que cierra hoy aparecía vencida
// desde las 21:00 hora argentina.
export const estaVencida = (oportunidad) => {
  if (!oportunidad?.fecha_cierre_estimada) return false;
  return oportunidad.fecha_cierre_estimada < hoyISO();
};

// ---------------------------------------------------------------------------
// Pipeline dirigido por actos (backend PR #176)
// ---------------------------------------------------------------------------

// Los actos y el estado al que llevan. Espejo de `ACTO_A_ESTADO` en
// app/models/crm/estado_crm.py. Se muestra en la ficha para que quede a la
// vista POR QUÉ el estado se movió: el estado no se elige, se deriva de esto.
export const ACTOS_VALIDOS = ['CONTACTO', 'CALIFICACION', 'COTIZACION', 'EMISION'];

export const ACTO_A_ESTADO = {
  CONTACTO: 'DATO',
  CALIFICACION: 'PROSPECTO',
  COTIZACION: 'POTENCIAL',
  EMISION: 'CLIENTE',
};

export const ACTO_LABEL = {
  CONTACTO: 'Contacto',
  CALIFICACION: 'Calificación',
  COTIZACION: 'Cotización entregada',
  EMISION: 'Emisión',
};

// Las DOS únicas transiciones explícitas. Todo lo demás se deriva del acto.
export const ESTADOS_EXPLICITOS = ['LOOP', 'RECUPERABLE'];

// `MotivoBaja` del backend (app/models/cliente.py), que es lo que valida
// `TransicionRequest.motivo_baja`. NO se agrega ningún valor de más acá: un
// motivo que el backend no conoce es un 422 al confirmar.
//
// FALTA `NO_COLOCABLE` (el riesgo que ninguna compañía toma - una F100 del 76).
// Hoy no está en el enum del backend, así que no se ofrece: ver la nota de
// MOTIVO_NO_COLOCABLE_PENDIENTE más abajo.
export const MOTIVOS_BAJA_VALIDOS = [
  'PRECIO', 'SERVICIO', 'SINIESTRO', 'COMPANIA', 'VENTA_BIEN', 'MUDANZA',
  'SIN_CONTACTO', 'OTRO',
];

export const MOTIVO_BAJA_LABEL = {
  PRECIO: 'Precio',
  SERVICIO: 'Servicio',
  SINIESTRO: 'Siniestro',
  COMPANIA: 'Compañía',
  VENTA_BIEN: 'Vendió el bien',
  MUDANZA: 'Mudanza',
  SIN_CONTACTO: 'Sin contacto',
  OTRO: 'Otro',
};

// PENDIENTE DE BACKEND - no se fuerza desde acá.
//
// "No colocable" NO es una pérdida comercial: es que no tuvimos producto para
// el riesgo (una Ford F100 1976 que ninguna de nuestras compañías toma). Hoy
// se mezcla con PRECIO/OTRO y ensucia la tasa de cierre, que es justo lo que
// hay que poder separar.
//
// Mandarlo igual sería un 422: `TransicionRequest._motivo_valido` valida
// contra `MotivoBaja`, y además `crm_estado.aplicar_transicion` sólo persiste
// `motivo_baja` en RECUPERABLE (en LOOP lo ignora). Hacen falta las dos cosas
// del lado del backend: el valor en el enum y que LOOP lo guarde. Hasta
// entonces el motivo del LOOP viaja en la nota, que SÍ se guarda (como
// `interacciones.resumen`) pero no se puede agregar en un reporte.
export const MOTIVO_NO_COLOCABLE_PENDIENTE = 'NO_COLOCABLE';
