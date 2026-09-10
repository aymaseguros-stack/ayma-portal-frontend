// @vitest-environment jsdom
//
// Tests de la lista de propuestas de la ficha de empresa (BLOQUE 1.3/1.4)
// contra GET /art/empresas/{id}/propuestas.
//
// LO QUE PROTEGEN:
//
// 1. Que la columna de estado muestre `estado_efectivo` y no `estado`: una
//    propuesta cuya validez pasó se lee VENCIDA aunque la columna del
//    backend siga diciendo ENTREGADA. Es la fila que alguien mira antes de
//    volver a llamar a la empresa.
// 2. Que los días restantes se lean como texto con signo ("vence hoy",
//    "venció hace 3 días") y no como un número pelado que hay que
//    interpretar.
// 3. Que la empresa sin propuestas diga qué hacer, en vez de una tabla
//    vacía.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtPropuestasEmpresa from './ArtPropuestasEmpresa';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok, status, json: async () => body,
});

const item = (extra = {}) => ({
  id: 'prop-1',
  version: 1,
  aseguradora: 'plus',
  aseguradora_display: 'Plus ART',
  alicuota_ofertada: '2.500',
  estado: 'ENTREGADA',
  estado_efectivo: 'ENTREGADA',
  dias_restantes: 12,
  sujeta_a_f931: false,
  ...extra,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

const renderLista = (onAbrirPropuesta = () => {}) => render(
  <ArtPropuestasEmpresa token="tok" empresaId="emp-1" onAbrirPropuesta={onAbrirPropuesta} />,
);

describe('ArtPropuestasEmpresa', () => {
  it('pide las propuestas por id de empresa', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ total: 0, items: [] }));
    renderLista();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/art/empresas/emp-1/propuestas');
  });

  it('lista versión, aseguradora, alícuota, estado efectivo y validez', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 2,
      items: [
        item({ id: 'prop-2', version: 2, dias_restantes: 0 }),
        item({ id: 'prop-1', version: 1, estado_efectivo: 'VENCIDA', dias_restantes: -3 }),
      ],
    }));
    renderLista();

    await waitFor(() => expect(screen.getByText('v2')).toBeTruthy());
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.getAllByText('Plus').length).toBe(2);
    expect(screen.getAllByText('2,5%').length).toBe(2);
    expect(screen.getByText('vence hoy')).toBeTruthy();
    // La vencida se ve como VENCIDA aunque su `estado` siga siendo ENTREGADA.
    expect(screen.getByText('Vencida')).toBeTruthy();
    expect(screen.getByText('venció hace 3 días')).toBeTruthy();
  });

  it('marca las propuestas sujetas a F.931', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 1, items: [item({ sujeta_a_f931: true })],
    }));
    renderLista();
    await waitFor(() => expect(screen.getByText('sujeta a F.931')).toBeTruthy());
  });

  it('sin propuestas explica dónde se arman', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ total: 0, items: [] }));
    renderLista();
    await waitFor(() => expect(screen.getByText(/se arman desde la grilla/i)).toBeTruthy());
  });

  it('"Ver" abre la propuesta por id', async () => {
    const onAbrir = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ total: 1, items: [item()] }));
    renderLista(onAbrir);

    await waitFor(() => expect(screen.getByText('Ver')).toBeTruthy());
    fireEvent.click(screen.getByText('Ver'));
    expect(onAbrir).toHaveBeenCalledWith('prop-1');
  });

  it('un error del backend no rompe la ficha entera', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false, status: 500,
      json: async () => ({ detail: 'boom' }),
      text: async () => JSON.stringify({ detail: 'boom' }),
    });
    renderLista();
    await waitFor(() => expect(screen.getByText(/No se pudieron cargar las propuestas/)).toBeTruthy());
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});
