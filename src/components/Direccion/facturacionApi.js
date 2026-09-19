// Cliente HTTP de FACTURACIÓN ELECTRÓNICA ARCA (F-01).
// Backend: app/api/v1/facturas.py (PR #168) + el endpoint de comisiones de
// app/api/v1/finanzas.py (PR #169) + POST /direccion/importar-semilla.
//
// Mismo patrón que finanzasApi.js / direccionApi.js: fetch crudo +
// authHeader/formatApiError, con `status` y `cuerpo` colgados del error.
// Los dos routers cuelgan de require_admin: todo esto es ADMIN-only.
//
// CUATRO REGLAS DEL MÓDULO QUE ESTA CAPA NO PUEDE ROMPER:
//
//  1. UN 503 NO ES UN ERROR DE RED. Con FACTURACION_ENABLED=false el
//     backend contesta 503 a TODO salvo /estado. Se marca `err.apagado`
//     para que la pantalla muestre un cartel informativo y no un error
//     rojo, y `err.faltantes` cuando el 503 es por configuración.
//
//  2. EL `Idempotency-Key` LO GENERA EL FORMULARIO, NO ESTA CAPA. Si la
//     clave se generara acá, cada reintento mandaría una clave nueva y la
//     idempotencia no protegería del doble envío, que es justo para lo que
//     existe. Se pasa como argumento y el formulario la conserva mientras
//     dure el intento.
//
//  3. UN 201 NO SIGNIFICA "ARCA AUTORIZÓ". El comprobante se crea igual si
//     ARCA rechazó o no contestó; lo que hay que mirar es `estado`. Esta
//     capa devuelve el cuerpo tal cual y NO interpreta.
//
//  4. EL PDF SE BAJA AUTENTICADO Y COMO BLOB. Nunca se arma una URL
//     compartible: el comprobante lleva CUIT y domicilio del receptor.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/finanzas/facturas';

const headers = (token, extra = {}) => ({
  ...authHeader(token), 'Content-Type': 'application/json', ...extra,
});

const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, v);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// `detail` del backend puede ser string o un objeto ({error, faltantes,
// como_resolver} en el 503 de configuración; {error, motivo, detalle} en el
// 502 de ARCA; {error, mensaje, faltantes, proveedores_candidatos} en el 422
// de la compañía). Se conserva ENTERO en `err.cuerpo` y se derivan sólo las
// marcas que las pantallas necesitan.
const errorDeRespuesta = async (res) => {
  let cuerpo = null;
  try { cuerpo = await res.clone().json(); } catch { /* no era JSON */ }
  const detalle = cuerpo?.detail;
  const err = new Error(await formatApiError(res));
  err.status = res.status;
  err.cuerpo = cuerpo;
  err.detalle = detalle ?? null;

  if (typeof detalle === 'string' && detalle) err.message = detalle;
  else if (detalle && typeof detalle === 'object') {
    err.message = detalle.mensaje || detalle.detalle || detalle.error || err.message;
    if (Array.isArray(detalle.faltantes)) err.faltantes = detalle.faltantes;
    if (Array.isArray(detalle.proveedores_candidatos)) {
      err.candidatos = detalle.proveedores_candidatos;
    }
    if (detalle.error === 'arca_no_respondio') err.arca = detalle;
    // El 409 del descarte: `reconciliado` significa que ARCA SÍ tenía el
    // comprobante y que se adoptó su CAE. La pantalla tiene que refrescar,
    // no sólo mostrar el error: lo que se iba a tirar quedó AUTORIZADA.
    if (detalle.error === 'operacion_no_permitida') {
      err.motivo = detalle.motivo;
      err.reconciliado = Boolean(detalle.reconciliado);
    }
  }
  if (res.status === 503) {
    err.apagado = true;
    err.sinConfigurar = Boolean(err.faltantes?.length);
  }
  return err;
};

