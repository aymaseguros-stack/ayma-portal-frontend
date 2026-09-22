// Adjuntos del CRM (backend: app/api/v1/crm_adjuntos.py, PR #166).
//
// Tres cosas viven acá y no en los componentes:
//
// 1. **Las mismas reglas que valida el backend, antes de subir.** Tipo real
//    por firma de bytes (un .exe renombrado a .pdf pasa cualquier chequeo de
//    extensión y de `file.type`, que lo pone el navegador), 10 MB por archivo
//    y 5 archivos por interacción. Validar acá no reemplaza al backend: evita
//    el viaje y, sobre todo, deja mostrar el motivo exacto del rechazo.
// 2. **La descarga autenticada.** Nunca un <a href> ni una URL compartible:
//    son datos personales (Ley 25.326) y el backend solo los entrega por un
//    stream con el token de sesión. Acá se hace fetch + blob + objectURL
//    efímero.
// 3. **La subida del lote en UN SOLO request.** El endpoint acepta
//    `categorias`: una lista PARALELA a `archivos`, un valor por archivo y en
//    el mismo orden (app/api/v1/crm_adjuntos.py::_resolver_categorias). Antes
//    se mandaba un request por grupo de categoría, y eso rompía la garantía
//    del endpoint: el backend no persiste nada si un archivo del lote falla,
//    pero con tres requests el tercero podía fallar dejando los seis archivos
//    de los dos primeros ya subidos a Drive. Con un request, "todo o nada"
//    vuelve a valer para el lote entero. Por eso la validación previa es
//    total: si un archivo es inválido no sale ningún request.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

export const TAMANO_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVOS = 5;

// El catálogo de categorías, AGRUPADO y en orden de ciclo de vida. Espejo de
// app/models/crm/adjunto.py::GRUPOS_CATEGORIAS, que es la fuente: el backend
// lo sirve en GET /api/v1/crm/adjuntos/categorias y con eso se puede cotejar
// esta copia sin leer su fuente. Se mantiene acá -y no se pide por red- para
// que el desplegable se dibuje sin esperar un request y para que la copia
// viva en un archivo que el diff del PR muestra.
//
// POR QUÉ AGRUPADO. Con 15 categorías, una lista plana obliga a leerlas todas
// para elegir, y lo que se elige cuando no se encuentra la propia es OTRO -
// que es el cajón del que este paquete viene a sacar al certificado
// provisorio, las fotos de inspección, la tarjeta azul y la cédula verde.
export const GRUPOS_CATEGORIAS = [
  { grupo: 'Comercial', categorias: [
    ['COTIZACION', 'Cotización'],
    ['PROPUESTA', 'Propuesta'],
    ['CHAT', 'Conversación / chat'],
  ] },
  { grupo: 'Emisión', categorias: [
    ['ORDEN_EMISION', 'Orden de emisión'],
    ['CERTIFICADO_PROVISORIO', 'Certificado provisorio'],
    ['CERTIFICADO_COBERTURA', 'Certificado de cobertura'],
    ['POLIZA', 'Póliza'],
  ] },
  { grupo: 'Riesgo', categorias: [
    ['TARJETA_AZUL', 'Tarjeta azul (datos del riesgo)'],
    ['CEDULA_VERDE', 'Cédula verde'],
    ['FOTO_INSPECCION', 'Foto de inspección'],
  ] },
  { grupo: 'Identidad', categorias: [
    ['DNI_CEDULA', 'DNI / cédula'],
    ['CONSTANCIA', 'Constancia'],
  ] },
  { grupo: 'Cobro', categorias: [
    ['COMPROBANTE_PAGO', 'Comprobante de pago'],
  ] },
  { grupo: 'ART', categorias: [
    ['F931', 'F931'],
  ] },
  { grupo: 'Otros', categorias: [
    ['OTRO', 'Otro'],
  ] },
];

// Derivada, nunca escrita a mano: dos listas que hay que mantener iguales se
// desincronizan a la primera categoría nueva.
export const CATEGORIAS_ADJUNTO = GRUPOS_CATEGORIAS
  .flatMap(({ categorias }) => categorias.map(([valor]) => valor));

const TITULOS = Object.fromEntries(
  GRUPOS_CATEGORIAS.flatMap(({ categorias }) => categorias),
);

// Un adjunto viejo puede tener una categoría que el catálogo ya no ofrece:
// se muestra su código tal cual, nunca vacío.
export const tituloCategoria = (valor) => TITULOS[valor] || valor || '';

export const CATEGORIA_DEFAULT = 'OTRO';

// Mismas firmas que app/services/crm_adjuntos.py::FIRMAS.
const FIRMAS = [
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d], mime: 'application/pdf' },            // %PDF-
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: 'image/png' },
  { bytes: [0xff, 0xd8, 0xff], mime: 'image/jpeg' },                             // JPEG SOI
];

export const detectarMime = (bytes) => {
  for (const { bytes: firma, mime } of FIRMAS) {
    if (firma.every((b, i) => bytes[i] === b)) return mime;
  }
  return null;
};

