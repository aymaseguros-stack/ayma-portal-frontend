// Vocabulario de "Fuentes de datos" (@PAZ, OPERACIONES-0016).

// Las 24 jurisdicciones en su forma CANÓNICA, que es lo que el backend
// guarda en `provincia_default` y contra lo que compara en el match.
// ORIGEN: app/services/geografia.py::_PROVINCIAS del backend, en f5e21d1
// (PR #243). Si esa tupla cambia, esta lista se actualiza en el mismo
// momento: un valor que acá existe y allá no es un 422 en el alta.
export const PROVINCIAS_AR = [
  'BUENOS AIRES', 'CABA', 'CATAMARCA', 'CHACO', 'CHUBUT', 'CORDOBA',
  'CORRIENTES', 'ENTRE RIOS', 'FORMOSA', 'JUJUY', 'LA PAMPA', 'LA RIOJA',
  'MENDOZA', 'MISIONES', 'NEUQUEN', 'RIO NEGRO', 'SALTA', 'SAN JUAN',
  'SAN LUIS', 'SANTA CRUZ', 'SANTA FE', 'SANTIAGO DEL ESTERO',
  'TIERRA DEL FUEGO', 'TUCUMAN',
];

// worker_paz.PREFIJO_CODIGO_DIRECTORIO: el código se tipea sin prefijo.
export const PREFIJO_DIRECTORIO = 'DIRECTORIO_';

// Los tipos que un directorio puede aportar (mail y decisor sólo salen de
// WEB_CORPORATIVA).
export const TIPOS_DIRECTORIO = ['TELEFONO', 'WEB'];

// Límites del backend (AltaDirectorioRequest + worker_paz.alta_directorio).
export const DELAY_MAX_S = 3600;
export const MAX_PAGINAS_MAX = 500;

// Lo que el operador tipea -con o sin el prefijo, en minúsculas- tal como
// lo va a guardar el backend.
export const slugDirectorio = (texto) => {
  let s = String(texto || '').trim().toUpperCase();
  if (s.startsWith(PREFIJO_DIRECTORIO)) s = s.slice(PREFIJO_DIRECTORIO.length);
  return s;
};

export const codigoGuardado = (texto) => `${PREFIJO_DIRECTORIO}${slugDirectorio(texto)}`;

export const slugValido = (texto) => /^[A-Z0-9_]{3,40}$/.test(slugDirectorio(texto));

const esUrl = (v) => /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(String(v || '').trim());

const enteroEnRango = (v, min, max) => {
  if (v === '' || v === null || v === undefined) return true;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max;
};

// Validación previa al pedido. El backend valida igual (y es el que manda):
// esto sólo evita un viaje para un error obvio.
export const erroresDirectorio = (f) => {
  const e = {};
  if (!slugValido(f.codigo)) e.codigo = '3 a 40 caracteres: A-Z, 0-9 o _.';
  if (!String(f.nombre || '').trim()) e.nombre = 'Obligatorio.';
  if (!esUrl(f.url_semilla)) e.url_semilla = 'Tiene que ser una URL http(s).';
  if (!esUrl(f.terminos_url)) e.terminos_url = 'Tiene que ser una URL http(s).';
  if (!f.robots_ok) e.robots_ok = 'Si el robots.txt no permite leer la página, el directorio no se usa.';
  if (f.requiere_login) e.requiere_login = 'Un directorio con login no se usa (D-OP16-5).';
  if (!f.tipos_permitidos?.length) e.tipos_permitidos = 'Al menos uno.';
  if (!enteroEnRango(f.delay_min_s, 0, DELAY_MAX_S)) e.delay_min_s = `Entero de 0 a ${DELAY_MAX_S}.`;
  if (!enteroEnRango(f.max_paginas_corrida, 1, MAX_PAGINAS_MAX)) e.max_paginas_corrida = `Entero de 1 a ${MAX_PAGINAS_MAX}.`;
  if (f.provincia_default && !PROVINCIAS_AR.includes(f.provincia_default)) e.provincia_default = 'Elegí una de la lista.';
  return e;
};

// El body de POST /art/fuentes-datos/directorios: sin campos vacíos (el
// schema es extra="forbid" y los opcionales van null u omitidos).
export const bodyDirectorio = (f) => {
  const body = {
    codigo: slugDirectorio(f.codigo),
    nombre: String(f.nombre || '').trim(),
    url_semilla: String(f.url_semilla || '').trim(),
    terminos_url: String(f.terminos_url || '').trim(),
    robots_ok: Boolean(f.robots_ok),
    requiere_login: Boolean(f.requiere_login),
    tipos_permitidos: [...(f.tipos_permitidos || [])],
  };
  const texto = (k) => { const v = String(f[k] || '').trim(); if (v) body[k] = v; };
  texto('licencia');
  texto('nota');
  texto('localidad_default');
  texto('provincia_default');
  if (f.delay_min_s !== '' && f.delay_min_s !== null && f.delay_min_s !== undefined) body.delay_min_s = Number(f.delay_min_s);
  if (f.max_paginas_corrida !== '' && f.max_paginas_corrida !== null && f.max_paginas_corrida !== undefined) {
    body.max_paginas_corrida = Number(f.max_paginas_corrida);
  }
  return body;
};
