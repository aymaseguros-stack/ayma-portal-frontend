// @vitest-environment jsdom
//
// TECNO-0001 · F1: vista Organigrama dentro de Dirección → Gerencias.
// El fixture es la semilla v1_2 (134 posiciones) tal como queda en
// `workers` después de importar-semilla, más 6 operativas sin columnas de
// organigrama: 140 filas, lo que hay en producción.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import DireccionGerencias from './DireccionGerencias';
import {
  ancestrosDe, buscar, construirArbol, expandidosIniciales, normalizarCodigo,
} from './organigrama';
import WORKERS from './__fixtures__/workersOrganigrama.json';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data, clone: () => ({ json: async () => data }),
});

const GERENCIAS = [{ codigo: 'COMERCIAL', nombre: 'Comercial', prefijo_ids: 'COM', worker_titular: '@CERVI' }];

let urls;
const fetchCon = (workers) => vi.fn((url) => {
  urls.push(url);
  if (url.includes('/direccion/workers')) return Promise.resolve(respuesta(workers));
  if (url.includes('/direccion/gerencias')) return Promise.resolve(respuesta(GERENCIAS));
  return Promise.resolve(respuesta({}));
});

beforeEach(() => { urls = []; globalThis.fetch = fetchCon(WORKERS); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const montar = () => render(
  <DireccionGerencias token="t" codigoAbierto={null} onAbrirGerencia={() => {}} onCerrarFicha={() => {}} />
);

const abrirOrganigrama = async () => {
  montar();
  fireEvent.click(screen.getByRole('button', { name: 'Organigrama' }));
  return screen.findByRole('tree', { name: 'Organigrama' });
};

const item = (codigo) => screen.queryByRole('treeitem', { name: codigo });

describe('construirArbol (lógica pura)', () => {
  it('normaliza el código como el backend: "@SEBASTIAN" y "SEBASTIÁN" son el mismo', () => {
    expect(normalizarCodigo('@SEBASTIAN')).toBe('SEBASTIAN');
    expect(normalizarCodigo('SEBASTIÁN')).toBe('SEBASTIAN');
    expect(normalizarCodigo(' @sebastián ')).toBe('SEBASTIAN');
  });

  it('con la semilla v1_2 cuelgan de @SEBASTIAN las 134 posiciones, sin huérfanos', () => {
    const arbol = construirArbol(WORKERS);
    expect(arbol.raiz.codigo).toBe('@SEBASTIAN');
    expect(arbol.nodos.size).toBe(134);
    expect(arbol.operativas).toBe(6);
    expect(arbol.huerfanos).toEqual([]);
  });

  it('un reporta_a inexistente no se esconde: va a huérfanos con su subárbol', () => {
    const arbol = construirArbol([
      { codigo: '@SEBASTIAN', nivel_org: 'N1' },
      { codigo: '@A', nivel_org: 'N2', reporta_a: 'NADIE' },
      { codigo: '@B', nivel_org: 'N3', reporta_a: 'A' },
    ]);
    expect(arbol.huerfanos.map((n) => n.codigo)).toEqual(['@A']);
    expect(arbol.huerfanos[0].hijos.map((n) => n.codigo)).toEqual(['@B']);
  });

  it('un ciclo se corta en un nodo: el árbol es finito', () => {
    const arbol = construirArbol([
      { codigo: '@SEBASTIAN', nivel_org: 'N1' },
      { codigo: '@X', nivel_org: 'N2', reporta_a: 'Y' },
      { codigo: '@Y', nivel_org: 'N2', reporta_a: 'X' },
    ]);
    expect(arbol.huerfanos).toHaveLength(1);
    const cabeza = arbol.huerfanos[0];
    expect(cabeza.padre).toBeNull();
    expect(cabeza.hijos).toHaveLength(1);
    expect(cabeza.hijos[0].hijos).toEqual([]);
  });

  it('arranca expandido hasta N4: abiertos los N1-N3, cerrados los N4', () => {
    const { nodos } = construirArbol(WORKERS);
    const abiertos = expandidosIniciales(nodos);
    abiertos.forEach((clave) => expect(['N1', 'N2', 'N3']).toContain(nodos.get(clave).nivel_org));
    expect(abiertos.has('SEBASTIAN')).toBe(true);
  });

  it('busca por código, cargo y casilla, sin tildes ni mayúsculas, y abre la rama', () => {
    const { nodos } = construirArbol(WORKERS);
    expect(buscar(nodos, 'sebastian').has('SEBASTIAN')).toBe(true);
    expect(buscar(nodos, 'recepcion@').has('VIRGINIA')).toBe(true);
    expect(buscar(nodos, 'SUB-DIRECTOR GENERAL').has('FONTANARROSA')).toBe(true);
    expect([...ancestrosDe(nodos, new Set(['VIRGINIA']))].sort()).toEqual(['FONTANARROSA', 'SEBASTIAN']);
  });
});

describe('conmutador Lista | Organigrama', () => {
  it('abre en Lista, con la grilla de gerencias de siempre y sin pedir workers', async () => {
    montar();
    expect(await screen.findByText('Comercial')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lista' }).getAttribute('aria-pressed')).toBe('true');
    expect(urls.some((u) => u.includes('/direccion/workers'))).toBe(false);
  });

  it('Organigrama lee /direccion/workers con limit=500 (sin limit corta en 100, T-23)', async () => {
    await abrirOrganigrama();
    const pedido = urls.find((u) => u.includes('/direccion/workers'));
    expect(pedido).toMatch(/[?&]limit=500\b/);
  });

  it('volver a Lista vuelve a mostrar la grilla', async () => {
    await abrirOrganigrama();
    fireEvent.click(screen.getByRole('button', { name: 'Lista' }));
    expect(await screen.findByText('Comercial')).toBeTruthy();
    expect(screen.queryByRole('tree')).toBeNull();
  });
});

describe('vista Organigrama', () => {
  it('raíz @SEBASTIAN con cargo, casilla, chip de estado y gerencia', async () => {
    await abrirOrganigrama();
    const raiz = item('@SEBASTIAN');
    expect(raiz).toBeTruthy();
    const tarjeta = within(raiz).getAllByText('@SEBASTIAN')[0].closest('div').parentElement;
    expect(within(tarjeta).getByText('Director General · PAS 68323')).toBeTruthy();
    expect(within(tarjeta).getByText('sebastian@aymaseguros.com.ar')).toBeTruthy();
    expect(within(tarjeta).getByText('En uso')).toBeTruthy();
    expect(within(tarjeta).getByText('DIRECCION')).toBeTruthy();
  });

  it('las operativas sin nivel_org no se dibujan, y se dice cuántas son', async () => {
    await abrirOrganigrama();
    expect(item('@CERVI')).toBeNull();
    expect(screen.getByText(/6 operativas sin posición/)).toBeTruthy();
    expect(screen.getByText('134 posiciones')).toBeTruthy();
  });

  it('al abrir se ve hasta N4: los N4 visibles y cerrados, los N5 no', async () => {
    await abrirOrganigrama();
    const { nodos } = construirArbol(WORKERS);
    const n4 = [...nodos.values()].find((n) => n.nivel_org === 'N4' && n.hijos.length);
    const n5 = n4.hijos[0];
    expect(item(n4.codigo)).toBeTruthy();
    expect(item(n4.codigo).getAttribute('aria-expanded')).toBe('false');
    expect(item(n5.codigo)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: `Expandir ${n4.codigo}` }));
    expect(item(n5.codigo)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Contraer ${n4.codigo}` }));
    expect(item(n5.codigo)).toBeNull();
  });

  it('el buscador resalta la coincidencia y abre su rama', async () => {
    await abrirOrganigrama();
    const { nodos } = construirArbol(WORKERS);
    const profundo = [...nodos.values()].find((n) => n.nivel_org === 'N7' && n.casilla);
    expect(item(profundo.codigo)).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en el organigrama' }), {
      target: { value: profundo.codigo.replace('@', '').toLowerCase() },
    });
    await waitFor(() => expect(item(profundo.codigo)).toBeTruthy());
    expect(item(profundo.codigo).querySelector('[data-coincide]')).toBeTruthy();
    expect(screen.getByText(/coincidencia/)).toBeTruthy();
  });

  it('sin coincidencias lo dice', async () => {
    await abrirOrganigrama();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzz-no-existe' } });
    expect(screen.getByText(/Sin coincidencias/)).toBeTruthy();
  });

  it('500 filas = el tope del endpoint: avisa que puede faltar gente', async () => {
    const muchas = Array.from({ length: 500 }, (_, i) => ({ codigo: `@W${i}`, estado: 'ACTIVO' }));
    globalThis.fetch = fetchCon([{ codigo: '@SEBASTIAN', nivel_org: 'N1', estado_org: 'EN_USO' }, ...muchas]);
    await abrirOrganigrama();
    expect(screen.getByText(/el tope del endpoint/)).toBeTruthy();
  });

  it('un error de carga se muestra, no se pinta un árbol vacío', async () => {
    globalThis.fetch = vi.fn((url) => Promise.resolve(
      url.includes('/workers') ? respuesta({ detail: 'boom' }, 500) : respuesta(GERENCIAS),
    ));
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Organigrama' }));
    expect(await screen.findByText(/No se pudieron cargar el organigrama/)).toBeTruthy();
    expect(screen.queryByRole('tree')).toBeNull();
  });
});
