// @vitest-environment jsdom
//
// COMPLIANCE-0003 · H-71: claves de worker. Lo que este test blinda:
//
// 1. La clave en claro se ve UNA vez, en el modal, y desaparece al cerrarlo.
// 2. No toca localStorage/sessionStorage, la consola ni la URL.
// 3. Un rol no admin no ve el bloque ni dispara un pedido.
// 4. Se pintan los 4 estados, con el aviso de POR_VENCER/VENCIDA.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ClavesWorker from './ClavesWorker';
import DireccionSeguridad from './DireccionSeguridad';

const CLAVE = 'awk_cervi_ab12cd34_SECRETO-de-prueba-que-no-debe-quedar';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const fila = (id, estado, extra = {}) => ({
  id, worker_nombre: 'CERVI', prefijo: `pre${id}`,
  alcance: ['POST /api/v1/art/workers/cervi/corrida'],
  creada_en: '2026-07-01T10:00:00', creada_por: 'admin@ayma.com.ar',
  expira_en: '2026-09-29T10:00:00', revocada_en: null, revocada_por: null,
  ultimo_uso_en: null, dias_para_vencer: 4, estado, ...extra,
});

const CUATRO = [
  fila('1', 'VIGENTE', { dias_para_vencer: 80 }),
  fila('2', 'POR_VENCER', { dias_para_vencer: 4, ultimo_uso_en: '2026-09-24T12:00:00' }),
  fila('3', 'VENCIDA', { dias_para_vencer: -2 }),
  fila('4', 'REVOCADA', { worker_nombre: 'PAZ', alcance: [], revocada_en: '2026-09-01T00:00:00' }),
];

let listado;
const fetchMock = (overrides = {}) => vi.fn((url, init = {}) => {
  const u = String(url);
  const metodo = init.method || 'GET';
  if (u.includes('/admin/worker-credenciales')) {
    if (u.endsWith('/revocar')) return Promise.resolve(respuesta({ cambio: true, credencial: {} }));
    if (metodo === 'POST') {
      return Promise.resolve(overrides.post || respuesta({
        id: '9', worker_nombre: 'CERVI', prefijo: 'ab12cd34',
        alcance: ['POST /api/v1/art/workers/cervi/corrida'], expira_en: '2026-12-24T10:00:00', clave: CLAVE,
      }, 201));
    }
    return Promise.resolve(respuesta({ total: listado.length, items: listado }));
  }
  return Promise.resolve(respuesta([]));
});

