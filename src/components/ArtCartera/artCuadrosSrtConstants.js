// Textos de la carga versionada de los Cuadros SRT (backend PR #221).
// Ningún número se calcula acá: sólo formato.
import { decimalAr } from './artCarteraConstants';
import { fechaCorta } from '../../utils/fechas';

export const RELACION_CUADROS_LABEL = {
  PRIMERA: 'primera carga',
  NUEVA: 'más nueva que la vigente',
  MISMA: 'misma versión (corrige la vigente)',
  ANTERIOR: 'más vieja que la vigente',
};

export const relacionCuadrosLabel = (r) => RELACION_CUADROS_LABEL[r] || r || '—';

// "+20" / "-1,5": el signo explícito dice para qué lado se movió.
export const signado = (valor) => {
  const texto = decimalAr(valor);
  if (texto === null) return '—';
  return Number(valor) > 0 ? `+${texto}` : texto;
};

// Códigos únicos del diff, en el orden en que aparecen en pantalla.
export const codigosDelDiff = (diff) => {
  if (!diff) return [];
  const codigos = [
    ...(diff.ciiu_nuevos?.ciiu || []),
    ...(diff.ciiu_desaparecen?.ciiu || []),
    ...(diff.salario_cambia?.items || []).map((it) => it.ciiu),
    ...(diff.alicuota_tramo_cambia?.items || []).map((it) => it.ciiu),
  ].filter(Boolean).map(String);
  return [...new Set(codigos)];
};

export const fechaDdMmAaaa = (valor) => fechaCorta(valor, { day: '2-digit', month: '2-digit', year: 'numeric' });

// "Cuadros SRT: 2026-05/REV4 · cargado 25/09/2026". Sin versión, null.
export const textoVersionCuadros = (version, cargadoEn) => {
  if (!version) return null;
  const fecha = fechaDdMmAaaa(cargadoEn);
  return `Cuadros SRT: ${version}${fecha ? ` · cargado ${fecha}` : ''}`;
};
