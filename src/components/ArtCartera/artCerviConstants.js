// Vocabulario de la bandeja "Dotación propuesta" (@CERVI, OPERACIONES-0009).
// NINGÚN CÁLCULO: el promedio del sector, el ratio, los tramos y las
// alertas los escribe el worker en la propuesta (`evidencia`) y el backend
// deriva `requiere_revision_individual` en lectura. Acá sólo se leen y se
// etiquetan. Una alerta que no esté en el mapa se muestra CRUDA.

// Las alertas llegan como texto con parámetros ("PLANILLA_INFLADA x12.5",
// "CAMBIA_TRAMO 26 a 40->1"): el código es la primera palabra.
const ALERTA_META = {
  GRANDE_REVISAR: { label: 'Grande · revisar', clase: 'bg-red-600/30 text-red-200 ring-1 ring-red-400/60 font-semibold' },
  PLANILLA_INFLADA: { label: 'Planilla inflada', clase: 'bg-orange-500/20 text-orange-300' },
  CAMBIA_TRAMO: { label: 'Cambia tramo', clase: 'bg-blue-500/20 text-blue-300' },
  MICRO_CONFIRMAR: { label: 'Micro · confirmar', clase: 'bg-yellow-500/20 text-yellow-300' },
};

export const codigoAlerta = (alerta) => String(alerta || '').trim().split(/\s+/)[0];

export const alertaInfo = (alerta) => {
  const texto = String(alerta || '').trim();
  const codigo = codigoAlerta(texto);
  const meta = ALERTA_META[codigo];
  if (!meta) return { codigo, label: texto, detalle: '', clase: 'bg-slate-600/40 text-slate-300' };
  return { codigo, label: meta.label, detalle: texto.slice(codigo.length).trim(), clase: meta.clase };
};