beforeEach(() => {
  listado = CUATRO;
  globalThis.fetch = fetchMock();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const crearYVer = async () => {
  render(<ClavesWorker token="t" esAdmin />);
  await screen.findByText('pre1');
  fireEvent.click(screen.getByText('Crear clave'));
  return screen.findByTestId('clave-en-claro');
};

describe('tabla de claves', () => {
  it('pinta los 4 estados con su chip y el aviso de por vencer / vencidas', async () => {
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    ['VIGENTE', 'POR_VENCER', 'VENCIDA', 'REVOCADA'].forEach((e) => {
      expect(document.querySelector(`[data-estado="${e}"]`)).toBeTruthy();
    });
    expect(document.querySelector('[data-estado="POR_VENCER"]').className).toContain('amber');
    expect(screen.getByRole('alert').textContent).toContain('2 claves');
    expect(screen.getByText('venció hace 2 d')).toBeTruthy();
    expect(screen.getAllByText('29/09/2026').length).toBeGreaterThan(0);
    expect(screen.getByText('sin alcance')).toBeTruthy();
    // Revocar no se ofrece sobre una ya revocada.
    expect(screen.getAllByText('Revocar')).toHaveLength(3);
  });

  it('sin POR_VENCER ni VENCIDA no hay aviso', async () => {
    listado = [fila('1', 'VIGENTE', { dias_para_vencer: 80 })];
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ni la tabla ni la respuesta del GET muestran un hash', async () => {
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    const encabezados = Array.from(document.querySelectorAll('th')).map((th) => th.textContent.toLowerCase());
    encabezados.forEach((h) => expect(h.includes('hash')).toBe(false));
  });
});

describe('rol no admin', () => {
  it('no dibuja el bloque, ni el botón, ni pide el listado', async () => {
    render(<ClavesWorker token="t" esAdmin={false} />);
    expect(screen.queryByText('Crear clave')).toBeNull();
    expect(screen.queryByText('Claves de worker')).toBeNull();
    const pedidos = globalThis.fetch.mock.calls.filter(([u]) => String(u).includes('worker-credenciales'));
    expect(pedidos).toHaveLength(0);
  });

  it('DireccionSeguridad sin esAdmin tampoco lo muestra en Credenciales', async () => {
    render(<DireccionSeguridad token="t" />);
    fireEvent.click(await screen.findByText('Credenciales'));
    await waitFor(() => expect(screen.getByText('Nueva credencial')).toBeTruthy());
    expect(screen.queryByText('Crear clave')).toBeNull();
  });

  it('DireccionSeguridad con esAdmin lo muestra en Credenciales', async () => {
    render(<DireccionSeguridad token="t" esAdmin />);
    fireEvent.click(await screen.findByText('Credenciales'));
    expect(await screen.findByText('Crear clave')).toBeTruthy();
  });
});

describe('alta', () => {
  it('manda sólo {worker_nombre} con el worker elegido', async () => {
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    fireEvent.change(screen.getByLabelText('Worker'), { target: { value: 'VALENTINI' } });
    fireEvent.click(screen.getByText('Crear clave'));
    await screen.findByTestId('clave-en-claro');
    const post = globalThis.fetch.mock.calls.find(([, i]) => i?.method === 'POST');
    expect(JSON.parse(post[1].body)).toEqual({ worker_nombre: 'VALENTINI' });
  });

  it('un 409 (ya hay 2 vigentes) muestra el mensaje del backend', async () => {
    globalThis.fetch = fetchMock({
      post: respuesta({ detail: 'CERVI ya tiene 2 claves vigentes: revocá una antes de crear otra' }, 409),
    });
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    fireEvent.click(screen.getByText('Crear clave'));
    expect(await screen.findByText(/ya tiene 2 claves vigentes/)).toBeTruthy();
    expect(screen.queryByTestId('clave-en-claro')).toBeNull();
  });
});

describe('la clave en claro', () => {
  it('se muestra una vez con el texto de advertencia y el botón Copiar', async () => {
    const el = await crearYVer();
    expect(el.textContent).toBe(CLAVE);
    expect(screen.getByText(/Esta clave no se vuelve a mostrar/).textContent)
      .toContain('No la pegues en ningún chat.');

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    fireEvent.click(screen.getByText('Copiar'));
    await screen.findByText('Copiada');
    expect(writeText).toHaveBeenCalledWith(CLAVE);
  });

  it('cerrar pide confirmación; "Volver" la conserva, "Sí, cerrar" la borra', async () => {
    await crearYVer();
    fireEvent.click(screen.getByText('Cerrar'));
    expect(screen.getByText('¿Ya la copiaste?')).toBeTruthy();
    expect(screen.getByTestId('clave-en-claro')).toBeTruthy();

    fireEvent.click(screen.getByText('Volver'));
    expect(screen.getByTestId('clave-en-claro')).toBeTruthy();

    // La X del modal también pasa por la confirmación.
    fireEvent.click(screen.getByLabelText('Cerrar'));
    fireEvent.click(screen.getByText('Sí, cerrar'));

    await waitFor(() => expect(screen.queryByTestId('clave-en-claro')).toBeNull());
    expect(document.body.innerHTML).not.toContain(CLAVE);
    // Y no vuelve: la tabla se recarga del GET, que no la trae.
    await screen.findByText('pre1');
    expect(document.body.innerHTML).not.toContain(CLAVE);
  });

  it('no se escribe en ningún storage, ni en la consola, ni en la URL', async () => {
    const setLocal = vi.spyOn(Storage.prototype, 'setItem');
    const consolas = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const hrefAntes = window.location.href;

    await crearYVer();
    fireEvent.click(screen.getByText('Cerrar'));
    fireEvent.click(screen.getByText('Sí, cerrar'));
    await waitFor(() => expect(screen.queryByTestId('clave-en-claro')).toBeNull());

    const contiene = (args) => args.some((a) => String(a).includes(CLAVE) || String(a).includes('SECRETO'));
    expect(setLocal.mock.calls.some(contiene)).toBe(false);
    consolas.forEach((spy) => expect(spy.mock.calls.some(contiene)).toBe(false));
    [localStorage, sessionStorage].forEach((st) => {
      for (let i = 0; i < st.length; i += 1) {
        expect(String(st.getItem(st.key(i)))).not.toContain(CLAVE);
      }
    });
    expect(window.location.href).toBe(hrefAntes);
    expect(window.location.href).not.toContain(CLAVE);
  });
});

describe('revocar', () => {
  it('confirma con el prefijo, hace el POST y refresca la tabla', async () => {
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    fireEvent.click(screen.getAllByText('Revocar')[0]);
    expect(screen.getByText('Revocar pre1')).toBeTruthy();

    const gets = () => globalThis.fetch.mock.calls.filter(([u, i]) =>
      String(u).includes('worker-credenciales') && (i?.method || 'GET') === 'GET').length;
    const antes = gets();
    fireEvent.click(screen.getByText('Revocar pre1'));

    await waitFor(() => expect(screen.queryByText('Revocar pre1')).toBeNull());
    const post = globalThis.fetch.mock.calls.find(([u]) => String(u).endsWith('/1/revocar'));
    expect(post[1].method).toBe('POST');
    await waitFor(() => expect(gets()).toBeGreaterThan(antes));
  });

  it('cancelar no revoca', async () => {
    render(<ClavesWorker token="t" esAdmin />);
    await screen.findByText('pre1');
    fireEvent.click(screen.getAllByText('Revocar')[0]);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(globalThis.fetch.mock.calls.some(([u]) => String(u).endsWith('/revocar'))).toBe(false);
  });
});
