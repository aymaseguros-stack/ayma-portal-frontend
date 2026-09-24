// Cliente HTTP del módulo DIRECCIÓN (app/api/v1/direccion.py del backend,
// PR #165 / c4ae033). Mismo patrón que Mail/mailApi.js y
// ArtCartera/artCarteraApi.js: fetch crudo + authHeader/formatApiError de
// utils/api. Todo el router del backend cuelga de require_admin, así que
// cualquier pantalla de acá es ADMIN-only: un EMPLEADO recibiría 403.
//
// Los listados de este router devuelven ARRAYS PLANOS (List[...] en los
// response_model), no el Page{total,items} de /art/*: no pasa por
// normalizeList. Igual se defiende de un no-array para no romper un .map().
import { authHeader, formatApiError } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const BASE = '/api/v1/direccion';

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

// Error de API con el cuerpo parseado colgado encima.
//
// POR QUÉ: el 409 por código duplicado trae `{detail: {detail, codigo_en_uso,
// siguiente_codigo_libre}}` y ese `siguiente_codigo_libre` es justamente lo
// que la pantalla tiene que ofrecer con un click. formatApiError lo
// aplastaría a texto, así que el cuerpo se guarda aparte en `err.cuerpo` y
// `err.status`.
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
  // El 409 de código duplicado: detail es un objeto, no un string.
  const detalle = cuerpo?.detail;
  if (res.status === 409 && detalle && typeof detalle === 'object') {
    err.conflicto = {
      mensaje: detalle.detail || 'Ese código ya está en uso',
      codigoEnUso: detalle.codigo_en_uso ?? null,
      siguienteLibre: detalle.siguiente_codigo_libre ?? null,
    };
    err.message = err.conflicto.mensaje;
  }
  return err;
};

const pedir = async (token, ruta, { metodo = 'GET', cuerpo, query } = {}) => {
  const res = await fetch(`${API_URL}${BASE}${ruta}${buildQuery(query)}`, {
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

// --- Tablero -------------------------------------------------------------
// GET /direccion/tablero -> TableroOut {semaforo_global, gerencias[],
// top_frentes[], decisiones_abiertas[], workers_por_estado{}, 
// herramientas_pagas[], costos{por_rubro,por_moneda,proveedores_contados}}
export const obtenerTablero = (token) => pedir(token, '/tablero');

// --- Gerencias -----------------------------------------------------------
export const listarGerencias = (token) => lista(token, '/gerencias');
// GET /direccion/gerencias/{codigo} -> FichaGerencia {gerencia, semaforo,
// motivos[], frentes[], decisiones[], workers[], documentos[]}
export const obtenerFichaGerencia = (token, codigo) =>
  pedir(token, `/gerencias/${encodeURIComponent(codigo)}`);

// --- Frentes -------------------------------------------------------------
export const listarFrentes = (token, filtros = {}) => lista(token, '/frentes', { query: filtros });
export const crearFrente = (token, datos) => pedir(token, '/frentes', { metodo: 'POST', cuerpo: datos });
export const editarFrente = (token, codigo, datos) =>
  pedir(token, `/frentes/${encodeURIComponent(codigo)}`, { metodo: 'PATCH', cuerpo: datos });
// DELETE no borra: cierra el frente (conserva la bitácora).
export const cerrarFrente = (token, codigo) =>
  pedir(token, `/frentes/${encodeURIComponent(codigo)}`, { metodo: 'DELETE' });
export const listarEventosFrente = (token, codigo) =>
  lista(token, `/frentes/${encodeURIComponent(codigo)}/eventos`);
export const derivarFrente = (token, codigo, datos) =>
  pedir(token, `/frentes/${encodeURIComponent(codigo)}/derivar`, { metodo: 'POST', cuerpo: datos });

// --- Decisiones ----------------------------------------------------------
export const listarDecisiones = (token, filtros = {}) => lista(token, '/decisiones', { query: filtros });
export const crearDecision = (token, datos) => pedir(token, '/decisiones', { metodo: 'POST', cuerpo: datos });
export const editarDecision = (token, codigo, datos) =>
  pedir(token, `/decisiones/${encodeURIComponent(codigo)}`, { metodo: 'PATCH', cuerpo: datos });

// --- Workers -------------------------------------------------------------
export const listarWorkers = (token, filtros = {}) => lista(token, '/workers', { query: filtros });

// --- Proveedores ---------------------------------------------------------
export const listarProveedores = (token, filtros = {}) => lista(token, '/proveedores', { query: filtros });
export const alertasProveedores = (token) => lista(token, '/proveedores/alertas');
// GET /direccion/proveedores/costos -> {por_rubro{}, por_moneda{},
// proveedores_contados}. Los montos vienen como STRING (Decimal serializado):
// no sumarlos en el front sin parsear.
export const costosProveedores = (token) => pedir(token, '/proveedores/costos');
export const crearProveedor = (token, datos) => pedir(token, '/proveedores', { metodo: 'POST', cuerpo: datos });
export const obtenerProveedor = (token, id) => pedir(token, `/proveedores/${encodeURIComponent(id)}`);
export const editarProveedor = (token, id, datos) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });
// Baja LÓGICA en el backend (sella eliminado_en y pasa a estado BAJA).
export const darDeBajaProveedor = (token, id) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}`, { metodo: 'DELETE' });

export const listarContactosProveedor = (token, id) =>
  lista(token, `/proveedores/${encodeURIComponent(id)}/contactos`);
export const crearContactoProveedor = (token, id, datos) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}/contactos`, { metodo: 'POST', cuerpo: datos });
export const listarTareasProveedor = (token, id) =>
  lista(token, `/proveedores/${encodeURIComponent(id)}/tareas`);
