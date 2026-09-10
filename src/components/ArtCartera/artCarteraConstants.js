import { numeroSeguro } from '../../utils/api';

// Dominio del módulo "Cartera ART" (Bloque 5) - ver
// app/models/crm/empresa_art_estado.py del backend, fuente de verdad de
// estos valores. NO reordenar ASEGURADORAS_ART: es el orden fijo de columna
// de la matriz empresa × 19 aseguradoras en toda la UI.
//
// omint: en 2025 Omint ART pasó a operar bajo el nombre comercial "Serena"
// tras su compra por Grupo Lapachos (cambio de denominación aprobado por
// SSN, misma persona jurídica) - el backend normaliza "Serena" como alias
// de "omint" (no es una ART nueva/independiente), y el label acá lleva
// "(SERENA)" para que el operador reconozca el nombre que informa la SRT.
//
// reconquista / parana: ART reales e independientes agregadas en sync con
// el backend (PR #67), verificadas contra UART/SSN - Reconquista ART
// (CUIT 30-63278185-3) y Paraná ART (CUIT 30-71856742-0).
//
// victoria / latitud_sur / iapser / horizonte: ART reales e independientes
// agregadas en sync con el backend (auditoría setiembre 2026, ver
// app/services/aseguradoras.py del backend), verificadas contra UART/SSN -
// Compañía Argentina de Seguros Victoria S.A. (CUIT 30-50003226-6),
// Compañía Argentina de Seguros Latitud Sur S.A. (CUIT 30-50006638-1),
// Instituto Autárquico Provincial del Seguro de Entre Ríos (CUIT
// 30-50005550-9 - label "IAPSER (Entre Ríos)" para que el operador lo
// distinga de otros institutos autárquicos provinciales) y Horizonte
// Compañía Argentina de Seguros Generales S.A. (CUIT 30-50005208-9).
export const ASEGURADORAS_ART = [
  { id: 'plus', label: 'Plus' },
  { id: 'asociart', label: 'Asociart' },
  { id: 'provincia', label: 'Provincia' },
  { id: 'smg', label: 'SMG' },
  { id: 'galeno', label: 'Galeno' },
  { id: 'omint', label: 'OMINT ART (SERENA)' },
  { id: 'experta', label: 'Experta' },
  { id: 'la_holando', label: 'La Holando' },
  { id: 'prevencion', label: 'Prevención' },
  { id: 'federacion_patronal', label: 'Federación Patronal' },
  { id: 'la_segunda', label: 'La Segunda' },
  { id: 'berkley', label: 'Berkley' },
  { id: 'andina', label: 'Andina' },
  { id: 'reconquista', label: 'Reconquista' },
  { id: 'parana', label: 'Paraná ART' },
  { id: 'victoria', label: 'Victoria' },
  { id: 'latitud_sur', label: 'Latitud Sur' },
  { id: 'iapser', label: 'IAPSER (Entre Ríos)' },
  { id: 'horizonte', label: 'Horizonte' },
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

// Confianza del dato de dotación (Empresa.dotacion_confianza -
// DOTACION_CONFIANZAS_VALIDAS en app/models/crm/empresa.py del backend):
// ALTA (declarada por el cliente) / MEDIA (padrón ARCA) / BAJA (planilla
// histórica o rango MiPyME) / NULA (sin dato, no calificaría prioridad P2).
const DOTACION_CONFIANZA_META = {
  ALTA: { label: 'Alta', badge: 'bg-green-500/20 text-green-300' },
  MEDIA: { label: 'Media', badge: 'bg-blue-500/20 text-blue-300' },
  BAJA: { label: 'Baja', badge: 'bg-slate-500/20 text-slate-400' },
  NULA: { label: 'Nula', badge: 'bg-red-500/20 text-red-300' },
};

export const dotacionConfianzaInfo = (confianza) =>
  DOTACION_CONFIANZA_META[confianza] || { label: confianza || 'Sin dato', badge: 'bg-slate-500/20 text-slate-400' };

// Formatters compartidos por el tablero de gestión (Bloque 6b: Embudo,
// Análisis, Mercado - GET /art/embudo, /art/analisis, /art/mercado). Los
// tres endpoints están tipados con Pydantic (a diferencia de /srt/estado),
// pero eso no los hace "seguros de renderizar tal cual": campo Decimal ->
// FastAPI lo serializa como STRING (nunca number) para no perder precisión
// (ver alicuota/tarifa_pct_historica ya consumidos en ArtEmpresaFicha:
// siempre pasan por Number(valor) antes de tocarlos), y ni null/undefined
// ni un 500 real deberían tirar React error #31 (ver
// CarteraArtPanel.test.jsx, el mismo bug que ya mordió en Bloque 4).
//
// numeroAr: para campos int del schema (conteos, dotación, empresas) -
// numeroSeguro() SÍ aplica acá (cualquier cosa que no sea un number válido
// se trata como sin dato).
export const numeroAr = (valor, opciones) => {
  const numero = numeroSeguro(valor);
  return numero === null ? null : numero.toLocaleString('es-AR', opciones);
};

// decimalAr: para campos Decimal del schema (alícuotas, comisión, LRTM,
// tarifa, shares) - llegan como string o null, nunca como number crudo.
export const decimalAr = (valor, opciones = { maximumFractionDigits: 2 }) => {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero.toLocaleString('es-AR', opciones) : null;
};

// Confianza de la MASA SALARIAL de la grilla de cotización (BLOQUE 1.2 -
// app/services/masa_salarial.py del backend). Distinta de
// dotacionConfianzaInfo de arriba, que califica sólo la dotación: ésta
// califica la masa completa, que es el factor del que cuelgan todos los
// importes de la grilla.
//
// CONFIRMADA es la única que NO es una estimación: significa que la
// empresa presentó su F.931 (declaración jurada ante ARCA). Por eso es la
// única en verde y con un ícono propio - la diferencia entre un número
// declarado y uno estimado tiene que verse de un vistazo, no leerse en
// letra chica.
//
// LOS LABELS DICEN "MASA" ADELANTE. Al lado de este badge ahora hay otro,
// el de la alícuota (`confianzaAlicuotaInfo`), y un "Confirmada (F.931)"
// suelto entre los dos se lee como si TODA la fila estuviera confirmada -
// cuando lo único confirmado es la masa. El F.931 no dice nada sobre de
// dónde salió la alícuota: se puede tener la masa declarada por ARCA y una
// alícuota que es una mediana de mercado.
const CONFIANZA_MASA_META = {
  CONFIRMADA: { label: 'Masa confirmada (F.931)', badge: 'bg-green-500/20 text-green-300' },
  ALTA: { label: 'Masa estimada · confianza alta', badge: 'bg-blue-500/20 text-blue-300' },
  MEDIA: { label: 'Masa estimada · confianza media', badge: 'bg-yellow-500/20 text-yellow-300' },
  BAJA: { label: 'Masa estimada · confianza baja', badge: 'bg-orange-500/20 text-orange-300' },
};

export const confianzaMasaInfo = (confianza) =>
  CONFIANZA_MASA_META[confianza] || { label: confianza || 'Sin dato', badge: 'bg-slate-500/20 text-slate-400' };

// Origen de la alícuota de referencia de una fila de la grilla (la cascada
// propia vigente > propia caducada > benchmark de mercado). La leyenda
// tiene que estar SIEMPRE al lado del número: una alícuota que nos pasó la
// aseguradora para esta empresa y una mediana de mercado se cotizan muy
// distinto, y sin la etiqueta se ven igual.
//
// SE MUESTRA COMO BADGE, y con un estilo DISTINTO del de la masa: los de
// masa son pastilla llena (`bg-*/20`), éstos son contorno. Son dos ejes
// independientes - qué tan firme es el número de la masa y qué tan firme
// es el de la alícuota - y con la misma forma se leían como una sola
// escala de "confianza de la fila", que no existe. La diferencia se tiene
// que ver antes de leer el texto.
const CONFIANZA_ALICUOTA_META = {
  PROPIA_VIGENTE: {
    label: 'Cotizada',
    badge: 'border border-green-500/50 text-green-300',
    ayuda: 'Alícuota que la aseguradora pasó para esta empresa y sigue vigente',
  },
  PROPIA_CADUCADA: {
    label: 'Cotizada (vencida)',
    badge: 'border border-amber-500/50 text-amber-300',
    ayuda: 'Última alícuota pasada para esta empresa, ya caducada',
  },
  BENCHMARK: {
    label: 'Referencia de mercado',
    badge: 'border border-slate-500 text-slate-300',
    ayuda: 'Mediana de lo que esta aseguradora cotiza en empresas similares',
  },
  // El origen que guarda la PROPUESTA cuando la alícuota es un precio que
  // la aseguradora efectivamente pasó (ORIGENES_ALICUOTA_PROPUESTA). Vive
  // en el mismo mapa que los de la grilla para que "cotizada" se vea igual
  // en las dos pantallas: son la misma afirmación.
  COTIZACION_REAL: {
    label: 'Cotización real',
    badge: 'border border-green-500/50 text-green-300',
    ayuda: 'La aseguradora pasó este precio para esta empresa',
  },
};

export const confianzaAlicuotaInfo = (origen) =>
  CONFIANZA_ALICUOTA_META[origen]
  || { label: origen || 'Sin dato', badge: 'border border-slate-600 text-slate-400', ayuda: '' };

// Alias histórico: mismo dato, sin el badge. Se mantiene porque el CSV de
// la grilla sólo necesita la etiqueta.
export const origenAlicuotaInfo = confianzaAlicuotaInfo;

// Importe en pesos. Devuelve null (no "$ 0") cuando el backend mandó null:
// sin masa salarial estimada los importes de la grilla NO se calculan, y
// mostrar un 0 ahí sería afirmar que no hay ahorro cuando lo que pasa es
// que no se sabe.
export const pesosAr = (valor) => {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return `$ ${numero.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
};

// Porcentaje de variación (delta_vs_actual llega como fracción: -0.42 =
// 42% más barata). Se muestra con signo explícito para que "más barata" y
// "más cara" no dependan de leer el color.
export const variacionPct = (valor) => {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  const pct = numero * 100;
  return `${pct > 0 ? '+' : ''}${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
};

// Estado EFECTIVO de una propuesta ART (BLOQUE 1.3). Son los cuatro
// guardados más VENCIDA, que el backend calcula al leer (`valida_hasta <
// hoy` con la propuesta todavía en BORRADOR o ENTREGADA) y no existe como
// valor de la columna - ver app/models/crm/propuesta_art.py.
//
// Por eso el frontend muestra SIEMPRE `estado_efectivo` y nunca `estado` a
// secas: una propuesta vencida que se viera como "ENTREGADA" mandaría a
// alguien a llamar prometiendo un precio que ya no está vigente.
const ESTADO_PROPUESTA_META = {
  BORRADOR: { label: 'Borrador', badge: 'bg-slate-500/20 text-slate-300' },
  ENTREGADA: { label: 'Entregada', badge: 'bg-blue-500/20 text-blue-300' },
  ACEPTADA: { label: 'Aceptada', badge: 'bg-green-500/20 text-green-300' },
  RECHAZADA: { label: 'Rechazada', badge: 'bg-red-500/20 text-red-300' },
  VENCIDA: { label: 'Vencida', badge: 'bg-amber-500/20 text-amber-300' },
  // ANULADA no es RECHAZADA: rechazar es la respuesta del CLIENTE (y es la
  // métrica de si el precio sirve), anular es "esta propuesta no debió
  // existir". Por eso el color no es el rojo del rechazo - ver
  // ESTADO_ANULADA en app/models/crm/propuesta_art.py del backend.
  ANULADA: { label: 'Anulada', badge: 'bg-slate-600/40 text-slate-300 line-through' },
};

export const estadoPropuestaInfo = (estado) =>
  ESTADO_PROPUESTA_META[estado] || { label: estado || 'Sin dato', badge: 'bg-slate-500/20 text-slate-400' };

// Origen de la alícuota con la que se arma una propuesta. La distinción no
// es cosmética: al entregar, sólo una COTIZACION_REAL se asienta como
// alícuota propia de la empresa en el backend. Marcar como "cotización
// real" un número que en realidad es la mediana de mercado contamina el
// benchmark del mes siguiente con nuestro propio número.
//
// El `label` sale de CONFIANZA_ALICUOTA_META para que el radio del
// formulario y el badge de la propuesta digan LA MISMA palabra; la `ayuda`
// es propia porque acá describe el efecto de ELEGIRLO (qué se asienta al
// entregar), no de dónde salió el número.
export const ORIGENES_ALICUOTA_PROPUESTA = [
  {
    id: 'BENCHMARK',
    label: CONFIANZA_ALICUOTA_META.BENCHMARK.label,
    ayuda: 'La alícuota sale de la mediana de lo que esta aseguradora cotiza en empresas similares. No se asienta como cotización de la empresa.',
  },
  {
    id: 'COTIZACION_REAL',
    label: CONFIANZA_ALICUOTA_META.COTIZACION_REAL.label,
    ayuda: 'La aseguradora pasó este precio para esta empresa. Al entregar la propuesta queda asentado como su alícuota.',
  },
];

// Días restantes de validez -> cómo se muestra. El backend manda el número
// con signo (negativo = venció hace tantos días), así que "vence hoy" y
// "venció la semana pasada" no se ven igual.
export const diasRestantesTexto = (dias) => {
  if (dias === null || dias === undefined || !Number.isFinite(Number(dias))) return null;
  const numero = Number(dias);
  if (numero < 0) return `venció hace ${Math.abs(numero)} día${Math.abs(numero) === 1 ? '' : 's'}`;
  if (numero === 0) return 'vence hoy';
  return `${numero} día${numero === 1 ? '' : 's'} restantes`;
};
