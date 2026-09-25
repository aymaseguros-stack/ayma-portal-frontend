// Vocabulario de @VALENTINI (OPERACIONES-0010, backend PR #216). Los
// códigos son los de app/services/f931_ingesta.py y f931_parser.py; acá
// sólo se traducen a castellano. La decisión (APLICADO / PROPUESTO /
// SUPERADO, qué motivo falló) la toma SIEMPRE el backend.
import { textoDetail } from './artF931Api';

export const MOTIVO_F931_LABEL = {
  CUIT_DISTINTO: 'El CUIT del PDF no es el de la empresa',
  EMPRESA_SIN_CUIT: 'La empresa no tiene CUIT cargado',
  PERIODO_VENCIDO: 'Período de más de 6 meses',
  PERIODO_FUTURO: 'Período futuro',
  SIN_EMPLEADOS: 'No declara empleados',
  SIN_SALARIO_CIIU: 'Sin salario promedio del CIIU (Cuadro 1)',
  SALARIO_FUERA_DE_RANGO: 'Salario fuera de 0,3–3 × el del CIIU',
  SUPERADO: 'Hay un F.931 aplicado de un período posterior',
  RECTIFICATIVA: 'Rectificativa de un período ya cargado',
};

export const motivoF931Label = (codigo) => MOTIVO_F931_LABEL[codigo] || codigo;

// Motivos que el backend NO deja aceptar desde la bandeja
// (MOTIVOS_NO_ACEPTABLES + SUPERADO en f931_ingesta.aceptar). Sólo sirve
// para no OFRECER el botón: si igual se llega a un 409, manda el backend.
export const MOTIVOS_F931_NO_ACEPTABLES = ['CUIT_DISTINTO', 'EMPRESA_SIN_CUIT', 'SIN_EMPLEADOS', 'SUPERADO'];

// `motivo_validacion` de la fila es el texto unido con " · " (SEPARADOR_MOTIVOS).
export const motivosDeFila = (fila) => (fila?.motivo_validacion || '')
  .split('·').map((m) => m.trim()).filter(Boolean);

export const bloqueantesF931 = (motivos) => motivos.filter((m) => MOTIVOS_F931_NO_ACEPTABLES.includes(m));

// Las validaciones de `validar_f931`, una por una, con los códigos que las
// hacen fallar. Cada una se marca OK si ninguno de sus códigos vino.
export const CHEQUEOS_F931 = [
  { clave: 'cuit', label: 'CUIT del PDF = CUIT de la empresa', motivos: ['CUIT_DISTINTO', 'EMPRESA_SIN_CUIT'] },
  { clave: 'periodo', label: 'Período dentro de los últimos 6 meses', motivos: ['PERIODO_VENCIDO', 'PERIODO_FUTURO'] },
  { clave: 'empleados', label: 'Declara empleados', motivos: ['SIN_EMPLEADOS'] },
  { clave: 'salario', label: 'Salario promedio entre 0,3 y 3 × el del CIIU', motivos: ['SIN_SALARIO_CIIU', 'SALARIO_FUERA_DE_RANGO'] },
  { clave: 'posterior', label: 'Sin F.931 aplicado de un período posterior', motivos: ['SUPERADO'] },
  { clave: 'rectificativa', label: 'No es rectificativa de un período ya cargado', motivos: ['RECTIFICATIVA'] },
];

export const chequeosF931 = (motivos = []) => CHEQUEOS_F931.map((c) => {
  const fallados = c.motivos.filter((m) => motivos.includes(m));
  return { ...c, ok: fallados.length === 0, fallados };
});

// Códigos que el backend mandó y esta pantalla no conoce: se muestran
// crudos, nunca se esconden.
export const motivosDesconocidos = (motivos = []) => {
  const conocidos = new Set(CHEQUEOS_F931.flatMap((c) => c.motivos));
  return motivos.filter((m) => !conocidos.has(m));
};

export const ESTADO_F931_INFO = {
  APLICADO: { label: 'APLICADO', clase: 'bg-green-500/20 text-green-300', texto: 'Se aplica: dotación ALTA · F931.' },
  PROPUESTO: { label: 'PROPUESTO', clase: 'bg-yellow-500/20 text-yellow-300', texto: 'Va a la bandeja F931 para que una persona decida.' },
  SUPERADO: { label: 'SUPERADO', clase: 'bg-slate-600/40 text-slate-300', texto: 'Queda SUPERADO: ya hay un F.931 posterior aplicado.' },
  RECHAZADO: { label: 'RECHAZADO', clase: 'bg-red-500/20 text-red-300', texto: 'Rechazado.' },
};

export const estadoF931Info = (estado) => ESTADO_F931_INFO[estado]
  || { label: estado || '—', clase: 'bg-slate-600/40 text-slate-300', texto: '' };

// Período: el backend manda 'YYYY-MM-DD' (primer día del mes) en la
// ingesta y la bandeja, y 'YYYY-MM' en la ficha. Es un MES, no un día:
// se muestra mm/aaaa.
export const periodoF931 = (valor) => {
  if (!valor) return null;
  const m = String(valor).match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : String(valor);
};

// El texto de un error de la subida. 422 PDF_SIN_TEXTO y los 409 tienen su
// frase fija (OPERACIONES-0010 FE); el resto, el mensaje del backend.
export const PDF_SIN_TEXTO_MSG = 'El PDF es una imagen/escaneo. Subí el F931 descargado de ARCA.';
export const MISMO_PDF_MSG = 'Este F931 ya está cargado.';

export const mensajeErrorF931 = (err) => {
  const d = err?.detail;
  const motivo = d && typeof d === 'object' ? (d.motivo || d.causa) : null;
  if (err?.status === 422 && motivo === 'PDF_SIN_TEXTO') return PDF_SIN_TEXTO_MSG;
  if (err?.status === 422 && motivo === 'CAMPOS_FALTANTES') {
    return `${textoDetail(d)}${d.campos_faltantes?.length ? ` (faltan: ${d.campos_faltantes.join(', ')})` : ''}`;
  }
  if (err?.status === 409) {
    if (motivo === 'MISMO_PDF') return `${MISMO_PDF_MSG} ${textoDetail(d)}`.trim();
    return textoDetail(d) || err.message;
  }
  if (d) return textoDetail(d);
  return err?.message || 'Error inesperado';
};