export const crearTareaProveedor = (token, id, datos) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}/tareas`, { metodo: 'POST', cuerpo: datos });
export const editarTareaProveedor = (token, id, tareaId, datos) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}/tareas/${encodeURIComponent(tareaId)}`,
    { metodo: 'PATCH', cuerpo: datos });
export const listarCoberturasProveedor = (token, id) =>
  lista(token, `/proveedores/${encodeURIComponent(id)}/coberturas`);
export const crearCoberturaProveedor = (token, id, datos) =>
  pedir(token, `/proveedores/${encodeURIComponent(id)}/coberturas`, { metodo: 'POST', cuerpo: datos });

// --- Seguridad -----------------------------------------------------------
export const listarHallazgos = (token, filtros = {}) =>
  lista(token, '/seguridad/hallazgos', { query: filtros });
export const crearHallazgo = (token, datos) =>
  pedir(token, '/seguridad/hallazgos', { metodo: 'POST', cuerpo: datos });
export const editarHallazgo = (token, codigo, datos) =>
  pedir(token, `/seguridad/hallazgos/${encodeURIComponent(codigo)}`, { metodo: 'PATCH', cuerpo: datos });

// Inventario de credenciales: NOMBRE, UBICACIÓN y FECHAS DE ROTACIÓN.
// El backend NO guarda ni devuelve el valor del secreto y contesta 422 si el
// cuerpo trae `valor`/`secret`/`password`/`token`/`key`
// (direccion.py::_rechazar_claves_prohibidas). El front no ofrece ese campo
// en ninguna parte: ver DireccionSeguridad.jsx y su test.
export const listarCredenciales = (token) => lista(token, '/seguridad/credenciales');
export const crearCredencial = (token, datos) =>
  pedir(token, '/seguridad/credenciales', { metodo: 'POST', cuerpo: datos });
export const editarCredencial = (token, id, datos) =>
  pedir(token, `/seguridad/credenciales/${encodeURIComponent(id)}`, { metodo: 'PATCH', cuerpo: datos });

// GET /api/v1/admin/salud (salud.py, fuera de /direccion). Estado global
// OK | DEGRADADO | ALERTA, con `senales_en_alerta[]`, `senales_degradadas[]`
// y el detalle de cada señal en `senales`.
export const saludSistema = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/admin/salud`, { headers: headers(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

export const historicoSalud = (token, dias = 30) =>
  lista(token, '/seguridad/salud/historico', { query: { dias } });
export const tomarSnapshotSalud = (token) =>
  lista(token, '/seguridad/salud/snapshot', { metodo: 'POST' });
