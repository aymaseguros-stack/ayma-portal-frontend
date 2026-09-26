// Organigrama sobre `workers` (TECNO-0001 · F1). Lógica PURA: arma el árbol
// por `reporta_a` y resuelve la búsqueda. La vista vive en
// OrganigramaWorkers.jsx.
//
// POR QUÉ SE NORMALIZA EL CÓDIGO: en la base el código existente es
// "@SEBASTIAN" y el `reporta_a` que escribió la semilla es "SEBASTIÁN"
// (TECNO-0001 · B1, app/services/direccion_organigrama.py). El backend
// matchea por código normalizado (mayúsculas, sin `@`, sin tildes) y el
// árbol tiene que hacer lo mismo, o media organización queda huérfana.

export const RAIZ = 'SEBASTIAN';

// GET /direccion/workers?limit=500 (el tope del backend, LIMIT_MAX): sin
// `limit` el endpoint corta en 100 sin avisar (T-23) y el árbol quedaría
// podado en silencio.
export const LIMITE_WORKERS = 500;

export const CLASES_ESTADO_ORG = {
  EN_USO: 'bg-green-500/20 text-green-300 border-green-500/40',
  A_ENCENDER: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
  CATALOGO: 'bg-slate-700/60 text-slate-300 border-slate-600',
};
// "Al abrir, expandido hasta N4": se ven los N4, cerrados.
export const NIVEL_EXPANDIDO_INICIAL = 4;

export const normalizarCodigo = (codigo) =>
  String(codigo ?? '')
    .trim()
    .replace(/^@+/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();

const normalizarTexto = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// "N4" -> 4. Sin nivel legible -> Infinity (nunca se expande solo).
export const numeroDeNivel = (nivel) => {
  const m = /^N(\d+)$/i.exec(String(nivel ?? '').trim());
  return m ? Number(m[1]) : Infinity;
};

const ordenHermanos = (a, b) =>
  numeroDeNivel(a.nivel_org) - numeroDeNivel(b.nivel_org) || a.codigo.localeCompare(b.codigo, 'es');

// Devuelve {raiz, nodos: Map<clave, nodo>, huerfanos: nodo[], operativas}.
// Cada nodo: {...worker, clave, padre (clave|null), hijos: nodo[]}.
// - Sólo entran las filas con `nivel_org`: las operativas sin columnas de
//   organigrama no se dibujan (se cuentan en `operativas`).
// - Un nodo cuyo `reporta_a` no resuelve, o que no cuelga de la raíz (un
//   ciclo), no se esconde: `huerfanos` son las cabezas de esos subárboles.
export const construirArbol = (workers = []) => {
  const conOrg = workers.filter((w) => w && w.nivel_org);
  const nodos = new Map();
  conOrg.forEach((w) => {
    const clave = normalizarCodigo(w.codigo);
    if (!nodos.has(clave)) nodos.set(clave, { ...w, clave, padre: null, hijos: [] });
  });

  nodos.forEach((nodo) => {
    const padre = normalizarCodigo(nodo.reporta_a);
    // La raíz no reporta a nadie aunque la fila diga otra cosa.
    if (nodo.clave !== RAIZ && padre && padre !== nodo.clave && nodos.has(padre)) {
      nodo.padre = padre;
      nodos.get(padre).hijos.push(nodo);
    }
  });
  nodos.forEach((nodo) => nodo.hijos.sort(ordenHermanos));

  const raiz = nodos.get(RAIZ) || null;
  const cubiertos = new Set();
  const cubrir = (desde) => {
    const pila = [desde];
    while (pila.length) {
      const n = pila.pop();
      if (cubiertos.has(n.clave)) continue;
      cubiertos.add(n.clave);
      n.hijos.forEach((h) => pila.push(h));
    }
  };
  if (raiz) cubrir(raiz);

  // Lo que no cuelga de la raíz se dibuja aparte, por subárbol: primero los
  // que no tienen padre resuelto; después, si queda algo, es un ciclo, y se
  // corta en un nodo (si no, dibujarlo expandido no terminaría nunca).
  const sueltos = [...nodos.values()].filter((n) => !cubiertos.has(n.clave)).sort(ordenHermanos);
  const huerfanos = [];
  sueltos.filter((n) => !n.padre).forEach((n) => { huerfanos.push(n); cubrir(n); });
  sueltos.forEach((n) => {
    if (cubiertos.has(n.clave)) return;
    const padre = nodos.get(n.padre);
    padre.hijos = padre.hijos.filter((h) => h !== n);
    n.padre = null;
    huerfanos.push(n);
    cubrir(n);
  });

  return {
    raiz,
    nodos,
    huerfanos,
    operativas: workers.length - conOrg.length,
  };
};

// Claves que arrancan expandidas: las de nivel menor a N4, así los N4
// quedan visibles y cerrados.
export const expandidosIniciales = (nodos) => {
  const abiertos = new Set();
  nodos.forEach((n) => {
    if (numeroDeNivel(n.nivel_org) < NIVEL_EXPANDIDO_INICIAL && n.hijos.length) abiertos.add(n.clave);
  });
  return abiertos;
};

export const todosLosExpandibles = (nodos) => {
  const abiertos = new Set();
  nodos.forEach((n) => { if (n.hijos.length) abiertos.add(n.clave); });
  return abiertos;
};

// Coincidencia por nombre (código), función (cargo) o casilla. Sin tildes
// ni mayúsculas: "sebastian" encuentra a "@SEBASTIÁN".
export const coincide = (nodo, termino) => {
  const t = normalizarTexto(termino).trim().replace(/^@+/, '');
  if (!t) return false;
  return [nodo.codigo, nodo.cargo, nodo.casilla].some((campo) => normalizarTexto(campo).includes(t));
};

export const buscar = (nodos, termino) => {
  const coincidencias = new Set();
  if (!String(termino ?? '').trim()) return coincidencias;
  nodos.forEach((n) => { if (coincide(n, termino)) coincidencias.add(n.clave); });
  return coincidencias;
};

// Los ancestros de cada coincidencia: expandirlos es "abrir su rama".
export const ancestrosDe = (nodos, claves) => {
  const ancestros = new Set();
  claves.forEach((clave) => {
    let actual = nodos.get(clave);
    const vistos = new Set();
    while (actual?.padre && !vistos.has(actual.padre)) {
      vistos.add(actual.padre);
      ancestros.add(actual.padre);
      actual = nodos.get(actual.padre);
    }
  });
  return ancestros;
};
