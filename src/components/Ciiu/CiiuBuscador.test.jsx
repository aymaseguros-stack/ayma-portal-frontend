// @vitest-environment jsdom
//
// Tests del autocompletado del catálogo CIIU (bloque D3) contra
// GET /art/ciiu?q= (app/api/v1/art_ciiu.py del backend, PR #104).
//
// Lo que cubren: el debounce de 300 ms (tres teclas = UNA consulta), que el
// campo vacío no consulte nada, el formato "código — descripción — sección",
// el tope de 50 del backend, el aviso de resultados truncados y que elegir
// una fila devuelva la fila entera (el caller necesita descripción y sección,
// no sólo el código).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, act } from '@testing-library/react';
import CiiuBuscador from './CiiuBuscador';

afterEach(() => { cleanup(); vi.useRealTimers(); });

const respuesta = (body) => ({ ok: true, status: 200, json: async () => body });

const CATALOGO = {
  total: 2,
  limit: 50,
  truncado: false,
  items: [
    { codigo: '251200', descripcion: 'Fabricación de tanques', seccion: 'C', en_catalogo_vigente: true },
    { codigo: '251100', descripcion: 'Fabricación de productos metálicos', seccion: 'C', en_catalogo_vigente: true },
  ],
};

describe('CiiuBuscador', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue(respuesta(CATALOGO));
  });

  it('tipear no dispara una consulta por tecla: debounce de 300 ms, una sola llamada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CiiuBuscador token="tok" />);
    const input = screen.getByLabelText('Buscar en el catálogo CIIU');
    fireEvent.change(input, { target: { value: 'tan' } });
    fireEvent.change(input, { target: { value: 'tanq' } });
    fireEvent.change(input, { target: { value: 'tanques' } });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const url = globalThis.fetch.mock.calls[0][0];
    expect(url).toContain('/api/v1/art/ciiu?');
    expect(url).toContain('q=tanques');
    expect(url).toContain('limit=50');
  });

  it('campo vacío: no consulta el catálogo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<CiiuBuscador token="tok" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(600); });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('lista "código — descripción — sección" y manda el token', async () => {
    render(<CiiuBuscador token="tok" valorInicial="2512" />);
    await waitFor(() => expect(screen.getByText('251200 — Fabricación de tanques — sección C')).toBeTruthy());
    expect(screen.getByText('251100 — Fabricación de productos metálicos — sección C')).toBeTruthy();
    const { headers } = globalThis.fetch.mock.calls[0][1];
    expect(headers.Authorization).toBe('Bearer tok');
  });

  it('elegir una fila devuelve el item completo (código, descripción y sección)', async () => {
    const onElegir = vi.fn();
    render(<CiiuBuscador token="tok" valorInicial="2512" onElegir={onElegir} />);
    const opcion = await screen.findByText('251200 — Fabricación de tanques — sección C');
    fireEvent.click(opcion);
    expect(onElegir).toHaveBeenCalledWith(CATALOGO.items[0]);
  });

  it('sin onElegir (modo consulta): las filas no son botones y avisa que no se edita', async () => {
    render(<CiiuBuscador token="tok" valorInicial="2512" />);
    await screen.findByText('251200 — Fabricación de tanques — sección C');
    expect(screen.queryByRole('button', { name: /251200/ })).toBeNull();
    expect(screen.getByText(/no se edita desde acá/)).toBeTruthy();
  });

  it('resultados truncados: avisa el total real en vez de dejar creer que son todos', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(respuesta({ ...CATALOGO, total: 312, truncado: true }));
    render(<CiiuBuscador token="tok" valorInicial="fabricación" />);
    await waitFor(() => expect(screen.getByText(/312 coincidencias/)).toBeTruthy());
  });

  it('sin coincidencias: lo dice, no queda en blanco', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(respuesta({ total: 0, limit: 50, truncado: false, items: [] }));
    render(<CiiuBuscador token="tok" valorInicial="zzz" />);
    await waitFor(() => expect(screen.getByText('Sin coincidencias en el catálogo 2026.')).toBeTruthy());
  });

  it('error del backend: muestra el status, no un cartel genérico', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ detail: 'catálogo caído' }) });
    render(<CiiuBuscador token="tok" valorInicial="tanques" />);
    await waitFor(() => expect(screen.getByText(/Error 503: catálogo caído/)).toBeTruthy());
  });
});
