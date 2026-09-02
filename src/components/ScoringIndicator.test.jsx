// @vitest-environment jsdom
//
// Segundo error del hotfix: "Failed to load resource: .../scoring/resumen -
// status 401". ScoringIndicator vive en el Header (se monta en toda la app
// para usuarios admin), así que un 401 acá no debe tumbar nada más: hay que
// verificar que authHeader manda el Authorization esperado, que un 401 se
// absorbe sin lanzar y sin dejar datos viejos en pantalla, y que un 200 con
// forma incompleta tampoco rompe (mismo patrón Bloque 4 que /srt/estado).
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ScoringIndicator from './ScoringIndicator';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ScoringIndicator - GET /crm/scoring/resumen', () => {
  it('manda el header Authorization con el token recibido', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({
      puntos_hoy: 47, objetivo_diario: 130, porcentaje_diario: 36,
      puntos_semana: 200, objetivo_semanal: 500, porcentaje_semanal: 40,
      clasificacion: 'medio',
    })));

    render(<ScoringIndicator token="tok-valido" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer tok-valido');
  });

  it('respuesta 401 en /scoring/resumen: no lanza y no deja el indicador con datos viejos', async () => {
    // authHeader(token) ya manda el Authorization: un 401 acá es sesión
    // vencida / token inválido de verdad, no falta de header. El interceptor
    // global (utils/api.js) es quien decide desloguear; este componente solo
    // tiene que sobrevivir sin romper el resto del header.
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({ detail: 'Not authenticated' }, { ok: false, status: 401 })));

    const { container } = render(<ScoringIndicator token="tok-vencido" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    // Sin datos válidos, el componente no renderiza nada (no null crudo en
    // el árbol, no texto con NaN/undefined).
    expect(container.firstChild).toBeNull();
  });

  it('200 con forma incompleta (sin porcentaje_semanal) no lanza TypeError en .toFixed', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({
      puntos_hoy: 47, objetivo_diario: 130, puntos_semana: 200, objetivo_semanal: 500,
      // porcentaje_semanal ausente: el shape que un mock "correcto" no
      // hubiera ejercitado, y que producción sí puede mandar.
    })));

    const { container } = render(<ScoringIndicator token="tok-valido" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(container.firstChild).toBeNull();
  });

  it('forma real completa: se renderiza con los datos del resumen', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(jsonResponse({
      puntos_hoy: 47, objetivo_diario: 130, porcentaje_diario: 36,
      puntos_semana: 200, objetivo_semanal: 500, porcentaje_semanal: 40,
      clasificacion: 'optimo',
    })));

    const { container } = render(<ScoringIndicator token="tok-valido" />);

    await waitFor(() => expect(container.textContent).toContain('Hoy'));
    expect(container.textContent).toContain('47/130');
  });
});
