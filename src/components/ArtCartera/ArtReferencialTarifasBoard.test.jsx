// @vitest-environment jsdom
//
// Tests de render de la sub-pestaña "Referencial de Tarifas" (BLOQUE 7)
// contra las 4 formas de respuesta que puede mandar GET
// /art/referencial-tarifas: completa, con campos faltantes, cuerpo null y
// error 500. Mismo patrón que ArtMercadoBoard.test.jsx/ArtAnalisisBoard.test.jsx
// (el hotfix de React error #31 del PR #22): renderiza el componente real
// contra fetch mockeado y verifica que en NINGUNA de las 4 formas lanza.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ArtReferencialTarifasBoard from './ArtReferencialTarifasBoard';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtReferencialTarifasBoard - GET /art/referencial-tarifas', () => {
  it('respuesta completa: celdas agrupadas por CIIU x tramo x provincia con badge de antigüedad, sin lanzar', async () => {
    const items = [
      {
        ciiu: '3710', tramo_dotacion: '1-10', provincia: 'SANTA FE',
        cantidad_observaciones: 4, alicuota_minima: '4.000', alicuota_maxima: '7.000',
        alicuota_promedio: '5.500', alicuota_mediana: '5.250',
        fecha_dato_mas_antiguo: '2019-03-01', fecha_dato_mas_nuevo: '2024-11-01', antiguedad_dias: 400,
      },
      {
        ciiu: 'SIN_CIIU', tramo_dotacion: 'sin_dato', provincia: 'SIN_DATO',
        cantidad_observaciones: 1, alicuota_minima: '9.000', alicuota_maxima: '9.000',
        alicuota_promedio: '9.000', alicuota_mediana: '9.000',
        fecha_dato_mas_antiguo: '2020-01-01', fecha_dato_mas_nuevo: '2020-01-01', antiguedad_dias: 2000,
      },
    ];
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 2,
      items,
      resumen_global: { total_registros: 5, alicuota_promedio_global: '5.900', alicuota_mediana_global: '5.400' },
    }));

    const { container } = render(<ArtReferencialTarifasBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('3710'));
    expect(container.textContent).toContain('SANTA FE');
    expect(container.textContent).toContain('dato 2019-2024, no vigente');
    expect(container.textContent).toContain('dato 2020, no vigente');
    expect(container.textContent).toContain('5 registros históricos');
    expect(container.textContent).not.toContain('ganadora');
    expect(container.textContent).not.toContain('perdedora');
  });

  it('campos faltantes: items parciales y sin resumen_global no lanza', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      total: 1,
      items: [{ ciiu: '1234', tramo_dotacion: '11-25', provincia: 'CORDOBA', cantidad_observaciones: 1 }],
      // sin resumen_global
    }));

    const { container } = render(<ArtReferencialTarifasBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('1234'));
    expect(container.textContent).toContain('CORDOBA');
  });

  it('cuerpo null: no lanza y muestra el empty state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(null));

    const { container } = render(<ArtReferencialTarifasBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No hay datos históricos para estos filtros'));
  });

  it('error 500: no lanza y muestra el estado de error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ detail: 'Internal Server Error' }, { ok: false, status: 500 }),
    );

    const { container } = render(<ArtReferencialTarifasBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No se pudo cargar el referencial de tarifas'));
    expect(container.textContent).toContain('500');
  });
});
