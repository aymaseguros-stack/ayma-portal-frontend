// Vocabulario de @PAZ (OPERACIONES-0016) para dibujar, sin reglas: qué
// alerta bloquea el lote lo dice `bloquea_lote` del backend, no esta tabla.

// Las cinco alertas de worker_paz. Una que no esté acá se muestra igual,
// con su código crudo: esconderla sería esconder por qué no entra al lote.
export const ALERTAS_PAZ = {
  ES_PERSONAL: { label: 'Personal', clase: 'bg-red-500/20 text-red-300', ayuda: 'Móvil o nombre propio: no es un dato de la empresa' },
  DECISOR: { label: 'Decisor', clase: 'bg-purple-500/20 text-purple-300', ayuda: 'Nombre y cargo de una persona' },
  COMPARTIDO_3_CUIT: { label: 'Compartido 3+ CUIT', clase: 'bg-orange-500/20 text-orange-300', ayuda: 'El mismo valor aparece en 3 o más empresas (estudio contable)' },
  CONFLICTO_MEDIA: { label: 'Conflicto MEDIA', clase: 'bg-yellow-500/20 text-yellow-300', ayuda: 'La empresa ya tiene otro dato de este tipo con confianza MEDIA o más' },
  BASURA: { label: 'Basura', clase: 'bg-slate-500/30 text-slate-300', ayuda: 'Texto, menos de 6 dígitos o un dígito repetido; mail de ejemplo' },
};

export const alertaPazInfo = (codigo) => {
  const base = String(codigo || '').split(' ')[0];
  const info = ALERTAS_PAZ[base];
  return info
    ? { codigo: base, ...info }
    : { codigo: base, label: codigo, clase: 'bg-slate-600/40 text-slate-300', ayuda: codigo };
};

export const CONFIANZA_CLASE = {
  ALTA: 'bg-green-500/20 text-green-300',
  MEDIA: 'bg-blue-500/20 text-blue-300',
  BAJA: 'bg-slate-600/40 text-slate-300',
};

export const TIPOS_CONTACTO = ['TELEFONO', 'EMAIL', 'WEB', 'PERSONA'];

// Resultado de un ítem de aceptar-lote. "409 · caduca" (aprobado en el
// PASO 0): el backend dejó la propuesta CADUCA porque el dato ya estaba.
export const resultadoLoteInfo = (item) => {
  if (!item) return null;
  if (item.resultado === 'ACEPTADA') {
    return { label: item.accion ? `Aceptada · ${item.accion}` : 'Aceptada', clase: 'bg-green-500/20 text-green-300' };
  }
  if (item.resultado === 'BLOQUEADA_POR_ALERTA') {
    return { label: 'Bloqueada por alerta', clase: 'bg-orange-500/20 text-orange-300', detalle: item.motivo };
  }
  if (item.resultado === 'ERROR' && item.status_code === 409) {
    return { label: '409 · caduca', clase: 'bg-yellow-500/20 text-yellow-300', detalle: textoDetalle(item.error) };
  }
  return {
    label: item.status_code ? `Error ${item.status_code}` : (item.resultado || 'Error'),
    clase: 'bg-red-500/20 text-red-300',
    detalle: textoDetalle(item.error),
  };
};

export const textoDetalle = (error) => {
  if (error === null || error === undefined) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') return error.detail || error.mensaje || error.motivo || JSON.stringify(error);
  return String(error);
};

// Motivos de un hallazgo sin CUIT (worker_paz.MOTIVO_SIN_MATCH / _AMBIGUO).
export const MOTIVOS_SIN_CUIT = {
  SIN_MATCH: 'Sin coincidencia',
  MATCH_AMBIGUO: 'Coincidencia ambigua',
};
export const motivoSinCuitLabel = (m) => MOTIVOS_SIN_CUIT[m] || m;

// Una fracción de la métrica: el backend manda `texto` ("n/N") y `pct`.
export const textoFraccion = (f) => {
  if (!f) return '—';
  const base = f.texto || `${f.numerador ?? '—'}/${f.total ?? '—'}`;
  if (f.pct === null || f.pct === undefined) return base;
  const pct = Number(f.pct);
  if (Number.isNaN(pct)) return base;
  return `${base} · ${pct.toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`;
};