const pedir = async (token, ruta, {
  metodo = 'GET', cuerpo, query, base = BASE, cabeceras,
} = {}) => {
  const res = await fetch(`${API_URL}${base}${ruta}${buildQuery(query)}`, {
    method: metodo,
    headers: headers(token, cabeceras),
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  if (!res.ok) throw await errorDeRespuesta(res);
  if (res.status === 204) return null;
  const data = await res.json();
  // `ya_existia` de la idempotencia se ve SÓLO en el status: 200 en vez de
  // 201. El cuerpo es idéntico, así que la marca viaja acá.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return { ...data, __reusado: res.status === 200 && metodo === 'POST' };
  }
  return data;
};

// --- Estado y diagnóstico -------------------------------------------------
// GET /estado es el ÚNICO que contesta con el módulo apagado: es el que dice
// POR QUÉ está apagado. No lo llames con try/catch silencioso.
export const obtenerEstado = (token) => pedir(token, '/estado');
export const obtenerParametros = (token) => pedir(token, '/parametros');

// --- Emisión --------------------------------------------------------------
export const emitirFactura = (token, datos, idempotencyKey) =>
  pedir(token, '', {
    metodo: 'POST',
    cuerpo: datos,
    cabeceras: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });

// --- Consulta -------------------------------------------------------------
export const listarFacturas = (token, filtros = {}) => pedir(token, '', { query: filtros });
export const verFactura = (token, id) => pedir(token, `/${encodeURIComponent(id)}`);
export const resumenMensual = (token, anio, mes) =>
  pedir(token, `/resumen/${Number(anio)}/${Number(mes)}`);
export const prefillEmpresa = (token, empresaId) =>
  pedir(token, `/prefill/empresa/${encodeURIComponent(empresaId)}`);

// A QUIÉN LE FACTURA AYMA: las compañías del padrón de PROVEEDORES.
//
// NO ES EL CRM, Y ES EL ARREGLO. El buscador del receptor consultaba
// /api/v1/crm/buscar, o sea las EMPRESAS CLIENTE: las PyMEs a las que AYMA
// les vende seguros. A ésas no se les factura - su comprobante lo emite la
// compañía. AYMA le factura a las ASEGURADORAS y ART las comisiones que le
// liquidan, y ésas viven en Dirección > Proveedores.
//
// Cada fila trae el snapshot fiscal ya armado en `receptor`, listo para
// mandarlo en el POST, y `falta_cuit` marcado cuando el padrón no lo tiene:
// sin documento del receptor no hay comprobante, y NI EL BACKEND NI ESTA
// CAPA lo inventan. Se pide a mano y se sugiere completarlo en Proveedores.
export const buscarReceptores = (token, q) =>
  pedir(token, '/receptores', { query: { q } });

// --- Anulación y reconciliación -------------------------------------------
// "Anular" EMITE UNA NOTA DE CRÉDITO y devuelve ESA nota, no la factura.
export const anularFactura = (token, id, motivo) =>
  pedir(token, `/${encodeURIComponent(id)}/anular`, { metodo: 'POST', cuerpo: { motivo } });

// NO ES UN REINTENTO: consulta en ARCA qué pasó con el número que se
// intentó. Un reintento a ciegas después de un timeout duplica el
// comprobante, que es un problema fiscal, no un problema de UX.
export const reconciliarFactura = (token, id) =>
  pedir(token, `/${encodeURIComponent(id)}/reconciliar`, { metodo: 'POST' });

// TAMPOCO ES UN BORRADO. Marca DESCARTADA una tentativa que nunca obtuvo
// CAE, y el backend le PREGUNTA A ARCA primero: si ARCA lo tiene, no
// descarta nada -adopta su CAE- y contesta 409 con `reconciliado=true`. La
// fila nunca se borra. Por eso la pantalla tiene que avisarlo ANTES de que
// el operador apriete, y volver a cargar el comprobante DESPUÉS: puede
// haber quedado AUTORIZADA.
export const descartarFactura = (token, id, motivo) =>
  pedir(token, `/${encodeURIComponent(id)}/descartar`, { metodo: 'POST', cuerpo: { motivo } });

// --- PDF ------------------------------------------------------------------
// Descarga AUTENTICADA: fetch con Bearer -> blob -> object URL efímera que
// se revoca en el acto. Nunca un <a href> a la ruta del backend (iría sin
// Authorization y daría 401) ni una URL compartible.
export const descargarPdf = async (token, factura) => {
  const res = await fetch(`${API_URL}${BASE}/${encodeURIComponent(factura.id)}/pdf`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw await errorDeRespuesta(res);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${factura.tipo_comprobante || 'comprobante'}_${factura.numero_completo || factura.id}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
};

// --- Facturar una comisión liquidada --------------------------------------
// POST /api/v1/finanzas/comisiones-liquidadas/{id}/facturar. El cuerpo puede
// ir vacío: la compañía sale del padrón de proveedores. Un 422 con
// `faltantes` pide el snapshot fiscal; un 409 es "ya facturada" o "anulada".
export const facturarComision = (token, comisionId, cuerpo = {}, idempotencyKey) =>
  pedir(token, `/comisiones-liquidadas/${encodeURIComponent(comisionId)}/facturar`, {
    base: '/api/v1/finanzas',
    metodo: 'POST',
    cuerpo,
    cabeceras: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });

// --- Importador de semilla de Dirección -----------------------------------
// `dry_run` va SÓLO en la query string (regla de app/api/dry_run.py del
// backend: mandarlo en el body es 422). El default del backend es true y
// acá también: nunca se escribe sin haber mostrado antes la corrida en seco.
export const importarSemilla = (token, datos, dryRun = true) =>
  pedir(token, '/importar-semilla', {
    base: '/api/v1/direccion',
    metodo: 'POST',
    cuerpo: datos,
    query: { dry_run: dryRun },
  });
