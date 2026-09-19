// @vitest-environment jsdom
//
// Los filtros de Proveedores por tipo y por rubro viajan al BACKEND
// (GET /direccion/proveedores?tipo=&rubro_presupuesto=), no se aplican en el
// cliente sobre la página ya traída.
//
// POR QUÉ IMPORTA: filtrando en el cliente, con el limit por default, el
// filtro se aplica sobre los primeros N proveedores y muestra "ninguno
// coincide" cuando el que se busca está en la página siguiente.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionProveedores from './DireccionProveedores';

const respuesta = (data) => ({ ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }) });

let rutas;

beforeEach(() => {
  rutas = [];
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    rutas.push(u);
    if (u.includes('/proveedores/alertas')) return Promise.resolve(respuesta([]));
    if (u.includes('/proveedores/costos')) return Promise.resolve(respuesta({ por_rubro: {}, por_moneda: {} }));
    if (u.includes('/proveedores')) {
      return Promise.resolve(respuesta([
        { id: 'p1', nombre: 'Render', tipo: 'TECNOLOGIA', estado: 'ACTIVO', rubro_presupuesto: 'SERVICIOS_WEB', trabajo_asignado: 'Hosting' },
      ]));
    }
    return Promise.resolve(respuesta([]));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const rutasDeLista = () => rutas.filter((r) => r.includes('/proveedores?') || r.endsWith('/proveedores'));

describe('filtros de proveedores', () => {
  it('el tipo se manda como query al backend', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Render');
    fireEvent.change(screen.getByLabelText('Tipo') || screen.getAllByRole('combobox')[0], { target: { value: 'TECNOLOGIA' } });
    await waitFor(() => expect(rutasDeLista().some((r) => r.includes('tipo=TECNOLOGIA'))).toBe(true));
  });

  it('el rubro de presupuesto se manda como query al backend', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Render');
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], { target: { value: 'SERVICIOS_WEB' } });
    await waitFor(() =>
      expect(rutasDeLista().some((r) => r.includes('rubro_presupuesto=SERVICIOS_WEB'))).toBe(true));
  });

  it('tipo + estado + rubro viajan juntos en el mismo request', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Render');
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'TECNOLOGIA' } });
    fireEvent.change(selects[1], { target: { value: 'SERVICIOS_WEB' } });
    fireEvent.change(selects[2], { target: { value: 'ACTIVO' } });
    await waitFor(() => expect(rutasDeLista().some((r) =>
      r.includes('tipo=TECNOLOGIA') && r.includes('rubro_presupuesto=SERVICIOS_WEB') && r.includes('estado=ACTIVO'),
    )).toBe(true));
  });

  it('sin filtros no se manda ninguno de los tres: el contrato anterior queda intacto', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Render');
    const primera = rutasDeLista()[0];
    expect(primera).not.toMatch(/tipo=/);
    expect(primera).not.toMatch(/estado=/);
    expect(primera).not.toMatch(/rubro_presupuesto=/);
  });

  it('el estado vacío con filtro dice que es el filtro, no que no haya proveedores', async () => {
    globalThis.fetch = vi.fn((url) => {
      const u = String(url);
      rutas.push(u);
      if (u.includes('/proveedores/alertas')) return Promise.resolve(respuesta([]));
      if (u.includes('/proveedores/costos')) return Promise.resolve(respuesta({ por_rubro: {}, por_moneda: {} }));
      return Promise.resolve(respuesta(u.includes('tipo=') ? [] : [{ id: 'p1', nombre: 'Render', tipo: 'TECNOLOGIA', estado: 'ACTIVO' }]));
    });
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Render');
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'ART' } });
    expect(await screen.findByText('Ningún proveedor coincide con el filtro')).toBeTruthy();
  });
});
