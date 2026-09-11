// Cliente HTTP del módulo "Cartera ART" (Bloque 5) - GET /art/empresas,
// GET /art/empresas/{cuit}, GET /art/desbloqueos, GET /art/tecnica-vencida y
// POST /art/estado (app/api/v1/art_consultas.py del backend). Mismo patrón
// que src/components/Mail/mailApi.js: fetch crudo + authHeader/formatApiError
// de utils/api, con normalizeList para los listados paginados (Page{total,
// items,limit,offset} - ver app/schemas/common.py del backend).
import { authHeader, formatApiError, normalizeList } from '../../utils/api';

export const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

const artHeaders = (token) => ({ ...authHeader(token), 'Content-Type': 'application/json' });

// Arma el query string salteando params undefined/null/'' para no mandar
// filtros vacíos como querystring literal (ej. ciiu='' no debe ser ?ciiu=).
//
// Un array se serializa REPETIDO (`?fuente=A&fuente=B`), que es la forma que
// espera FastAPI para un `Query(List[str])` - ver el filtro `fuente` de
// /art/performance-companias. Un array vacío no manda nada: es "sin filtro",
// y mandar `fuente=` sería un 422.
const buildQuery = (params = {}) => {
  const qs = new URLSearchParams();
  const vacio = (v) => v === undefined || v === null || v === '';
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => { if (!vacio(item)) qs.append(key, item); });
    } else if (!vacio(value)) {
      qs.set(key, value);
    }
  });
  const str = qs.toString();
  return str ? `?${str}` : '';
};

// Normaliza el término del buscador (`q`) antes de mandarlo.
//
// EL BUG QUE CIERRA: `empresas.cuit` tiene los dos formatos conviviendo en
// la base - con guiones ("30-71000001-7") y sin ellos ("30710000017"),
// según por dónde entró la empresa. Buscar un CUIT tipeado con guiones
// encontraba sólo la mitad de la cartera y la pantalla decía "sin
// resultados", que se lee como "esa empresa no está".
//
// Si lo tipeado es SÓLO dígitos y separadores de CUIT (guiones, puntos,
// espacios), se mandan los dígitos pelados; cualquier otra cosa - una
// razón social - viaja tal cual, incluidas las que llevan números
// ("ACME 2000"). El backend normaliza igual por su cuenta
// (app/api/v1/art_consultas.py::_filtro_busqueda): esto le ahorra el
// viaje al caso más común, no lo reemplaza.
export const normalizarBusqueda = (q) => {
  const texto = (q ?? '').trim();
  if (!texto) return texto;
  if (!/^[\d\s.-]+$/.test(texto)) return texto;
  return texto.replace(/\D/g, '') || texto;
};

