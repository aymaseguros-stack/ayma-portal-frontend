// @vitest-environment jsdom
//
// Tests de render de la ficha de empresa (Pantalla B, /art/:cuit) para la
// sección de actividad + alícuota de referencia SRT (descripcion_actividad +
// alicuota_referencial) agregada a GET /art/empresas/{cuit} - ver
// app/api/v1/art_consultas.py::obtener_empresa_art del backend (PR #55).
// Mismo patrón que ArtAnalisisBoard.test.jsx: fetch mockeado con la forma
// exacta del contrato.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import ArtEmpresaFicha from './ArtEmpresaFicha';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const empresaBase = {
  cuit: '30-12345678-9',
  razon_social: 'Acme SA',
  nombre_fantasia: null,
  ciiu: '0114',
  provincia: 'Santa Fe',
  dotacion: 42,
  telefono: '3416952259',
  email: 'contacto@acme.com',
  riesgo_suscripcion: 'NORMAL',
  estrategia_art: null,
};

const detalleBase = {
  aseguradoras: [],
  historial: [],
  calculo: null,
  calculo_bloqueado_por: 'dotacion',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtEmpresaFicha - actividad y alícuota de referencia SRT', () => {
  it('con match vigente: muestra la actividad, suma fija + cuota variable parseadas y la leyenda de resolución', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        descripcion_actividad: 'Cultivo de arroz',
        alicuota_referencial: {
          suma_fija: '0.14',
          cuota_variable: '7.089',
          anio_calendario: 2025,
          resolucion: '23/2026',
        },
      },
    }));

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Alícuota de referencia SRT'));
    expect(container.textContent).toContain('Cultivo de arroz');
    // Vienen como string desde el backend (Decimal serializado) - deben
    // parsearse a float antes de formatear, no concatenarse ni truncarse.
    expect(container.textContent).toContain('0,14');
    expect(container.textContent).toContain('7,089');
    expect(container.textContent).toContain('Res. 23/2026, año calendario 2025');
  });

  it('sin match vigente (alicuota_referencial null): no renderiza la sección aunque haya descripcion_actividad', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        descripcion_actividad: 'Cultivo de arroz',
        alicuota_referencial: null,
      },
    }));

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Motor de cálculo'));
    expect(container.textContent).not.toContain('Alícuota de referencia SRT');
  });

  it('empresa sin CIIU cargado (descripcion_actividad y alicuota_referencial null): no renderiza la sección', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        ciiu: null,
        descripcion_actividad: null,
        alicuota_referencial: null,
      },
    }));

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Motor de cálculo'));
    expect(container.textContent).not.toContain('Alícuota de referencia SRT');
  });
});
