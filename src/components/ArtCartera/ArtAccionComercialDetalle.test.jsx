// @vitest-environment jsdom
//
// Tests del detalle de empresa de "Acción comercial" (BLOQUE 3, paso 3).
//
// El detalle contesta la pregunta que la tabla deja abierta: POR QUÉ la
// compañía sugerida es ésa. Cubren que abra como modal sobre la lista (no
// como pantalla nueva), que pida GET /art/empresas/{cuit}, que muestre
// historial_contratos y antiguedad_total_meses, y que las compañías
// descartadas por colocabilidad (ART-76, PR #136) salgan CON su motivo -
// que es el punto: el dato está y no se puede usar.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';
import { fechaCorta } from '../../utils/fechas';

afterEach(cleanup);

const TOKEN = 'token-de-prueba';

const FILA = {
  empresa_id: 'e1',
  cuit: '30-71000001-7',
  razon_social: 'ACME SA',
  provincia: 'SANTA FE',
  telefono_principal: '3416952259',
  aseguradora_actual: 'asociart',
  fecha_vencimiento: '2026-10-15',
  dias_a_vencimiento: 31,
  dotacion: 40,
  dotacion_fuente: 'SRT',
  alicuota_actual: 8.5,
  alicuota_actual_fuente: 'SRT_VENTANILLA',
  alicuota_actual_verificada: true,
  alicuota_mercado_tramo: 6.1,
  delta_pp: 2.4,
  comision_actual_estimada: 120000,
  compania_sugerida: 'provincia',
  compania_sugerida_origen: 'MEDIANA_HISTORICA',
  via_colocacion: 'PROPIO',
  elegible_traspaso: true,
  companias_descartadas_no_colocables: [
    { compania: 'galeno', motivo: 'AUTORIZACION_REVOCADA_SSN', mediana: 5.2, n: 7, nivel_evidencia: 'CIIU' },
  ],
};

const FICHA = {
  empresa: { cuit: '30-71000001-7', razon_social: 'ACME SA' },
  aseguradoras: [],
  historial: [],
  historial_contratos: [
    { aseguradora: 'asociart', aseguradora_display: 'Asociart ART', aseguradora_activa: true, fecha_inicio: '2023-05-01', fecha_fin: null, motivo_baja: null },
    { aseguradora: 'mapfre', aseguradora_display: 'MAPFRE ART', aseguradora_activa: false, fecha_inicio: '2019-02-01', fecha_fin: '2023-04-30', motivo_baja: 'TRASPASO' },
  ],
  antiguedad_total_meses: 92,
};

const mockTodo = (overFila = {}, overFicha = {}) => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('/art/empresas/')) {
      return { ok: true, status: 200, json: async () => ({ ...FICHA, ...overFicha }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ total: 1, items: [{ ...FILA, ...overFila }], resumen: { cobertura_verificacion: 10, periodo_mercado: '2026-08' } }),
    };
  });
};

const abrirDetalle = async (overFila = {}, overFicha = {}) => {
  mockTodo(overFila, overFicha);
  render(<ArtAccionComercialBoard token={TOKEN} />);
  fireEvent.click(await screen.findByRole('button', { name: 'ACME SA' }));
};

