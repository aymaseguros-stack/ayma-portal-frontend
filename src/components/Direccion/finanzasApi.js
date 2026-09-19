// Cliente HTTP del módulo FINANZAS (app/api/v1/finanzas.py del backend,
// PR #167 / bd5d8f5) y del resumen de Dirección del dashboard
// (GET /api/v1/dashboard/resumen-direccion).
//
// Mismo patrón que direccionApi.js: fetch crudo + authHeader/formatApiError
// de utils/api, error con `status` y `cuerpo` colgados encima. El router
// entero cuelga de require_admin, así que todo lo de acá es ADMIN-only: un
// EMPLEADO recibe 403.
//
// DOS REGLAS DEL MÓDULO, heredadas del backend y que esta capa NO puede
// romper:
//  1. NADA SE BORRA: gastos y comisiones se ANULAN (DELETE = anular, y la
//     fila sigue viniendo con `anulado_en` si se piden los anulados).
//  2. NO SE SUMAN MONEDAS. Todo total viene por moneda y los montos llegan
//     como STRING (Decimal serializado). No pasarlos por Number() para
//     sumarlos: para eso está sumarMontos(), que trabaja en enteros de
//     centavos.
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/finanzas';

const headers = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    qs.set(k, v);
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// El 409 de comisión duplicada tiene que llegar a la pantalla como un
// mensaje entendible, no como "Error 409". El detalle del backend ya nombra
// la clave (compañía/ramo/período/moneda), así que se conserva tal cual y
// se marca `err.duplicado` para que el formulario lo muestre como aviso y
// no como error crudo de red.
const errorDeRespuesta = async (res) => {
  let cuerpo = null;
  try {
    cuerpo = await res.clone().json();
  } catch {
    // no era JSON; nos quedamos con el status
  }
  const err = new Error(await formatApiError(res));
  err.status = res.status;
  err.cuerpo = cuerpo;
  if (res.status === 409) {
    const detalle = cuerpo?.detail;
    err.duplicado = typeof detalle === 'string' && detalle
      ? detalle
      : 'Ya existe una comisión liquidada vigente para esa compañía, ramo, período y moneda.';
    err.message = err.duplicado;
  }
  return err;
};

const pedir = async (token, ruta, { metodo = 'GET', cuerpo, query, base = BASE } = {}) => {
  const res = await fetch(`${API_URL}${base}${ruta}${buildQuery(query)}`, {
    method: metodo,
    headers: headers(token),
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  if (!res.ok) throw await errorDeRespuesta(res);
  if (res.status === 204) return null;
  return res.json();
};

const lista = async (...args) => {
  const data = await pedir(...args);
  return Array.isArray(data) ? data : [];
};

// --- Resumen de Dirección (dashboard) ------------------------------------
// GET /api/v1/dashboard/resumen-direccion -> {fecha, siniestros, art,
// comisiones, comercios}. CADA BLOQUE trae `disponible`; si es false trae
// `motivo` y NO trae los números. Nunca renderizar 0 con disponible=false.
export const obtenerResumenDireccion = (token) =>
  pedir(token, '/resumen-direccion', { base: '/api/v1/dashboard' });

// --- Presupuesto: asignaciones -------------------------------------------
export const listarAsignaciones = (token, filtros = {}) =>
  lista(token, '/presupuesto/asignaciones', { query: filtros });
export const crearAsignacion = (token, datos) =>
  pedir(token, '/presupuesto/asignaciones', { metodo: 'POST', cuerpo: datos });
// PATCH sólo monto_asignado y notas: periodo/rubro/canal/moneda son la clave
// única y el backend no los parchea.
export const editarAsignacion = (token, id, datos) =>
  pedir(token, `/presupuesto/asignaciones/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });
export const borrarAsignacion = (token, id) =>
  pedir(token, `/presupuesto/asignaciones/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
// dry_run=true (default del backend) devuelve la MISMA propuesta que
// escribiría, sin escribir. La pantalla la muestra y recién ahí confirma.
export const copiarAsignaciones = (token, desde, hacia, dryRun = true) =>
  pedir(token, '/presupuesto/asignaciones/copiar',
    { metodo: 'POST', query: { desde, hacia, dry_run: dryRun } });

// --- Presupuesto: resumen y serie ----------------------------------------
export const resumenPresupuesto = (token, periodo) =>
  pedir(token, '/presupuesto/resumen', { query: { periodo } });
export const seriePresupuesto = (token, desde, hasta) =>
  pedir(token, '/presupuesto/serie', { query: { desde, hasta } });

// --- Gastos ---------------------------------------------------------------
export const listarGastos = (token, filtros = {}) =>
  lista(token, '/presupuesto/gastos', { query: filtros });
export const crearGasto = (token, datos) =>
  pedir(token, '/presupuesto/gastos', { metodo: 'POST', cuerpo: datos });
export const editarGasto = (token, id, datos) =>
  pedir(token, `/presupuesto/gastos/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });
// DELETE = ANULAR. El gasto sigue existiendo con `anulado_en`: un gasto que
// desaparece sin rastro es indistinguible de uno que nunca se cargó.
export const anularGasto = (token, id) =>
  pedir(token, `/presupuesto/gastos/${encodeURIComponent(id)}`, { metodo: 'DELETE' });
export const generarRecurrentes = (token, periodo, dryRun = true) =>
  pedir(token, '/presupuesto/gastos/generar-recurrentes',
    { metodo: 'POST', query: { periodo, dry_run: dryRun } });

// --- Comisiones liquidadas ------------------------------------------------
export const listarComisiones = (token, filtros = {}) =>
  lista(token, '/comisiones-liquidadas', { query: filtros });
export const crearComision = (token, datos) =>
  pedir(token, '/comisiones-liquidadas', { metodo: 'POST', cuerpo: datos });
export const anularComision = (token, id) =>
  pedir(token, `/comisiones-liquidadas/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

// Suma de montos que YA vienen en la misma moneda, en centavos enteros.
//
// POR QUÉ NO Number(): los montos son Decimal serializado como string y el
// total del tablero tiene que coincidir con el del comprobante. 0.1 + 0.2 en
// binario da 0.30000000000000004, y con tres pantallas de gastos eso se
// convierte en un peso de diferencia que nadie sabe de dónde salió. Se pasa
// a centavos enteros, se suma, y se vuelve a texto.
//
// Devuelve null -nunca "0.00"- si algún valor no es un decimal legible: un
// total parcial presentado como total es peor que la ausencia del total.
export const sumarMontos = (valores) => {
  let centavos = 0;
  for (const valor of valores) {
    const texto = String(valor ?? '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(texto)) return null;
    const negativo = texto.startsWith('-');
    const [enteros, decimales = ''] = texto.replace('-', '').split('.');
    const cent = Number(enteros) * 100 + Number((decimales + '00').slice(0, 2));
    centavos += negativo ? -cent : cent;
  }
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  return `${signo}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
};