// GET /art/empresas - listado server-side paginado de la cartera ART.
// `filtros` acepta: ciiu, provincia, dotacion_min, dotacion_max,
// riesgo_suscripcion, estado_efectivo, aseguradora, estrategia_art, q,
// order_by, limit, offset (ver app/api/v1/art_consultas.py).
export const listarEmpresasArt = async (token, filtros = {}) => {
  const params = 'q' in filtros ? { ...filtros, q: normalizarBusqueda(filtros.q) } : filtros;
  const res = await fetch(`${API_URL}/api/v1/art/empresas${buildQuery(params)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/empresas/{cuit} - ficha + matriz de 19 aseguradoras + historial +
// cálculo del motor. Devuelve el objeto completo tal cual lo manda el
// backend: {empresa, aseguradoras, historial, calculo, calculo_bloqueado_por}.
export const obtenerEmpresaArt = async (token, cuit) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/empresas/{cuit}/documentos?tipo= - checklist de documentos
// adjuntos (FORM_931/POLIZA_ACTUAL/OTRO). APPEND-ONLY en el backend (cada
// subida crea una fila nueva, nunca pisa la anterior): devuelve TODAS las
// filas ordenadas created_at desc, así que la primera fila de cada `tipo`
// es la vigente - ver app/models/crm/empresa_documento.py del backend. No
// es un envelope Page: el backend devuelve el array directo.
export const listarDocumentosArt = async (token, cuit, { tipo } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos${buildQuery({ tipo })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/empresas/{cuit}/documentos - multipart/form-data (Form `tipo` +
// File `archivo`). Subir el archivo marca conseguido=true automáticamente
// en el backend - ver docstring de subir_documento_empresa_art en
// app/api/v1/art_consultas.py. Ojo: NO se manda Content-Type a mano, el
// browser arma el boundary del multipart solo si dejamos que fetch lo
// infiera de un body FormData.
export const subirDocumentoArt = async (token, cuit, { tipo, archivo }) => {
  const body = new FormData();
  body.set('tipo', tipo);
  body.set('archivo', archivo);
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos`, {
    method: 'POST',
    headers: authHeader(token),
    body,
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// PATCH /art/empresas/{cuit}/documentos/{tipo}/conseguido - sin archivo, para
// cuando el cliente confirma verbalmente que ya tiene el documento antes de
// mandar el PDF. Idempotente: el backend reusa la fila vigente de ese tipo
// o crea una fila placeholder sin archivo - ver docstring de
// marcar_documento_empresa_art_conseguido en app/api/v1/art_consultas.py.
export const marcarDocumentoArtConseguido = async (token, cuit, tipo) => {
  const res = await fetch(`${API_URL}/api/v1/art/empresas/${encodeURIComponent(cuit)}/documentos/${encodeURIComponent(tipo)}/conseguido`, {
    method: 'PATCH',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/desbloqueos?dias=N - leads calientes: bloqueos que caducan dentro
// de los próximos N días.
export const listarDesbloqueos = async (token, { dias = 7, limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/desbloqueos${buildQuery({ dias, limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/tecnica-vencida - reclamos TECNICA cuyo SLA ya venció sin
// respuesta posterior de la aseguradora.
export const listarTecnicaVencida = async (token, { limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/tecnica-vencida${buildQuery({ limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// POST /art/estado - registra un evento nuevo (append-only) para
// empresa+aseguradora. `payload`: {cuit, aseguradora, tipo, alicuota?,
// motivo?, productor_bloqueante?, fecha_evento?, dias_vigencia?, dias_sla?,
// fuente?, nota?}. Devuelve {registro, riesgo_suscripcion}.
export const registrarEstadoArt = async (token, payload) => {
  const res = await fetch(`${API_URL}/api/v1/art/estado`, {
    method: 'POST',
    headers: artHeaders(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/referencial-tarifas - referencial HISTÓRICO de mercado (BLOQUE
// 7): únicamente fuente=PLANILLA_2025, agrupado SIEMPRE por CIIU x tramo
// de dotación x provincia normalizada, más `resumen_global` (total de
// registros y promedio/mediana sobre TODO el universo filtrado, no solo
// por celda) - ver app/schemas/art_dashboard.py::ReferencialTarifasResponse.
// `filtros` acepta: ciiu, provincia, tramo_dotacion, aseguradora. A
// propósito NO trae "ganadora"/"perdedora": esa etiqueta describía el
// resultado real de cada cotización en la planilla original y hoy no
// existe como columna - ver docstring de
// app/services/art_dashboard.py::referencial_tarifas.
export const obtenerReferencialTarifas = async (token, filtros = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/referencial-tarifas${buildQuery(filtros)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  const { items, total } = normalizeList(data);
  return { total, items, resumen_global: data?.resumen_global ?? null };
};

// GET /art/leads-sin-cobertura - empresas verificadas SIN ART vigente que
// tuvieron cobertura antes (lead caliente: perdió cobertura, no "nunca
// tuvo") - ver app/schemas/art_consultas.py::LeadSinCoberturaItem. El
// backend ya ordena (con historial, más reciente primero; sin historial,
// alfabético al final) - el cliente no reordena. `motivo_fin` es substring
// case-insensitive contra el motivo de baja del último contrato.
export const listarLeadsSinCobertura = async (token, { motivo_fin, limit = 50, offset = 0 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/leads-sin-cobertura${buildQuery({ motivo_fin, limit, offset })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return normalizeList(await res.json());
};

// GET /art/analisis - estadística agregada de toda la cartera: tarjetas de
// dotación/masa salarial/LRTM/tarifa/comisión (total/promedio/mediana),
// distribución por riesgo de suscripción y por estrategia, y "cartera a
// defender" (empresas ACTUAL por aseguradora, ya ordenada por comisión
// anual estimada descendente) - ver
// app/schemas/art_dashboard.py::AnalisisARTResponse.
export const obtenerAnalisisArt = async (token) => {
  const res = await fetch(`${API_URL}/api/v1/art/analisis`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/mercado?periodo - cartera propia (mismo cálculo que "cartera a
// defender") comparada contra el boletín SSN/SRT importado con
// POST /art/mercado/importar. `mercado_sin_datos: true` si no hay ningún
// período cargado (o el pedido no existe) - en ese caso los campos de
// mercado/share de cada item vienen en null, NUNCA inventados. Si se omite
// `periodo`, el backend usa el último importado - ver
// app/schemas/art_dashboard.py::MercadoARTResponse.
export const obtenerMercadoArt = async (token, { periodo } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/mercado${buildQuery({ periodo })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/cola-alicuotas?limit=N - tanda de empresas para el "Modo
// Relevamiento" (carga rápida de alícuotas por teléfono): empresas con ART
// confirmada por SRT y sin evento ALICUOTA vigente. `total` es el tamaño
// real del universo pendiente, SIN el recorte de `limit` - ver
// app/schemas/art_consultas.py::ColaAlicuotasResponse.
export const obtenerColaAlicuotas = async (token, { limit = 20 } = {}) => {
  const res = await fetch(`${API_URL}/api/v1/art/cola-alicuotas${buildQuery({ limit })}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/alicuotas/carga-rapida - registra en lote el resultado de una
// tanda del Modo Relevamiento. `items`: [{empresa_id, alicuota_pct?,
// art_declarada?, sin_dato}]. Append-only e idempotente por empresa_id +
// fecha_evento (ver app/schemas/art_consultas.py::CargaRapidaAlicuotasResponse).
export const registrarCargaRapidaAlicuotas = async (token, items) => {
  const res = await fetch(`${API_URL}/api/v1/art/alicuotas/carga-rapida`, {
    method: 'POST',
    headers: artHeaders(token),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/empresas/{id}/grilla - grilla de cotización (BLOQUE 1.2):
// cabecera (masa estimada con su confianza, tarifa actual "a confirmar",
// ART actual, riesgo de suscripción), una fila por aseguradora ACTIVA del
// catálogo y `ranking`/`mejor_oferta`.
//
// OJO: va por `id` (UUID de la empresa), NO por CUIT como el resto de este
// módulo. El id sale de `empresa.id` de la ficha (GET /art/empresas/{cuit},
// campo EmpresaARTFicha.id) - es de donde se abre esta pantalla.
//
// Todos los importes pueden venir en null: cuando el backend no pudo
// estimar la masa, `advertencias` trae 'SIN_MASA' y los pesos NO se
// calculan. No reemplazar esos null por 0 al renderizar - un cero se lee
// como "no ahorra nada" y acá significa "no sabemos" (ver el docstring de
// app/services/grilla_art.py del backend).
export const obtenerGrillaArt = async (token, empresaId) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(empresaId)}/grilla`,
    { headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/empresas/{id}/f931?dry_run=false - carga el F.931 declarado
// (masa salarial mensual, dotación y período 'YYYY-MM'). A partir de acá la
// masa de esa empresa deja de estimarse: pasa a confianza CONFIRMADA.
//
// `dry_run` va SIEMPRE en la query string, nunca en el body: mandarlo en el
// body es 422 (ESTANDAR-API-AYMA-v1.0, ver app/api/dry_run.py del backend).
// Se manda explícito en `false` porque el default del backend es la corrida
// en seco - omitirlo devolvería 200 sin haber escrito nada.
export const cargarF931Art = async (token, empresaId, { masa_salarial, dotacion, periodo }) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(empresaId)}/f931?dry_run=false`,
    {
      method: 'POST',
      headers: artHeaders(token),
      body: JSON.stringify({ masa_salarial, dotacion, periodo }),
    },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// DELETE /art/empresas/{id}/f931?dry_run=false - da de baja el F.931
// declarado: la empresa vuelve a masa ESTIMADA.
//
// Existe porque el F.931 se carga a mano y a mano se equivoca (un período
// viejo, la masa de otra empresa, un dígito de más), y un dato declarado
// equivocado es PEOR que ninguno: deja la masa en confianza CONFIRMADA y
// habilita a aceptar propuestas sobre un número inventado.
//
// `dry_run` va SIEMPRE en la query string y se manda explícito en `false`,
// igual que en la carga: el default del backend es la corrida en seco, así
// que omitirlo devolvería 200 sin haber borrado nada. 409 si no había
// F.931 cargado.
//
// NO recalcula las propuestas ya armadas (congelan sus insumos); la
// respuesta trae `propuestas_afectadas` con las que están en BORRADOR
// apoyadas en ese F.931.
export const quitarF931Art = async (token, empresaId) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(empresaId)}/f931?dry_run=false`,
    { method: 'DELETE', headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// ---------------------------------------------------------------------------
// Propuestas ART (BLOQUE 1.3) - app/api/v1/art_propuestas.py del backend.
//
// Una propuesta es una fila de la grilla ya CONGELADA: la alícuota que se
// ofreció, sobre qué masa salarial, con qué parámetros y con qué resultado
// para el cliente. La grilla se recalcula sola en cada request; una
// propuesta entregada no cambia nunca - es lo que se le dijo a una empresa
// un día determinado, con un PDF en su poder.
//
// Igual que la grilla, todas estas rutas van por `id` de empresa (UUID),
// no por CUIT.
// ---------------------------------------------------------------------------

// POST /art/empresas/{id}/propuestas - arma una propuesta en BORRADOR.
// Devuelve {propuesta, advertencias}: `advertencias` son los supuestos que
// hubo que hacer (masa estimada, sin tarifa actual, comisión bajo umbral).
// Ninguno impide crearla, pero se muestran - son la diferencia entre una
// cotización presentable y una que hay que confirmar antes.
//
// 409 cuando la empresa no tiene masa salarial estimable: el backend NO
// arma una propuesta con el LRT en cero.
export const crearPropuestaArt = async (token, empresaId, payload) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(empresaId)}/propuestas`,
    { method: 'POST', headers: artHeaders(token), body: JSON.stringify(payload) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/empresas/{id}/propuestas - el historial completo de lo que se le
// ofreció a una empresa, de la versión más nueva a la más vieja. No está
// paginado en el backend (son unidades por empresa), así que devuelve
// {total, items} y no un Page con limit/offset.
export const listarPropuestasArt = async (token, empresaId) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/empresas/${encodeURIComponent(empresaId)}/propuestas`,
    { headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/propuestas/{id} - el detalle, con `estado_efectivo` y
// `dias_restantes` ya calculados por el backend.
//
// OJO con `estado_efectivo`: puede decir VENCIDA aunque `estado` diga
// BORRADOR o ENTREGADA. La vencida se calcula al leer (valida_hasta < hoy),
// no la escribe ningún proceso - por eso hay que mostrar SIEMPRE
// `estado_efectivo` y nunca `estado` a secas.
export const obtenerPropuestaArt = async (token, propuestaId) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}`,
    { headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// PUT /art/propuestas/{id} - edita un BORRADOR y recalcula la cadena.
// 409 sobre cualquier propuesta que ya no esté en BORRADOR: una entregada
// está en manos del cliente y es inmutable.
export const actualizarPropuestaArt = async (token, propuestaId, payload) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}`,
    { method: 'PUT', headers: artHeaders(token), body: JSON.stringify(payload) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/propuestas/{id}/estado - BORRADOR->ENTREGADA,
// ENTREGADA->ACEPTADA|RECHAZADA. Cualquier otro par es 409, igual que
// ACEPTADA sin F.931 cargado ("cargar F.931 primero"): esos mensajes se
// muestran tal cual llegan, son la instrucción de qué hacer.
//
// `nota` es el motivo del movimiento (BLOQUE 1.5): el backend lo asienta en
// la bitácora `notas` con el estado NUEVO y el usuario, y SÓLO si la
// transición se acepta - un 409 hace rollback y no anota nada. Para el
// backend es opcional; la pantalla lo exige en ACEPTADA y RECHAZADA (ver
// ArtPropuestaDetalle.jsx), que son los dos desenlaces que después hay que
// poder explicar.
//
// Si no viene nota, el body sale con `estado` solo y no con `nota: null`:
// una nota vacía y una nota ausente son lo mismo para el backend, y mandar
// la clave de más sólo hace ruido en el log.
export const cambiarEstadoPropuestaArt = async (token, propuestaId, estado, nota) => {
  const limpia = (nota ?? '').trim();
  const body = limpia ? { estado, nota: limpia } : { estado };
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}/estado`,
    { method: 'POST', headers: artHeaders(token), body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// PATCH /art/propuestas/{id}/nota - agrega UNA entrada a la bitácora
// `notas`, en cualquier estado (incluidas ENTREGADA, ACEPTADA, RECHAZADA y
// ANULADA). Devuelve la propuesta, no el envelope {propuesta,
// advertencias}: una nota no genera advertencias porque no recalcula nada.
//
// Es la única escritura que acepta una propuesta que ya salió de la
// oficina y NO rompe la inmutabilidad: no toca un número, ni una fecha, ni
// el estado, ni el PDF archivado ni su hash. Lo que se ofreció sigue
// siendo lo que dice el papel que tiene el cliente; la bitácora cuenta lo
// que pasó DESPUÉS.
//
// Append-only: no hay endpoint para editar ni borrar una entrada. 422 con
// la nota vacía o sólo espacios.
export const agregarNotaPropuestaArt = async (token, propuestaId, nota) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}/nota`,
    { method: 'PATCH', headers: artHeaders(token), body: JSON.stringify({ nota }) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// POST /art/propuestas/{id}/anular - anula la propuesta con un motivo
// OBLIGATORIO. Devuelve la propuesta ya anulada (no el envelope
// {propuesta, advertencias}: las advertencias del armado/entrega ya no
// describen a una propuesta que salió del circuito).
//
// Endpoint aparte de /estado justamente por el motivo: aquel no lo recibe,
// y anular sin decir por qué deja una propuesta desaparecida de la vista
// que es indistinguible de un dato perdido. 409 desde ACEPTADA, RECHAZADA
// o ANULADA (ya tuvieron desenlace); 422 con motivo vacío.
export const anularPropuestaArt = async (token, propuestaId, motivo) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}/anular`,
    { method: 'POST', headers: artHeaders(token), body: JSON.stringify({ motivo }) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/propuestas/{id}/pdf - el PDF que recibe la empresa.
//
// Va por fetch con el header de Authorization y NO como un <a href>: la
// ruta es admin-only con JWT, y un link plano del browser no manda el
// token (mismo motivo por el que no se expone una URL pública del
// archivo). Devuelve el Blob; el componente decide si lo descarga o lo
// abre.
export const descargarPdfPropuestaArt = async (token, propuestaId) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/propuestas/${encodeURIComponent(propuestaId)}/pdf`,
    { headers: authHeader(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.blob();
};

// ---------------------------------------------------------------------------
// Performance por compañía (BLOQUE 2) - app/api/v1/art_performance.py del
// backend (PR #102). Tres rutas de SOLO LECTURA, todas admin-only con JWT.
//
// OJO CON LOS NOMBRES: acá `benchmark_ganadora` es "esa compañía cotizó por
// debajo de lo que la empresa paga hoy", NO "AYMA se quedó con la cuenta"
// (eso lo contesta GET /art/embudo, con otro criterio). La pantalla repite
// la aclaración como leyenda fija - un "ganadora" sin su definición al lado
// ya costó un bloque entero en el tablero de gestión.
// ---------------------------------------------------------------------------

const PERFORMANCE_PATH = '/api/v1/art/performance-companias';

// GET /art/performance-companias - tablero agregado. `filtros`: desde,
// hasta, incluir_caducados, seccion, tramo, fuente (array; se serializa
// repetido, ver buildQuery). Devuelve {parametros, totales,
// companias, advertencias}: `companias` trae UNA entrada por cada
// aseguradora activa del catálogo, incluidas las de 0 eventos, así que la
// pantalla no arma la lista por su cuenta (son 19 hoy y el catálogo se
// mueve - ver app/models/crm/empresa_art_estado.py).
//
// `incluir_caducados` viaja también cuando es `false`: es un booleano, no
// un filtro vacío, y omitirlo haría que el backend aplique su default
// (true) justo cuando el operador pidió lo contrario. `fuente` viaja igual
// de explícito: el default del backend es PLANILLA_2025 + MANUAL (la SRT
// verifica el padrón, no cotiza) y lo excluido vuelve contado en
// `eventos_excluidos_por_fuente`.
export const obtenerPerformanceCompanias = async (token, filtros = {}) => {
  const res = await fetch(`${API_URL}${PERFORMANCE_PATH}${buildQuery(filtros)}`, { headers: artHeaders(token) });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/performance-companias?formato=csv - el MISMO corte que se está
// viendo, serializado por el backend (una fila por compañía × tramo).
//
// Va por fetch con el header de Authorization y NO como un <a href>: la
// ruta es admin-only con JWT y un link plano del browser no manda el
// token - devolvería el HTML del login o un 401, y el archivo bajaría
// igual, corrupto. Mismo motivo que en descargarPdfPropuestaArt. Devuelve
// el Blob; el componente arma la descarga.
export const descargarCsvPerformanceCompanias = async (token, filtros = {}) => {
  const res = await fetch(
    `${API_URL}${PERFORMANCE_PATH}${buildQuery({ ...filtros, formato: 'csv' })}`,
    { headers: authHeader(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.blob();
};

// GET /art/performance-companias/{aseguradora}/eventos - drill-down: las
// filas crudas detrás de un número del tablero. `filtros`: tipo, resultado,
// tramo, motivo, desde, hasta, fuente (array), page, size. Devuelve {aseguradora, total,
// page, size, items}.
//
// Este endpoint incluye SIEMPRE los eventos caducados (el histórico ya
// caducó entero, ESPEC §3.3: filtrarlos dejaría el detalle vacío) y no
// acepta `incluir_caducados`. Cada fila trae `vigente` para distinguirlos.
export const listarEventosPerformanceCompania = async (token, aseguradora, filtros = {}) => {
  const res = await fetch(
    `${API_URL}${PERFORMANCE_PATH}/${encodeURIComponent(aseguradora)}/eventos${buildQuery(filtros)}`,
    { headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

// GET /art/performance-companias/{aseguradora}/eventos?formato=csv - mismo
// contrato de descarga que el CSV del tablero (fetch con Authorization,
// nunca un <a href>).
export const descargarCsvEventosPerformanceCompania = async (token, aseguradora, filtros = {}) => {
  const res = await fetch(
    `${API_URL}${PERFORMANCE_PATH}/${encodeURIComponent(aseguradora)}/eventos${buildQuery({ ...filtros, formato: 'csv' })}`,
    { headers: authHeader(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.blob();
};

// ---------------------------------------------------------------------------
// Catálogo CIIU (bloque D3) - GET /art/ciiu?q= (app/api/v1/art_ciiu.py del
// backend, PR #104). SOLO LECTURA y, a diferencia del resto de /art/*, no es
// admin-only: lo consulta cualquier usuario autenticado.
// ---------------------------------------------------------------------------

// Tope duro del backend (MAX_RESULTADOS_BUSQUEDA_CIIU): pedir más devuelve
// 422, así que el valor vive acá y no en cada pantalla.
export const MAX_RESULTADOS_CIIU = 50;

// Devuelve {total, items:[{codigo, descripcion, seccion, en_catalogo_vigente}],
// limit, truncado}. `total` es el universo REAL de coincidencias: cuando es
// mayor que items.length hay resultados afuera del tope y el término hay que
// afinarlo (`truncado` lo dice explícito).
export const buscarCiiu = async (token, q, { limit = MAX_RESULTADOS_CIIU } = {}) => {
  const res = await fetch(
    `${API_URL}/api/v1/art/ciiu${buildQuery({ q, limit })}`,
    { headers: artHeaders(token) },
  );
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
