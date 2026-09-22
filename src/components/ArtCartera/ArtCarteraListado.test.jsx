// @vitest-environment jsdom
//
// Tests del rango de dotación del listado de cartera ART (ART-42c, frontend
// de ART-42b). Lo que se verifica es lo que el backend no puede: que los DOS
// extremos del rango viajen en el querystring, que el 422 de rango invertido
// se lea junto a los inputs en vez de dejar una lista vacía muda, y que el
// aviso de `excluidas_sin_dotacion` aparezca sólo con N > 0 - un "0 empresas
// no se muestran" es ruido, y un `null` es "no hubo filtro de dotación".
//
// Mismo patrón que ArtMercadoBoard.test.jsx: fetch mockeado + render + waitFor
// (el componente debounce los filtros 350 ms, dentro del timeout de waitFor).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtCarteraListado from './ArtCarteraListado';

afterEach(cleanup);
beforeEach(() => { vi.restoreAllMocks(); });

const pagina = (extra = {}) => ({
  ok: true,
  status: 200,
  json: async () => ({
    total: 1,
    limit: 50,
    offset: 0,
    items: [{
      cuit: '30-71000001-7', razon_social: 'Acme SA', ciiu: '3710',
      provincia: 'SANTA FE', dotacion: 42, riesgo_suscripcion: 'MEDIO',
      estrategia_art: null, art_actual_srt: null, vigencia_srt: null,
      cantidad_estados_vigentes: 0,
    }],
    ...extra,
  }),
});

const urlDe = (mock, llamada) => mock.mock.calls[llamada][0];

describe('ArtCarteraListado - rango de dotación', () => {
  it('los dos filtros viajan en el querystring', async () => {
    const fetchMock = vi.fn().mockResolvedValue(pagina({ excluidas_sin_dotacion: null }));
    globalThis.fetch = fetchMock;

    const { container, getByLabelText } = render(<ArtCarteraListado token="tok" onAbrirFicha={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain('Acme SA'));

    fireEvent.change(getByLabelText('Dotación mínima'), { target: { value: '10' } });
    fireEvent.change(getByLabelText('Dotación máxima'), { target: { value: '80' } });

    await waitFor(() => {
      const url = urlDe(fetchMock, fetchMock.mock.calls.length - 1);
      expect(url).toContain('dotacion_min=10');
      expect(url).toContain('dotacion_max=80');
    });
  });

  it('sin filtro de dotación no se manda ninguno de los dos (vacío no es 0)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(pagina({ excluidas_sin_dotacion: null }));
    globalThis.fetch = fetchMock;

    const { container } = render(<ArtCarteraListado token="tok" onAbrirFicha={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain('Acme SA'));

    expect(urlDe(fetchMock, 0)).not.toContain('dotacion_min');
    expect(urlDe(fetchMock, 0)).not.toContain('dotacion_max');
  });

  it('el 422 por rango inválido muestra el mensaje del backend y no una lista vacía muda', async () => {
    const detalle = 'dotacion_max (5) no puede ser menor que dotacion_min (80).';
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(pagina({ excluidas_sin_dotacion: null }))
      .mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: detalle }) });

    const { container, getByLabelText } = render(<ArtCarteraListado token="tok" onAbrirFicha={() => {}} />);
    await waitFor(() => expect(container.textContent).toContain('Acme SA'));

    fireEvent.change(getByLabelText('Dotación mínima'), { target: { value: '80' } });
    fireEvent.change(getByLabelText('Dotación máxima'), { target: { value: '5' } });

    await waitFor(() => expect(container.textContent).toContain(detalle));
    // El mensaje va junto a los inputs, no como "no se pudo cargar la cartera".
    expect(container.textContent).not.toContain('No se pudo cargar la cartera ART');
    // Y la tabla no se queda con la fila de la consulta anterior.
    expect(container.textContent).not.toContain('Acme SA');
    expect(container.querySelector('[role="alert"]').textContent).toContain(detalle);
  });

  it('excluidas_sin_dotacion > 0: avisa cuántas quedaron fuera', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(pagina({ excluidas_sin_dotacion: 9079 }));

    const { container } = render(<ArtCarteraListado token="tok" onAbrirFicha={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('empresas sin dotación cargada no se muestran con este filtro.'));
    expect(container.textContent).toContain('9.079');
  });

  it('excluidas_sin_dotacion en 0 o null: no se muestra ningún aviso', async () => {
    for (const valor of [0, null]) {
      globalThis.fetch = vi.fn().mockResolvedValue(pagina({ excluidas_sin_dotacion: valor }));
      const { container } = render(<ArtCarteraListado token="tok" onAbrirFicha={() => {}} />);
      await waitFor(() => expect(container.textContent).toContain('Acme SA'));
      expect(container.textContent).not.toContain('sin dotación cargada no se muestran');
      cleanup();
    }
  });
});