describe('detalle de empresa de acción comercial', () => {
  it('abre sobre la lista y trae la ficha por CUIT', async () => {
    await abrirDetalle();

    await waitFor(() => {
      const urls = globalThis.fetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes('/art/empresas/30-71000001-7'))).toBe(true);
    });
    // La lista sigue detrás: el modal se superpone, no reemplaza la
    // pantalla (la columna "Compañía sugerida" es de la tabla de la lista).
    expect(screen.getByRole('columnheader', { name: 'Compañía sugerida' })).toBeTruthy();
  });

  it('muestra antigüedad total e historial de contratos', async () => {
    await abrirDetalle();

    expect(await screen.findByText('92 meses')).toBeTruthy();
    expect(screen.getByText('Asociart ART')).toBeTruthy();
    expect(screen.getByText('MAPFRE ART')).toBeTruthy();
    expect(screen.getByText('ya no opera')).toBeTruthy();
    expect(screen.getByText('vigente')).toBeTruthy();
  });

  // ART-74: el modal dice el nivel entero y si la dotación está marcada
  // como sospechosa. Los dos campos salen de la FILA, no de la ficha.
  it('muestra la confianza de la dotación y la marca de sospecha', async () => {
    await abrirDetalle({ dotacion: 32000, dotacion_confianza: 'BAJA', dotacion_sospechosa: true });

    expect(await screen.findByText(/BAJA — planilla histórica/)).toBeTruthy();
    expect(screen.getByText(/Sí — Dotación >5.000 — verificar contra F931/)).toBeTruthy();
  });

  it('no inventa confianza cuando la fila no la trae', async () => {
    await abrirDetalle({ dotacion_confianza: null, dotacion_sospechosa: false });

    expect(await screen.findByText('Confianza del origen')).toBeTruthy();
    expect(screen.getByText('Confianza del origen').closest('div').textContent).toContain('Sin dato');
    expect(screen.getByText('Dotación sospechosa').closest('div').textContent).toContain('No');
  });

  it('muestra las compañías descartadas por colocabilidad con su motivo', async () => {
    await abrirDetalle();

    expect(await screen.findByText(/Compañías descartadas por colocabilidad \(1\)/)).toBeTruthy();
    expect(screen.getByText('Autorización revocada por la SSN')).toBeTruthy();
    expect(screen.getByText(/Mediana que habría ganado: 5.2%/)).toBeTruthy();
  });

  // ART-97 (backend PR #210): bloque "Historial ART" al lado de la antigüedad.
  const HISTORIAL = {
    antiguedad_total_meses: 92,
    meses_contrato_vigente: 40,
    cantidad_contratos: 4,
    cambios_de_art: 2,
    permanencia_promedio_meses: 30,
    permanencia_mediana_meses: 28,
    huecos: 1,
    meses_sin_cobertura_total: 3,
    fecha_ultimo_cambio: '2023-05-01',
    meses_desde_ultimo_cambio: 40,
    cambios_ultimos_5_anios: 2,
    meses_de_datos: 95,
    propension_cambio: 'ROTATIVA',
  };

  it('muestra el bloque Historial ART con todos los campos', async () => {
    await abrirDetalle({}, { historial_art: HISTORIAL });
    const bloque = await screen.findByTestId('historial-art');
    const t = bloque.textContent;
    expect(t).toContain('Contrato vigente40 meses');
    expect(t).toContain('Contratos4');
    expect(t).toContain('Cambios de ART2');
    expect(t).toContain('30 meses / 28 meses');
    expect(t).toContain('Huecos1 · 3 meses sin cobertura');
    expect(t).toContain(`Último cambio${fechaCorta('2023-05-01')} · hace 40 meses`);
    expect(t).not.toContain('Nunca cambió');
    expect(t).toContain('Cambios en 5 años2');
    expect(t).toContain('Rotativa');
    // Al lado de la antigüedad total, que sigue saliendo.
    expect(screen.getByText('92 meses')).toBeTruthy();
  });

  it('sin fecha_ultimo_cambio dice "Nunca cambió" y sin contrato vigente lo aclara', async () => {
    await abrirDetalle({}, {
      historial_art: {
        ...HISTORIAL, fecha_ultimo_cambio: null, meses_desde_ultimo_cambio: null,
        cambios_de_art: 0, cambios_ultimos_5_anios: 0, huecos: 0, meses_sin_cobertura_total: 0,
        meses_contrato_vigente: null, propension_cambio: 'ESTABLE',
      },
    });
    const t = (await screen.findByTestId('historial-art')).textContent;
    expect(t).toContain('Último cambioNunca cambió');
    expect(t).toContain('Contrato vigenteNinguno vigente');
    expect(t).toContain('Huecos0');
    expect(t).not.toContain('sin cobertura');
    expect(t).toContain('Estable');
  });
});