const aNumero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Lo que la fila muestra, leído de la propuesta y de su `evidencia` (el
// listado no repite los campos de la corrida: viven en la evidencia JSON).
// `vence_en_dias` no se persiste en la propuesta: si el backend no lo
// manda, la celda dice "—" y no se estima.
export const datosPropuesta = (p) => {
  const ev = p?.evidencia || {};
  return {
    ciiu: p?.ciiu ?? ev.ciiu ?? null,
    promSector: aNumero(p?.prom_sector ?? ev.prom_empleador_ciiu),
    ratio: aNumero(p?.ratio ?? ev.ratio),
    tramoPrevio: p?.tramo_previo ?? ev.tramo_previo ?? null,
    tramoNuevo: p?.tramo_nuevo ?? ev.tramo_nuevo ?? null,
    venceEnDias: aNumero(p?.vence_en_dias ?? ev.vence_en_dias),
    versionCuadro: ev.version_cuadro || null,
  };
};

// Un valor tipeado es válido si es un entero > 0 (mismo límite que
// AceptarPropuestaRequest.valor, gt=0).
export const valorValido = (texto) => {
  const s = String(texto ?? '').trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
};

// Cómo se manda la selección del grupo "Para aceptar en lote". El lote
// acepta cada id con su valor PROPUESTO y no recibe valores: una fila con
// el valor editado va por /aceptar individual con {valor}. Una fila editada
// con un valor inválido no se manda (queda en `invalidas`). Una fila que el
// backend marca como grande nunca va al lote desde acá (sin forzar_ids).
export const planAceptacion = (filas, seleccion, valores = {}) => {
  const plan = { lote: [], individuales: [], invalidas: [], grandes: [] };
  filas.forEach((p) => {
    if (!seleccion.has(p.id)) return;
    if (p.requiere_revision_individual) { plan.grandes.push(p.id); return; }
    const tipeado = valores[p.id];
    if (tipeado === undefined || String(tipeado).trim() === String(p.valor_propuesto)) {
      plan.lote.push(p.id);
      return;
    }
    const valor = valorValido(tipeado);
    if (valor === null) { plan.invalidas.push(p.id); return; }
    if (valor === p.valor_propuesto) plan.lote.push(p.id);
    else plan.individuales.push({ id: p.id, valor });
  });
  return plan;
};

export const RESULTADO_META = {
  ACEPTADA: { label: 'Aceptada', clase: 'bg-green-500/20 text-green-300' },
  EDITADA: { label: 'Editada', clase: 'bg-teal-500/20 text-teal-300' },
  RECHAZADA: { label: 'Rechazada', clase: 'bg-slate-500/30 text-slate-200' },
  REQUIERE_REVISION: { label: 'Requiere revisión', clase: 'bg-amber-500/20 text-amber-300' },
  ERROR: { label: 'Error', clase: 'bg-red-500/20 text-red-300' },
};

export const resultadoInfo = (r) => RESULTADO_META[r] || { label: r || '—', clase: 'bg-slate-600/40 text-slate-300' };

export const OMITIDAS_LABEL = {
  NO_PROPONIBLE: 'No proponible (ventana/permanencia)',
  FUENTE_SUPERIOR: 'Fuente superior (F.931 / declarada / ARCA)',
  PENDIENTE_EXISTE: 'Ya tiene propuesta pendiente',
  CIIU_SIN_CUADRO: 'CIIU sin Cuadro 1',
};

// El `error` de un item del lote puede venir como texto o como el `detail`
// del 4xx (objeto o lista). Se muestra legible, nunca "[object Object]".
export const textoError = (error) => {
  if (error === null || error === undefined) return '';
  if (typeof error === 'string') return error;
  if (typeof error?.detail === 'string') return error.detail;
  if (typeof error?.mensaje === 'string') return error.mensaje;
  try { return JSON.stringify(error); } catch { return String(error); }
};

// ART-95: por qué un rechazo dejó de estar vigente. Lo decide el backend
// (`worker_cervi.estado_del_rechazo`); acá sólo se etiqueta. Un motivo que
// no esté en el mapa se muestra CRUDO.
export const MOTIVO_REAPERTURA_LABEL = {
  REABIERTA: 'Reabierta a mano',
  DOTACION_NUEVA: 'La empresa recibió una dotación nueva',
  CIIU_CAMBIO: 'Cambió el CIIU de la empresa',
  RECHAZO_POSTERIOR: 'Hay un rechazo más nuevo que decide',
};

export const motivoReaperturaLabel = (m) => (m ? (MOTIVO_REAPERTURA_LABEL[m] || m) : null);

// "0,44 %": dos decimales fijos. La métrica llega como Decimal (string)
// ya redondeada por el backend a 0.01; acá no se recalcula.
export const pctDosDecimales = (valor) => {
  if (valor === null || valor === undefined || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return `${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
};

// ART-98 (SÓLO SEÑALIZACIÓN): un CIIU de la cola que no tiene Cuadro 1 Y
// tampoco aparece en el catálogo CLAE que usa el buscador de CIIU
// (GET /art/ciiu?q=) es, con alta probabilidad, un código ClaNAE-97 viejo.
// La resolución (equivalencia T30) es del backend; la pantalla sólo marca.
//
// Se compara por dígitos y a 6 posiciones: la base conviene códigos de 5
// dígitos con el cero a la izquierda perdido (ciiu_longitud).
export const ETIQUETA_CLANAE97 = 'código ClaNAE-97: requiere resolución T30';

const codigoCiiu6 = (c) => {
  const d = String(c ?? '').replace(/\D/g, '');
  return d ? d.padStart(6, '0') : '';
};

// true = está en el CLAE; false = no está (marcar); null = no se puede
// decir (sin código o sin respuesta del catálogo): no se marca.
export const enNomencladorClae = (codigo, itemsCatalogo) => {
  const buscado = codigoCiiu6(codigo);
  if (!buscado || !Array.isArray(itemsCatalogo)) return null;
  return itemsCatalogo.some((it) => codigoCiiu6(it?.codigo) === buscado);
};
