// Vocabularios del módulo FINANZAS. Copiados UNO A UNO de los enums de
// app/models/finanzas.py del backend (PR #167 / bd5d8f5). Las columnas son
// VARCHAR y quien valida es app/schemas/finanzas.py: un valor inventado acá
// vuelve como 422. Los rubros y las monedas NO se duplican: son los mismos
// de DIRECCIÓN (RUBROS_PRESUPUESTO / MONEDAS en direccionConstantes.js),
// porque el rubro de un gasto y el rubro_presupuesto de un proveedor tienen
// que ser el mismo vocabulario para que el resumen cruce.

// `canal` SÓLO aplica a rubro=MARKETING: el backend lo valida en el schema
// (un canal colgado de ALQUILERES es 422), así que el formulario esconde el
// campo cuando el rubro no es MARKETING.
export const CANALES_MARKETING = ['META_ADS', 'GOOGLE_ADS', 'BUFFER', 'LINKEDIN', 'OTRO'];
export const RUBRO_CON_CANAL = 'MARKETING';

export const MEDIOS_PAGO = [
  'TRANSFERENCIA', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'DEBITO_AUTOMATICO',
  'EFECTIVO', 'MERCADO_PAGO', 'OTRO',
];

export const ORIGENES_GASTO = ['MANUAL', 'PROVEEDOR_RECURRENTE', 'IMPORT'];

export const FUENTES_COMISION = ['LIQUIDACION_COMPANIA', 'FACTURA', 'MANUAL'];

// YYYY-MM. Mismo patrón que PATRON_PERIODO del backend: "2026-13" pasaría un
// `length === 7` y después ordena mal contra "2027-01".
export const PATRON_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

export const esPeriodoValido = (valor) => PATRON_PERIODO.test(String(valor || ''));

// El mes actual en hora local: el período es un mes calendario, no un
// instante, así que no se pasa por toISOString() (que lo corre a UTC y el
// día 1 a la madrugada devuelve el mes anterior).
export const periodoActual = (fecha = new Date()) =>
  `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

// Corre un período N meses (puede ser negativo). Sobre los números del
// período, no sobre un Date: no hay husos ni días de más.
export const periodoDesplazado = (periodo, meses) => {
  if (!esPeriodoValido(periodo)) return periodo;
  const [anio, mes] = periodo.split('-').map(Number);
  const total = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = total - nuevoAnio * 12 + 1;
  return `${String(nuevoAnio).padStart(4, '0')}-${String(nuevoMes).padStart(2, '0')}`;
};

export const periodoLegible = (periodo) => {
  if (!esPeriodoValido(periodo)) return periodo || '—';
  const [anio, mes] = periodo.split('-');
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${MESES[Number(mes) - 1]} ${anio}`;
};

// El primer día del período, para el default de la fecha de un gasto nuevo.
export const primerDiaDelPeriodo = (periodo) =>
  (esPeriodoValido(periodo) ? `${periodo}-01` : '');

// % ejecutado. El backend manda `null` -no 0- cuando no hay asignado: eso
// es "gastado sin presupuesto asignado" y es el caso IMPORTANTE de los dos.
// Esta función devuelve null y quien renderiza tiene que rotularlo; jamás
// convertirlo a 0%.
export const SIN_PRESUPUESTO_ASIGNADO = 'Gastado sin presupuesto asignado';

export const formatearPorcentaje = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return null;
  return `${numero.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
};

// Ancho de la barra de ejecución, acotado a 100 para que un 300% no se
// desborde de la celda (el número igual se muestra al lado, sin recortar).
export const anchoBarra = (pct) => {
  const numero = Number(pct);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return Math.min(100, numero);
};

// Proveedores ACTIVOS que la generación de recurrentes deja AFUERA por no
// tener costo mensual o rubro de presupuesto cargado.
//
// POR QUÉ ACÁ Y NO EN EL BACKEND: la respuesta de
// POST /gastos/generar-recurrentes sólo lista los que SÍ califican, así que
// un "0 gastos a crear" se lee como "no hay nada que pagar este mes" cuando
// en realidad puede ser que a los diez proveedores les falte el dato. El
// número se calcula acá sobre el padrón que la pantalla ya tiene cargado.
export const proveedoresActivosSinDatos = (proveedores = []) => proveedores.filter(
  (p) => p.estado === 'ACTIVO' && (!p.costo_mensual || !p.rubro_presupuesto),
);
