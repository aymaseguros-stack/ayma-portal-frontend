// @vitest-environment jsdom
//
// Hotfix pantalla en blanco de Cartera ART (React error #31: "objects are
// not valid as a React child"). /srt/estado no tiene un schema Pydantic
// estricto -> en producción devolvió un envelope de error
// {total, verificadas, pendientes, error} en vez de {verificadas,
// pendientes[, total_cola, por_prioridad]}, y algo terminó renderizando ese
// objeto (o un campo con forma inesperada) crudo en JSX.
//
// Mismo patrón que ya mordió en Bloque 4: un mock con la forma "correcta"
// no hubiera detectado esto. Estos tests renderizan el componente de
// verdad (jsdom + @testing-library/react) contra las 4 formas de respuesta
// que puede mandar el backend real y verifican que en NINGUNA lanza.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import CarteraArtPanel from './CarteraArtPanel';

afterEach(cleanup);

const EMPRESAS = [
  { id: 'e1', razon_social: 'Acme SA', cuit: '30-1-1', estrategia_art: 'ATACAR_DESDE_BERKLEY' },
  { id: 'e2', razon_social: 'Beta SA', cuit: '30-2-2', estrategia_art: 'ATACAR_A_BERKLEY' },
  { id: 'e3', razon_social: 'Gamma SA', cuit: '30-3-3', estrategia_art: null },
];

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

// Arma un fetch mockeado que responde según la URL pedida: /crm/empresas
// siempre devuelve el listado fijo de arriba, /srt/estado devuelve lo que
// se le pase en `srtEstadoRespuesta` (o simula una network error si se pasa
// `srtEstadoNetworkError: true`).
const mockFetch = ({ srtEstadoRespuesta, srtEstadoNetworkError }) => {
  globalThis.fetch = vi.fn((url) => {
    if (url.includes('/crm/empresas')) {
      return Promise.resolve(jsonResponse({ items: EMPRESAS, total: EMPRESAS.length }));
    }
    if (url.includes('/srt/estado')) {
      if (srtEstadoNetworkError) return Promise.reject(new Error('network error'));
      return Promise.resolve(srtEstadoRespuesta);
    }
    return Promise.reject(new Error(`URL inesperada en el test: ${url}`));
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CarteraArtPanel - consumo de GET /srt/estado', () => {
  it('forma real completa: {verificadas, pendientes, total_cola, por_prioridad} se renderiza sin lanzar', async () => {
    mockFetch({
      srtEstadoRespuesta: jsonResponse({
        verificadas: 42, pendientes: 8, total_cola: 50, por_prioridad: { P1: 5, P2: 20, P3: 25 },
      }),
    });

    const { container } = render(<CarteraArtPanel token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Verificadas'));
    expect(container.textContent).toContain('42');
    expect(container.textContent).toContain('50');
    expect(container.textContent).toContain('8');
    expect(container.textContent).toContain('P1');
    expect(container.textContent).toContain('5');
    expect(container.textContent).toContain('20');
    expect(container.textContent).toContain('25');
  });

  it('campos faltantes: {verificadas} solo (sin pendientes/total_cola/por_prioridad) no lanza', async () => {
    mockFetch({ srtEstadoRespuesta: jsonResponse({ verificadas: 1 }) });

    const { container } = render(<CarteraArtPanel token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Verificadas'));
    // pendientes y total se estiman localmente (empresas.length = 3):
    // pendientes = 3 - 1 = 2, total = 1 + 2 = 3.
    expect(container.textContent).toContain('1');
    expect(container.textContent).toContain('2');
    // por_prioridad no vino: el bloque P1/P2/P3 ni se intenta renderizar.
    expect(container.textContent).not.toContain('P1');
  });

  it('respuesta null / error 500 de /srt/estado: cae al conteo local sin lanzar', async () => {
    mockFetch({ srtEstadoRespuesta: jsonResponse({ detail: 'Internal Server Error' }, { ok: false, status: 500 }) });

    const { container } = render(<CarteraArtPanel token="tok" />);

    // Sin datos del backend, se usa el conteo derivado de /crm/empresas:
    // 2 empresas con estrategia_art -> verificadas=2, pendientes=1.
    await waitFor(() => expect(container.textContent).toContain('Verificadas'));
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('1');
  });

  it('network error al pedir /srt/estado no lanza (fetch rechaza la promesa)', async () => {
    mockFetch({ srtEstadoNetworkError: true });

    const { container } = render(<CarteraArtPanel token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Verificadas'));
    expect(container.textContent).toContain('2');
  });

  it('envelope de error real reportado en producción {total, verificadas, pendientes, error} no lanza React #31', async () => {
    // Shape EXACTA del bug: React error #31 "object with keys {total,
    // verificadas, pendientes, error}", con HTTP 200 (res.ok = true), así
    // que el componente no la descarta por status sino por el campo `error`.
    mockFetch({
      srtEstadoRespuesta: jsonResponse({ total: 0, verificadas: 0, pendientes: 0, error: 'servicio SRT no disponible' }),
    });

    const { container } = render(<CarteraArtPanel token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Verificadas'));
    // El envelope de error se descarta entero (no se confía en sus 0) y se
    // cae al conteo local: verificadas=2, pendientes=1.
    expect(container.textContent).toContain('2');
    expect(container.textContent).toContain('1');
  });
});
