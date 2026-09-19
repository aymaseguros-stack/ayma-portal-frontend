// @vitest-environment jsdom
//
// Alta de proveedor: el formulario muestra los campos acordados y el POST
// llega al endpoint real con el cuerpo que el backend espera (opcionales
// vacíos como null, no como "").
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionProveedores from './DireccionProveedores';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

let llamadas;

const responder = (url, init) => {
  llamadas.push({ url, init });
  if (url.includes('/proveedores/alertas')) return Promise.resolve(respuesta([]));
  if (url.includes('/proveedores/costos')) return Promise.resolve(respuesta({ por_rubro: {}, por_moneda: {} }));
  if (url.includes('/proveedores') && init?.method === 'POST') {
    return Promise.resolve(respuesta({ id: 'p1' }, 201));
  }
  return Promise.resolve(respuesta([]));
};

beforeEach(() => {
  llamadas = [];
  globalThis.fetch = vi.fn((url, init) => responder(String(url), init));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cuerpoDelPost = () => {
  const post = llamadas.find(l => l.init?.method === 'POST');
  return post ? JSON.parse(post.init.body) : null;
};

describe('alta de proveedor', () => {
  it('sin proveedores muestra el estado vacío con el texto acordado', async () => {
    render(<DireccionProveedores token="t" />);
    expect(await screen.findByText('Todavía no hay proveedores. Cargá el primero')).toBeTruthy();
  });

  it('el formulario ofrece los campos acordados', async () => {
    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Nuevo proveedor'));
    [
      'Nombre', 'Tipo', 'Estado', 'Costo mensual', 'Moneda', 'Rubro de presupuesto',
      'Día de pago', 'Renovación', 'URL del panel', 'Trabajo asignado',
      'Persona física', 'Transfiere datos al exterior', 'DPA firmado',
    ].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it('crea el proveedor con POST y manda null en los opcionales vacíos', async () => {
    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Nuevo proveedor'));

    const form = screen.getByText('Crear proveedor').closest('form');
    fireEvent.change(form.querySelector('input'), { target: { value: 'Render' } });
    fireEvent.submit(form);

    await waitFor(() => expect(cuerpoDelPost()).not.toBeNull());
    const post = llamadas.find(l => l.init?.method === 'POST');
    expect(post.url).toContain('/api/v1/direccion/proveedores');
    const cuerpo = cuerpoDelPost();
    expect(cuerpo.nombre).toBe('Render');
    expect(cuerpo.costo_mensual).toBeNull();
    expect(cuerpo.renovacion_fecha).toBeNull();
    expect(cuerpo.rubro_presupuesto).toBeNull();
    expect(cuerpo.dpa_firmado).toBe(false);
  });

  it('si el POST falla, el error del backend queda visible (no un alta silenciosa)', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      llamadas.push({ url: u, init });
      if (init?.method === 'POST') {
        return Promise.resolve(respuesta({ detail: 'Nombre duplicado' }, 400));
      }
      return responder(u, init);
    });

    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Nuevo proveedor'));
    const form = screen.getByText('Crear proveedor').closest('form');
    fireEvent.change(form.querySelector('input'), { target: { value: 'Render' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/Nombre duplicado/)).toBeTruthy();
  });
});
