// @vitest-environment jsdom
//
// Tests de render de la Pestaña 2 (Análisis) del tablero de gestión ART
// (Bloque 6b) contra las 4 formas de respuesta de GET /art/analisis:
// completa, con campos faltantes, cuerpo null y error 500. Mismo patrón
// que CarteraArtPanel.test.jsx / ArtEmbudoBoard.test.jsx.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ArtAnalisisBoard from './ArtAnalisisBoard';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtAnalisisBoard - GET /art/analisis', () => {
  it('respuesta completa: tarjetas, distribuciones y cartera a defender se renderizan sin lanzar', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      empresas_total: 9119,
      empresas_con_datos_completos: 4200,
      metricas: {
        dotacion: { total: '184300', promedio: '42.50', mediana: '30.00' },
        masa_salarial_estimada: { total: '5000000000.00', promedio: '1190476.00', mediana: '900000.00' },
        tarifa_pct_historica: { total: null, promedio: '3.250', mediana: '3.000' },
        lrtm: { total: '250000000.00', promedio: '59523.80', mediana: '45000.00' },
        comision: { total: '12500000.00', promedio: '2976.19', mediana: '2200.00' },
      },
      distribucion_riesgo_suscripcion: { NORMAL: 3000, MEDIO: 800, ALTO: 300, NO_COLOCABLE: 100, SIN_DATO: 4919 },
      distribucion_estrategia_art: {
        ATACAR_DESDE_BERKLEY: 1200, ATACAR_A_BERKLEY: 900, SIN_COBERTURA_DEUDA: 150, SIN_DATO: 500, SIN_VERIFICAR: 6369,
      },
      verificacion_srt: { con_verificacion: 4200, sin_verificacion: 4919 },
      cartera_a_defender: [
        { aseguradora: 'berkley', empresas: 500, dotacion_total: 20000, comision_anual_estimada: '3200000.00' },
        { aseguradora: 'plus', empresas: 300, dotacion_total: 12000, comision_anual_estimada: '1800000.00' },
        { aseguradora: 'asociart', empresas: 0, dotacion_total: 0, comision_anual_estimada: null },
      ],
    }));

    const { container } = render(<ArtAnalisisBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Cartera a defender'));
    expect(container.textContent).toContain('Dotación');
    expect(container.textContent).toContain('Masa salarial');
    expect(container.textContent).toContain('LRTM');
    expect(container.textContent).toContain('Tarifa histórica');
    expect(container.textContent).toContain('Comisión');
    expect(container.textContent).toContain('Distribución por riesgo de suscripción');
    expect(container.textContent).toContain('Distribución por estrategia');
    expect(container.textContent).toContain('Berkley');
    expect(container.textContent).toContain('4.200 de 9.119 empresas con datos completos');
  });

  it('campos faltantes: metricas/distribuciones/cartera_a_defender ausentes no lanza', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      empresas_total: 10,
      // sin empresas_con_datos_completos, sin metricas, sin distribuciones, sin cartera_a_defender
    }));

    const { container } = render(<ArtAnalisisBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Cartera a defender'));
    expect(container.textContent).toContain('Sin datos de distribución');
    expect(container.textContent).toContain('No hay datos de cartera a defender');
  });

  it('cuerpo null: no lanza y muestra los estados vacíos de las 3 secciones', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(null));

    const { container } = render(<ArtAnalisisBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Cartera a defender'));
    expect(container.textContent).toContain('Sin datos de distribución');
    expect(container.textContent).toContain('No hay datos de cartera a defender');
  });

  it('error 500: no lanza y muestra el estado de error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ detail: 'Internal Server Error' }, { ok: false, status: 500 }),
    );

    const { container } = render(<ArtAnalisisBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No se pudo cargar el análisis'));
    expect(container.textContent).toContain('500');
  });
});
