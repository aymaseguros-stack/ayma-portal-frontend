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
// 3. **El agrupado por categoría en la subida.** El endpoint recibe UNA
//    categoría por request, así que un lote con categorías distintas se manda
//    en un request por categoría. Por eso la validación es previa y total: si
//    un archivo del lote es inválido no sale ningún request.
import { authHeader, formatApiError } from '../../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'https://ayma-portal-backend.onrender.com';

export const TAMANO_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ARCHIVOS = 5;

export const CATEGORIAS_ADJUNTO = [
  'F931', 'POLIZA', 'COTIZACION', 'PROPUESTA',
  'DNI_CEDULA', 'CONSTANCIA', 'CHAT', 'OTRO',
];
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
// Devuelve { adjuntos, duplicados } acumulado de todos los requests.
export const subirAdjuntos = async (token, elegidos, entidades) => {
  const porCategoria = new Map();
  for (const item of elegidos) {
    const categoria = item.categoria || CATEGORIA_DEFAULT;
    if (!porCategoria.has(categoria)) porCategoria.set(categoria, []);
    porCategoria.get(categoria).push(item);
  }

  const adjuntos = [];
  const duplicados = [];
  for (const [categoria, items] of porCategoria) {
    const body = new FormData();
    for (const item of items) body.append('archivos', item.archivo, item.nombre);
    body.append('categoria', categoria);
    for (const [campo, valor] of entidadesForm(entidades)) body.append(campo, valor);

    const res = await fetch(`${API_URL}/api/v1/crm/adjuntos`, {
      method: 'POST',
      headers: authHeader(token),
      body,
    });
    if (!res.ok) throw new Error(await formatApiError(res));
    const data = await res.json();
    adjuntos.push(...(data.adjuntos || []));
    duplicados.push(...(data.duplicados || []));
  }
  return { adjuntos, duplicados };
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
