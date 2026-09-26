import { fechaCorta } from '../../utils/fechas';

// OPERACIONES-0011 · ART-111: estado de la empresa en ARCA. El catálogo es
// del backend (app/models/crm/estado_arca_catalogo.py); acá sólo se rotula.
// Colores: rojo = excluyente (sale de /lista, va a /relevamiento con motivo
// ESTADO_ARCA), ámbar = INCUMPLIMIENTOS (sigue en la lista con alerta),
// gris = DESCONOCIDO, ACTIVO no lleva chip.
export const ESTADOS_ARCA_EXCLUYENTES = ['LIMITADA', 'BAJA_OFICIO', 'SIN_IMPUESTOS', 'INACTIVA'];

export const ESTADO_ARCA_INFO = {
  INACTIVA: { label: 'Inactiva en ARCA', clase: 'bg-red-500/20 text-red-300' },
  LIMITADA: { label: 'CUIT limitada', clase: 'bg-red-500/20 text-red-300' },
  BAJA_OFICIO: { label: 'Baja de oficio', clase: 'bg-red-500/20 text-red-300' },
  SIN_IMPUESTOS: { label: 'Sin impuestos activos', clase: 'bg-red-500/20 text-red-300' },
  INCUMPLIMIENTOS: { label: 'Incumplimientos ARCA', clase: 'bg-amber-500/20 text-amber-300' },
  DESCONOCIDO: { label: 'Estado ARCA desconocido', clase: 'bg-slate-500/20 text-slate-400' },
  ACTIVO: { label: 'Activa en ARCA', clase: '' },
};

export const FUENTE_ESTADO_ARCA = {
  CONSTANCIA_ARCA_PUBLICA: 'Constancia pública ARCA',
  PADRON_A13: 'Padrón A13',
  PADRON_A5: 'Padrón A5',
  MANUAL: 'Carga manual',
};

// Motivos de GET /art/accion-comercial/relevamiento y de
// sin_comision_por_motivo del dashboard (MOTIVOS_RELEVAMIENTO del backend).
export const MOTIVO_RELEVAMIENTO_LABEL = {
  ESTADO_ARCA: 'Excluida: situación fiscal en ARCA',
  SIN_CIIU: 'Sin CIIU',
  NO_COTIZAR: 'Marcada no cotizar',
};

export const estadoArcaLabel = (estado) => ESTADO_ARCA_INFO[estado]?.label || estado;
export const fuenteEstadoArcaLabel = (fuente) => FUENTE_ESTADO_ARCA[fuente] || fuente;

export const tooltipEstadoArca = ({ fuente, fecha, nota } = {}) => [
  fuente ? `Fuente: ${fuenteEstadoArcaLabel(fuente)}` : null,
  fecha ? `Fecha: ${fechaCorta(fecha)}` : null,
  nota ? `Nota: ${nota}` : null,
].filter(Boolean).join('\n');

