// Dominio del módulo "Cartera ART" (Bloque 5) - ver
// app/models/crm/empresa_art_estado.py del backend, fuente de verdad de
// estos valores. NO reordenar ASEGURADORAS_ART: es el orden fijo de columna
// de la matriz empresa × 12 aseguradoras en toda la UI.
export const ASEGURADORAS_ART = [
  { id: 'plus', label: 'Plus' },
  { id: 'asociart', label: 'Asociart' },
  { id: 'provincia', label: 'Provincia' },
  { id: 'smg', label: 'SMG' },
  { id: 'galeno', label: 'Galeno' },
  { id: 'omint', label: 'Omint' },
  { id: 'experta', label: 'Experta' },
  { id: 'la_holando', label: 'La Holando' },
  { id: 'prevencion', label: 'Prevención' },
  { id: 'federacion_patronal', label: 'Federación Patronal' },
  { id: 'la_segunda', label: 'La Segunda' },
  { id: 'berkley', label: 'Berkley' },
];

// Nunca devuelve el `id` crudo si no es un string (ej. si el backend manda
// null o un objeto en vez del id esperado): eso terminaría renderizado tal
// cual en JSX y rompería con React error #31.
export const aseguradoraLabel = (id) => ASEGURADORAS_ART.find((a) => a.id === id)?.label
  || (typeof id === 'string' && id ? id : '—');

export const RIESGO_SUSCRIPCION_OPCIONES = ['NORMAL', 'MEDIO', 'ALTO', 'NO_COLOCABLE'];

// Estados de celda de la matriz. COTIZABLE es el estado EFECTIVO cuando un
// estado histórico (BLOQUEADA/RECHAZADA/ALICUOTA/...) ya caducó - nunca se
// pisa el histórico, la celda muestra ambos (ver AseguradoraEstadoItem:
// tipo_ultimo = histórico, estado_efectivo = vigente hoy).
export const ESTADOS_EFECTIVOS = ['COTIZABLE', 'ALICUOTA', 'ACTUAL', 'RECHAZADA', 'BLOQUEADA', 'TECNICA', 'SIN_CIIU'];

// Tipos válidos para POST /art/estado (no incluye COTIZABLE: ese es
// calculado, nunca se registra a mano).
export const TIPOS_ESTADO_ART = ['ALICUOTA', 'ACTUAL', 'RECHAZADA', 'BLOQUEADA', 'TECNICA', 'SIN_CIIU'];

export const MOTIVOS_RECHAZO_ART = ['CUPO_TOMADO', 'POLITICA_SUSCRIPCION', 'SINIESTRALIDAD', 'JUICIOS', 'SIN_DATO'];

// Umbral de competitividad (dato duro del negocio): alícuota promedio
// ganadora 5,96 · perdedora 8,02. Por encima de la perdedora, no competitiva.
export const ALICUOTA_PROMEDIO_GANADORA = 5.96;
export const ALICUOTA_PROMEDIO_PERDEDORA = 8.02;
export const esAlicuotaNoCompetitiva = (alicuota) =>
  alicuota !== null && alicuota !== undefined && Number(alicuota) > ALICUOTA_PROMEDIO_PERDEDORA;

const ESTADO_META = {
  COTIZABLE: { label: 'Cotizable', badge: 'bg-teal-500/20 text-teal-300' },
  ALICUOTA: { label: 'Alícuota', badge: 'bg-blue-500/20 text-blue-300' },
  ACTUAL: { label: 'Actual', badge: 'bg-green-500/20 text-green-300' },
  RECHAZADA: { label: 'Rechazada', badge: 'bg-red-500/20 text-red-300' },
  BLOQUEADA: { label: 'Bloqueada', badge: 'bg-orange-500/20 text-orange-300' },
  TECNICA: { label: 'Técnica', badge: 'bg-purple-500/20 text-purple-300' },
  SIN_CIIU: { label: 'Sin CIIU', badge: 'bg-slate-500/20 text-slate-400' },
};

export const estadoArtInfo = (estado) => ESTADO_META[estado] || { label: estado || 'Sin dato', badge: 'bg-slate-500/20 text-slate-400' };

const RIESGO_META = {
  NORMAL: 'bg-green-500/20 text-green-300',
  MEDIO: 'bg-yellow-500/20 text-yellow-300',
  ALTO: 'bg-orange-500/20 text-orange-300',
  NO_COLOCABLE: 'bg-red-500/20 text-red-300',
};

export const riesgoBadgeClass = (riesgo) => RIESGO_META[riesgo] || 'bg-slate-500/20 text-slate-400';
