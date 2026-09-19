// Vocabularios de FACTURACIÓN ELECTRÓNICA ARCA. Copiados UNO A UNO de
// app/core/facturacion_config.py y app/models/factura.py del backend
// (PR #168/#169). Quien valida es app/schemas/factura.py: un valor
// inventado acá vuelve 422.

// app/core/facturacion_config.py::CODIGO_DOCUMENTO
export const TIPOS_DOCUMENTO = [
  'CUIT', 'CUIL', 'CDI', 'DNI', 'LE', 'LC', 'CI_EXTRANJERA', 'PASAPORTE',
  'CONSUMIDOR_FINAL',
];

// app/core/facturacion_config.py::CONDICION_IVA_RECEPTOR (RG 5616/2024).
export const CONDICIONES_IVA = [
  'RESPONSABLE_INSCRIPTO', 'EXENTO', 'CONSUMIDOR_FINAL', 'MONOTRIBUTO',
  'SUJETO_NO_CATEGORIZADO', 'PROVEEDOR_DEL_EXTERIOR', 'CLIENTE_DEL_EXTERIOR',
  'LIBERADO_LEY_19640', 'MONOTRIBUTISTA_SOCIAL',
  'MONOTRIBUTO_TRABAJADOR_INDEPENDIENTE',
];

export const CONCEPTOS = ['PRODUCTOS', 'SERVICIOS', 'PRODUCTOS_Y_SERVICIOS'];

// Los conceptos que EXIGEN período de servicio y vencimiento de pago en
// WSFEv1: mandarlos sin eso es el rechazo 10025/10026 de ARCA, así que el
// formulario muestra las fechas y las pide.
export const CONCEPTOS_CON_PERIODO = ['SERVICIOS', 'PRODUCTOS_Y_SERVICIOS'];
export const exigePeriodoDeServicio = (concepto) => CONCEPTOS_CON_PERIODO.includes(concepto);

// app/models/factura.py::ESTADOS
export const ESTADO_AUTORIZADA = 'AUTORIZADA';
export const ESTADO_RECHAZADA = 'RECHAZADA';
export const ESTADO_ERROR_COMUNICACION = 'ERROR_COMUNICACION';
export const ESTADOS_FACTURA = [
  'BORRADOR', 'ENVIANDO', ESTADO_AUTORIZADA, ESTADO_RECHAZADA,
  ESTADO_ERROR_COMUNICACION,
];

export const CLASES_ESTADO_FACTURA = {
  AUTORIZADA: 'bg-green-500/20 text-green-300',
  RECHAZADA: 'bg-red-500/20 text-red-300',
  ERROR_COMUNICACION: 'bg-orange-500/20 text-orange-200',
  ENVIANDO: 'bg-yellow-500/20 text-yellow-200',
  BORRADOR: 'bg-slate-700/60 text-slate-300',
};

// EL AMBIENTE SE GRITA, NO SE SUSURRA. Un comprobante de homologación no
// tiene validez fiscal y uno de producción es irreversible: confundirlos es
// el error caro de este módulo, así que va en amarillo/rojo y en grande en
// el panel de estado y en TODA confirmación antes de emitir.
export const AMBIENTE_PRODUCCION = 'produccion';
export const AMBIENTE_HOMOLOGACION = 'homologacion';

export const esProduccion = (ambiente) => String(ambiente) === AMBIENTE_PRODUCCION;

export const textoAmbiente = (ambiente) =>
  (esProduccion(ambiente) ? 'PRODUCCIÓN' : 'HOMOLOGACIÓN');

export const detalleAmbiente = (ambiente) => (esProduccion(ambiente)
  ? 'Los comprobantes son REALES y quedan declarados ante ARCA. No se borran: se anulan con nota de crédito.'
  : 'Los comprobantes son de prueba y NO tienen validez fiscal. El PDF sale con la leyenda de homologación.');

export const CLASES_AMBIENTE = {
  produccion: 'bg-red-500/20 text-red-200 border-red-500/50',
  homologacion: 'bg-yellow-500/20 text-yellow-100 border-yellow-500/50',
};

export const claseAmbiente = (ambiente) =>
  CLASES_AMBIENTE[esProduccion(ambiente) ? 'produccion' : 'homologacion'];

// Clave de idempotencia, generada por el FORMULARIO y conservada mientras
// dure el intento de emisión.
//
// POR QUÉ IMPORTA QUE SEA ESTABLE: si un envío falla por red y el operador
// aprieta "Reintentar", tiene que viajar LA MISMA clave. Con una clave nueva
// el backend emitiría un segundo comprobante, y dos comprobantes con CAE por
// la misma operación se arreglan con una nota de crédito ante ARCA, no con
// un DELETE. Clave nueva sólo al abrir un formulario nuevo o al cambiar lo
// que se va a emitir.
export const nuevaClaveIdempotencia = () => {
  const aleatorio = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `ayma-portal-${Date.now()}-${aleatorio}`;
};

// Receptor "Consumidor Final" sin datos: el atajo del mostrador. Documento
// tipo 99 con número 0 es lo que ARCA espera para un comprobante sin
// identificar al receptor.
export const CONSUMIDOR_FINAL = {
  tipo_documento: 'CONSUMIDOR_FINAL',
  numero_documento: '0',
  razon_social: 'Consumidor Final',
  condicion_iva: 'CONSUMIDOR_FINAL',
  domicilio: '',
  email: '',
};

export const RECEPTOR_VACIO = {
  tipo_documento: 'CUIT',
  numero_documento: '',
  razon_social: '',
  condicion_iva: 'RESPONSABLE_INSCRIPTO',
  domicilio: '',
  email: '',
};

// Total de un ítem, en centavos enteros y de vuelta a texto. Mismo criterio
// que sumarMontos() de finanzasApi: nunca float para un importe fiscal.
// Devuelve null si algo no es legible - un total parcial mostrado como total
// es peor que la ausencia del total.
export const totalDeItems = (items = []) => {
  let centavos = 0;
  for (const it of items) {
    const cantidad = Number(it.cantidad);
    const precio = Number(it.precio_unitario);
    const bonif = Number(it.bonificacion_porcentaje || 0);
    if (!Number.isFinite(cantidad) || !Number.isFinite(precio) || !Number.isFinite(bonif)) return null;
    centavos += Math.round(cantidad * precio * (1 - bonif / 100) * 100);
  }
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};

// El texto COMPLETO de lo que ARCA observó o rechazó, para el portapapeles.
// TEXTUAL Y ENTERO: un código de ARCA resumido o traducido no sirve para
// buscarlo en la documentación ni para pasárselo al despachante.
export const detalleParaCopiar = (factura) => {
  const lineas = [
    `Comprobante: ${factura?.tipo_comprobante || '—'} ${factura?.numero_completo || '(sin número)'}`,
    `Id interno: ${factura?.id || '—'}`,
    `Estado: ${factura?.estado || '—'}`,
    `Ambiente: ${textoAmbiente(factura?.ambiente)}`,
    `Resultado ARCA: ${factura?.resultado_arca || '—'}`,
    `CAE: ${factura?.cae || '—'} (vence ${factura?.cae_vencimiento || '—'})`,
  ];
  const bloque = (titulo, filas) => {
    if (!filas?.length) return [];
    return [`${titulo}:`, ...filas.map((o) => `  [${o.codigo}] ${o.mensaje}`)];
  };
  lineas.push(...bloque('Errores de ARCA', factura?.errores_arca));
  lineas.push(...bloque('Observaciones de ARCA', factura?.observaciones_arca));
  return lineas.join('\n');
};
