// @vitest-environment jsdom
//
// Tests de render de la Pestaña 1 (Embudo) del tablero de gestión ART
// (Bloque 6b) contra las 4 formas de respuesta que puede mandar GET
// /art/embudo: completa, con campos faltantes, cuerpo null y error 500.
// Mismo patrón que CarteraArtPanel.test.jsx (el hotfix de React error #31
// del PR #22): renderiza el componente real contra fetch mockeado y
// verifica que en NINGUNA de las 4 formas lanza.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ArtEmbudoBoard from './ArtEmbudoBoard';
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

describe('ArtEmbudoBoard - GET /art/embudo', () => {
  it('respuesta completa: 12 filas, referencia histórica y destacado de mayor delta se renderizan sin lanzar', async () => {
    const items = ASEGURADORAS_ART.map((a, i) => ({
      aseguradora: a.id,
      en_gestion: i,
      cotizadas: i + 2,
      ganadas: i,
      perdidas: 2,
      rechazadas: 1,
      bloqueadas: 0,
      tecnica: 0,
      alicuota_promedio_ganadora: '5.500',
      alicuota_promedio_perdedora: '8.000',
      // berkley (última) con el delta más alto -> debe quedar destacada.
      delta_alicuota: a.id === 'berkley' ? '10.000' : a.id === 'la_segunda' ? '9.000' : a.id === 'federacion_patronal' ? '8.500' : '1.000',
    }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 12,
      items,
      referencia_historica: { alicuota_promedio_ganadora: '5.960', alicuota_promedio_perdedora: '8.020', delta_alicuota: '2.060' },
    }));

    const { container, getAllByText } = render(<ArtEmbudoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Totales'));
    expect(container.textContent).toContain('Plus');
    expect(container.textContent).toContain('Berkley');
    expect(container.textContent).toContain('5,96');
    expect(container.textContent).toContain('8,02');
    // Top 3 por delta -> 3 badges "Mayor margen".
    expect(getAllByText('Mayor margen')).toHaveLength(3);
  });

  it('campos faltantes: items parciales y sin referencia_historica no lanza, igual muestra las 12 aseguradoras', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 2,
      items: [
        { aseguradora: 'plus', ganadas: 3 },
        { aseguradora: 'berkley' },
      ],
      // sin referencia_historica
    }));

    const { container } = render(<ArtEmbudoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Totales'));
    // Las 12 aseguradoras del ENUM fijo siguen apareciendo aunque el
    // backend solo haya mandado 2.
    ASEGURADORAS_ART.forEach((a) => expect(container.textContent).toContain(a.label));
    expect(container.textContent).toContain('—');
  });

  it('cuerpo null: no lanza y muestra las 12 filas con valores por defecto', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(null));

    const { container } = render(<ArtEmbudoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Totales'));
    expect(container.textContent).toContain('Plus');
    expect(container.textContent).toContain('Berkley');
  });

  it('error 500: no lanza y muestra el estado de error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ detail: 'Internal Server Error' }, { ok: false, status: 500 }),
    );

    const { container } = render(<ArtEmbudoBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No se pudo cargar el embudo'));
    expect(container.textContent).toContain('500');
  });
});
