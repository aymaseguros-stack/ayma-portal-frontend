// C-9g: los grupos de la Agenda. Una tarea cae en UNO solo, en este orden:
//
//   PROXIMA_ACCION  `origen === 'PROXIMA_ACCION'` (C-9d, la cadena de
//                   seguimiento de una oportunidad).
//   PROSPECCION_ART la generó el SISTEMA para ART. Se reconoce por el prefijo
//                   del título, que es lo único que esas tareas tienen en
//                   común (no traen `origen`). Los prefijos son los literales
//                   del backend, uno por generador:
//                     - `accion_comercial_art.PREFIJO_TITULO_TAREA` (pool de
//                       aniversarios, tipo COTIZAR);
//                     - `srt._crear_oportunidad_sin_cobertura` (verificación
//                       SRT sin ART vigente, tipo LLAMADA).
//                   Un generador nuevo = un prefijo nuevo ACÁ, y en ningún
//                   otro lado.
//   LIBRE           el resto: las cargadas a mano.
import { esTareaProximaAccion } from './proximaAccion';

export const PREFIJOS_PROSPECCION_ART = [
  'Cotizar ART — aniversario ',
  'Sin cobertura ART vigente - ',
];

export const GRUPOS_AGENDA = [
  { clave: 'PROXIMA_ACCION', label: 'Próximas acciones' },
  { clave: 'LIBRE', label: 'Libres' },
  { clave: 'PROSPECCION_ART', label: 'Prospección ART' },
];

export const TODOS_LOS_GRUPOS = GRUPOS_AGENDA.map((g) => g.clave);

// Default: lo que se trabaja a mano. La prospección ART (cientos de tareas
// vencidas) sale del default pero se ve con su chip.
export const GRUPOS_DEFAULT = ['PROXIMA_ACCION', 'LIBRE'];

export const esProspeccionArt = (tarea) => {
  const titulo = tarea?.titulo || '';
  return PREFIJOS_PROSPECCION_ART.some((prefijo) => titulo.startsWith(prefijo));
};

export const grupoDeTarea = (tarea) => {
  if (esTareaProximaAccion(tarea)) return 'PROXIMA_ACCION';
  if (esProspeccionArt(tarea)) return 'PROSPECCION_ART';
  return 'LIBRE';
};

// Cuántas tareas DISTINTAS hay por grupo en la respuesta de /tareas/agenda.
// Una tarea de hoy ya vencida viene en las dos listas: se cuenta una vez.
export const contarPorGrupo = (agenda) => {
  const vistas = new Map();
  const todas = [
    ...(agenda?.vencidas || []),
    ...Object.values(agenda?.dias || {}).flat(),
  ];
  for (const t of todas) vistas.set(t.id, t);
  const conteo = { PROXIMA_ACCION: 0, LIBRE: 0, PROSPECCION_ART: 0 };
  for (const t of vistas.values()) conteo[grupoDeTarea(t)] += 1;
  return { ...conteo, TODAS: vistas.size };
};

// La agenda con sólo los grupos elegidos. Los días que quedan vacíos se
// sacan: un encabezado "Mañana" sin tareas debajo parece un error.
export const filtrarAgenda = (agenda, grupos) => {
  const elegidos = new Set(grupos);
  const pasa = (t) => elegidos.has(grupoDeTarea(t));
  const dias = {};
  for (const [dia, tareas] of Object.entries(agenda?.dias || {})) {
    const quedan = tareas.filter(pasa);
    if (quedan.length) dias[dia] = quedan;
  }
  return { dias, vencidas: (agenda?.vencidas || []).filter(pasa) };
};

export const PREGUNTA_COMPLETAR = '¿Marcar como hecha?';
