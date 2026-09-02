// @vitest-environment jsdom
//
// Tests de render de la Pestaña 3 (Mercado) del tablero de gestión ART
// (Bloque 6b) contra las 4 formas de respuesta de GET /art/mercado:
// completa, con campos faltantes, cuerpo null y error 500. Mismo patrón
// que CarteraArtPanel.test.jsx / ArtEmbudoBoard.test.jsx.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ArtMercadoBoard from './ArtMercadoBoard';
import { ASEGURADORAS_ART } from './artCarteraConstants';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtMercadoBoard - GET /art/mercado', () => {
  it('respuesta completa con mercado_sin_datos=false: muestra período y comparación de mercado sin lanzar', async () => {
    const items = ASEGURADORAS_ART.map((a) => ({
      aseguradora: a.id,
      empresas_propias: 10,
      trabajadores_propios: 200,
      empleadores_mercado: a.id === 'berkley' ? 1000 : null,
      trabajadores_mercado: a.id === 'berkley' ? 20000 : null,
      participacion_pct_mercado: a.id === 'berkley' ? '15.500' : null,
      share_empleadores_pct: a.id === 'berkley' ? '1.00' : null,
      share_trabajadores_pct: a.id === 'berkley' ? '1.00' : null,
    }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      periodo: '2026-T1', mercado_sin_datos: false, total: 12, items,
    }));

    const { container } = render(<ArtMercadoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Período: 2026-T1'));
    expect(container.textContent).not.toContain('Todavía no se cargaron');
    expect(container.textContent).toContain('Berkley');
    expect(container.textContent).toContain('15,5%');
    // Aseguradoras sin fila de mercado propia: nunca se inventa un número.
    expect(container.textContent).toContain('—');
  });

  it('campos faltantes: mercado_sin_datos ausente e items parciales no lanza', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 2,
      items: [
        { aseguradora: 'plus', empresas_propias: 5 },
        { aseguradora: 'berkley' },
      ],
      // sin mercado_sin_datos, sin periodo
    }));

    const { container } = render(<ArtMercadoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Mercado'));
    ASEGURADORAS_ART.forEach((a) => expect(container.textContent).toContain(a.label));
  });

  it('cuerpo null: no lanza y muestra el empty state de mercado sin datos', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(null));

    const { container } = render(<ArtMercadoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Todavía no se cargaron los datos de mercado'));
    expect(container.textContent).toContain('Plus');
  });

  it('error 500: no lanza y muestra el estado de error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ detail: 'Internal Server Error' }, { ok: false, status: 500 }),
    );

    const { container } = render(<ArtMercadoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No se pudo cargar la comparación de mercado'));
    expect(container.textContent).toContain('500');
  });
});
