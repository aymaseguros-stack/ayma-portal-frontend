// Vocabularios del módulo PUNTOS DE CONTACTO. Copiados UNO A UNO de los
// enums de app/models/comercial.py del backend (PR #183 / 0fc7bcf): las
// columnas son VARCHAR y quien valida es app/schemas/comercial.py, así que
// un valor inventado acá vuelve como 422. No agregar opciones sin agregarlas
// antes en el backend. Mismo criterio que direccionConstantes.js.

export const TIPOS_PUNTO = ['fisico', 'proveedor', 'referido', 'digital', 'evento'];

export const RIESGOS_PUNTO = [
  'AUTO', 'MOTO', 'ART', 'COMERCIO', 'HOGAR', 'CAUCION', 'VIDA', 'FLOTA', 'MULTI',
];

export const DESTINOS_TIPO = ['landing_riesgo', 'cotizador', 'whatsapp'];

export const ESTADOS_COMISION_REFERIDO = ['DEVENGADA', 'LIQUIDADA', 'ANULADA'];

// Los dos órdenes del ranking (services/comercial.py::ORDENES_RANKING). Es
// una lista CERRADA en el backend: cualquier otro valor es 422.
export const ORDENES_RANKING = [
  { id: 'leads', label: 'Por leads' },
  { id: 'conversion', label: 'Por conversión' },
];

// `tipo_punto` y `destino_tipo` son minúsculas con guión bajo en el backend;
// `etiqueta` de Dirección sólo saca los guiones bajos y dejaría "landing
// riesgo" en minúscula suelta en el medio de una tabla en mayúsculas.
export const etiquetaPunto = (valor) => {
  if (!valor) return '—';
  const texto = String(valor).replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// ---------------------------------------------------------------------------
// El slug
// ---------------------------------------------------------------------------
//
// EL BACKEND LO NORMALIZA A MINÚSCULAS (`schemas/comercial.py::_validar_slug`
// hace `.strip().lower()` antes de validar) y su patrón es
// `^[a-z0-9][a-z0-9-]{1,31}$`. El campo del formulario acepta que lo tipeen
// en MAYÚSCULAS -que es como se lee un QR impreso y como lo dicta una
// persona- y lo baja acá mismo, en vez de rechazarlo: `JEFA-AUTO` y
// `jefa-auto` son el mismo punto, y eso ya lo decidió el backend.
//
// Se valida antes de mandar porque el slug NO SE PUEDE CAMBIAR después
// (no hay PATCH de `slug`: viaja impreso en un QR que ya está pegado en una
// pared). Un 422 del servidor avisaría igual, pero recién después de que la
// persona llenó el resto del formulario.
export const LARGO_MAX_SLUG = 32;
const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const normalizarSlug = (valor) => String(valor ?? '').trim().toLowerCase();

export const errorDeSlug = (valor) => {
  const slug = normalizarSlug(valor);
  if (!slug) return 'El slug es obligatorio: es lo que se imprime en el QR.';
  if (slug.length > LARGO_MAX_SLUG) return `Máximo ${LARGO_MAX_SLUG} caracteres.`;
  if (!PATRON_SLUG.test(slug)) {
    return 'Sólo letras, dígitos y guiones, 2 a 32, empezando por letra o dígito (p. ej. "jefa-auto").';
  }
  return null;
};

// ---------------------------------------------------------------------------
// Relación económica del proveedor (backend PR #184)
// ---------------------------------------------------------------------------
//
// El enum vive en app/models/comercial.py::RelacionEconomica y el schema lo
// valida A LA ENTRADA; a la salida el backend lo manda como `str`, así que
// puede llegar un valor que esta lista no tenga (una corrección a mano, una
// fila vieja). `claseRelacion` cae al gris en vez de romper.
export const RELACIONES_ECONOMICAS = ['INGRESO', 'EGRESO', 'COMPARTIDA'];

export const CLASES_RELACION = {
  INGRESO: 'bg-green-500/20 text-green-300 border-green-500/40',
  EGRESO: 'bg-slate-600/50 text-slate-300 border-slate-500/50',
  COMPARTIDA: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
};

// NULL NO ES VACÍO. Un proveedor sin clasificar es un dato que falta y hay
// que cargar, no una celda en blanco que se pasa de largo: la migración de
// datos del backend deja en NULL a los tipos SERVICIOS y OTRO a propósito
// ("no hay forma de saber la dirección sin mirar el contrato"), así que esta
// etiqueta es la lista de trabajo pendiente, no un error.
export const SIN_CLASIFICAR = 'Sin clasificar';
export const CLASE_SIN_CLASIFICAR = 'bg-amber-500/20 text-amber-200 border-amber-500/40';

export const claseRelacion = (valor) =>
  (valor ? (CLASES_RELACION[valor] || 'bg-slate-700/60 text-slate-300 border-slate-600')
    : CLASE_SIN_CLASIFICAR);

// ---------------------------------------------------------------------------
// Formato
// ---------------------------------------------------------------------------

// "sin dato todavía", NUNCA un 0 que miente. Un punto recién creado tiene 0
// escaneos de verdad (y ahí el 0 es el dato), pero un campo que el backend
// no mandó -o que todavía no se cargó- no es un cero: escribirlo como 0
// hace creer que se midió algo.
export const SIN_DATO = 'sin dato todavía';

export const oSinDato = (valor) =>
  (valor === null || valor === undefined || valor === '' ? SIN_DATO : valor);

// Los montos llegan como STRING (Decimal serializado). Se parsean para
// formatear, nunca para sumarse entre monedas.
export const formatearPesos = (valor) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) {
    return SIN_DATO;
  }
  return `$ ${numero.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// El porcentaje llega como float ya calculado por el backend
// (`_pct`), no se recalcula acá: recalcularlo sería tener dos fuentes para
// el mismo número y que la ficha y el ranking discrepen.
export const formatearPct = (valor) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(numero)) return SIN_DATO;
  return `${numero.toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`;
};

export const formatearPctCampo = (valor) => {
  const numero = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(numero)) {
    return SIN_DATO;
  }
  return `${numero.toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;
};

export const fechaCorta = (iso) => {
  if (!iso) return SIN_DATO;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return SIN_DATO;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Un punto VENCIDO no es lo mismo que uno apagado, y el backend los manda
// por separado: `activo` es la decisión y `vigente` el resultado (lo calcula
// al serializar, junto con `url_corta`). La tabla muestra los dos porque la
// pregunta "¿por qué este QR no trae leads?" se contesta con el segundo.
export const estadoDeVigencia = (punto) => {
  if (!punto?.activo) return { texto: 'Apagado', clase: 'bg-slate-600/40 text-slate-400' };
  if (punto.vigente === false) return { texto: 'Vencido', clase: 'bg-red-500/20 text-red-300' };
  return { texto: 'Activo', clase: 'bg-green-500/20 text-green-300' };
};