export const formatBytes = (n) => {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) return '';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(0)} KB`;
  return `${(num / (1024 * 1024)).toFixed(1)} MB`;
};

const primerosBytes = async (archivo) => {
  const trozo = archivo.slice(0, 8);
  const buffer = await trozo.arrayBuffer();
  return new Uint8Array(buffer);
};

// Motivo exacto del rechazo, en el mismo idioma que el backend.
export const validarArchivo = async (archivo) => {
  const nombre = archivo?.name || 'archivo';
  if (!archivo || archivo.size === 0) return { ok: false, motivo: `"${nombre}": el archivo está vacío` };
  if (archivo.size > TAMANO_MAX_BYTES) {
    return {
      ok: false,
      motivo: `"${nombre}": pesa ${formatBytes(archivo.size)} y el máximo es 10 MB por archivo`,
    };
  }
  const mime = detectarMime(await primerosBytes(archivo));
  if (!mime) {
    return {
      ok: false,
      motivo: `"${nombre}": solo se aceptan PDF, JPG y PNG (se valida el contenido del archivo, no la extensión)`,
    };
  }
  return { ok: true, mime };
};

// Valida un lote nuevo contra los ya elegidos. Devuelve { aceptados, errores }:
// los aceptados nacen con categoría OTRO, que el usuario puede cambiar.
export const validarSeleccion = async (nuevos, yaElegidos = []) => {
  const aceptados = [];
  const errores = [];
  let cupo = MAX_ARCHIVOS - yaElegidos.length;

  for (const archivo of nuevos) {
    if (cupo <= 0) {
      errores.push(`"${archivo.name}": son 5 archivos como máximo por interacción`);
      continue;
    }
    const resultado = await validarArchivo(archivo);
    if (!resultado.ok) { errores.push(resultado.motivo); continue; }
    cupo -= 1;
    aceptados.push({
      id: `${archivo.name}-${archivo.size}-${archivo.lastModified || 0}-${cupo}`,
      archivo,
      nombre: archivo.name,
      tamano: archivo.size,
      mime: resultado.mime,
      categoria: CATEGORIA_DEFAULT,
    });
  }
  return { aceptados, errores };
};

const entidadesForm = (entidades) => Object.entries(entidades || {})
  .filter(([, valor]) => Boolean(valor));

// Sube el lote. `elegidos` son ítems de validarSeleccion (con su categoría) y
// `entidades` las FKs: alcanza con interaccion_id, el backend hereda
// oportunidad/persona/empresa de ahí (no duplicar esa lógica acá).
// Devuelve { adjuntos, duplicados } del único request del lote.
export const subirAdjuntos = async (token, elegidos, entidades) => {
  const body = new FormData();
  // Las dos listas van en el MISMO orden: el backend exige exactamente un
  // valor de `categorias` por archivo y contesta 422 si las longitudes no
  // coinciden. Una lista más corta "completada" con el default es cómo un
  // DNI termina archivado como OTRO sin que nadie se entere.
  for (const item of elegidos) {
    body.append('archivos', item.archivo, item.nombre);
    body.append('categorias', item.categoria || CATEGORIA_DEFAULT);
  }
  for (const [campo, valor] of entidadesForm(entidades)) body.append(campo, valor);

  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos`, {
    method: 'POST',
    headers: authHeader(token),
    body,
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return { adjuntos: data.adjuntos || [], duplicados: data.duplicados || [] };
};

export const listarAdjuntos = async (token, filtros) => {
  const params = new URLSearchParams();
  for (const [campo, valor] of entidadesForm(filtros)) params.append(campo, valor);
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos?${params.toString()}`, {
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.items || []);
};

// 410 = el adjunto fue anulado: es un estado esperable, no un error de red.
export const descargarAdjunto = async (token, adjunto) => {
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos/${adjunto.id}/descargar`, {
    headers: authHeader(token),
  });
  if (res.status === 410) throw new Error('Adjunto anulado');
  if (!res.ok) throw new Error(await formatApiError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = adjunto.nombre_original || 'adjunto';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
};

export const anularAdjunto = async (token, adjuntoId) => {
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos/${adjuntoId}`, {
    method: 'DELETE',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};

export const agruparPorInteraccion = (adjuntos) => {
  const mapa = {};
  for (const a of adjuntos) {
    if (!a.interaccion_id) continue;
    (mapa[a.interaccion_id] ||= []).push(a);
  }
  return mapa;
};

// Solo los íconos que existen en components/Icons.jsx.
export const ICONO_MIME = {
  'application/pdf': 'document-text',
  'image/png': 'clipboard',
  'image/jpeg': 'clipboard',
};

export const iconoDeMime = (mime) => ICONO_MIME[mime] || 'document-text';

// Reintento de la subida a Drive de UN archivo (C-6n,
// POST /crm/adjuntos/{id}/reintentar-subida). No sube desde acá: el backend
// reencola el mismo camino que la subida automática, que lee los bytes
// conservados.
//
// EL 409 NO ES UN ERROR DE RED y hay tres: ya está en Drive, fue purgado, o
// no quedó copia del archivo en el portal -los adjuntos anteriores a C-6n no
// la tienen y hay que volver a pedírselos al cliente-. El mensaje del
// backend dice cuál es, así que se muestra tal cual en vez de traducirlo: es
// el backend el que sabe si hay algo con qué reintentar, y esta pantalla no
// tiene el dato (`AdjuntoResponse` no declara `binario_conservado`).
export const reintentarSubidaAdjunto = async (token, adjuntoId) => {
  const res = await fetch(`${API_URL}/api/v1/crm/adjuntos/${adjuntoId}/reintentar-subida`, {
    method: 'POST',
    headers: authHeader(token),
  });
  if (!res.ok) throw new Error(await formatApiError(res));
  return res.json();
};
