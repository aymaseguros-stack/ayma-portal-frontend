// @vitest-environment jsdom
//
// La sub-pestaña "Comisiones de referido" (C-12B).
//
// QUÉ DEFIENDE CADA BLOQUE:
//
// 1. LOS FILTROS VIAJAN AL BACKEND (`?estado=&periodo=`), no se aplican en
//    el cliente sobre la página ya traída.
// 2. EL MONTO LO CALCULA EL SERVIDOR. El alta NO manda `monto`: un monto
//    mandado desde el navegador que no coincide con el porcentaje es una
//    discusión que se descubre el día de la liquidación.
// 3. "MARCAR LIQUIDADA" CONFIRMA y manda PATCH {estado: LIQUIDADA}. La fecha
//    la sella el backend y no se vuelve a correr.
// 4. ANULAR NO BORRA: es un DELETE que el backend traduce a estado ANULADA,
//    y la pantalla lo dice, porque una fila que desaparece es indistinguible
//    de una que nunca se cargó.
// 5. NO SE MEZCLA CON LAS COMISIONES LIQUIDADAS DE FINANZAS. Aquéllas son un
//    INGRESO (lo que una compañía nos liquidó) y éstas un EGRESO (lo que le
//    debemos a un canal). Sumarlas infla el ingreso con un egreso.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ComisionesReferidoPanel from './ComisionesReferidoPanel';

const respuesta = (data) => ({
  ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }),
});

const COMISION = {
  id: 'c1', proveedor_id: 'p1', punto_contacto_id: 'pc1', lead_id: null,
  numero_poliza: 'A-123', prima_base: '100000.00', comision_pct: '2.00',
  monto: '2000.00', estado: 'DEVENGADA', periodo: '2026-09',
  liquidada_en: null, created_at: '2026-09-01T00:00:00', updated_at: '2026-09-01T00:00:00',
};

let pedidos;

beforeEach(() => {
  pedidos = [];
  globalThis.fetch = vi.fn((url, init) => {
    const u = String(url);
    pedidos.push({ url: u, metodo: init?.method || 'GET', cuerpo: init?.body });
    if (u.includes('/direccion/proveedores')) {
      return Promise.resolve(respuesta([{ id: 'p1', nombre: 'Silicon Brokers' }]));
    }
    if (u.includes('/puntos-contacto')) {
      return Promise.resolve(respuesta([{ id: 'pc1', slug: 'jefa-auto', nombre: 'Mostrador' }]));
    }
    if (u.includes('/comisiones-referido')) return Promise.resolve(respuesta([COMISION]));
    return Promise.resolve(respuesta([]));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const listados = () => pedidos.filter((p) => /\/comisiones-referido(\?|$)/.test(p.url));

describe('filtros', () => {
  it('el estado se manda como query al backend', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.change(screen.getByLabelText('Estado'), { target: { value: 'LIQUIDADA' } });
    await waitFor(() => expect(listados().some((p) => p.url.includes('estado=LIQUIDADA'))).toBe(true));
  });

  it('el período se manda como query al backend', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.change(screen.getByLabelText(/^Período/), { target: { value: '2026-09' } });
    await waitFor(() => expect(listados().some((p) => p.url.includes('periodo=2026-09'))).toBe(true));
  });

  it('sin filtros no se manda ninguno', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    expect(listados()[0].url).not.toMatch(/estado=/);
    expect(listados()[0].url).not.toMatch(/periodo=/);
  });
});

describe('alta', () => {
  it('NO manda `monto`: lo calcula el servidor desde prima y porcentaje', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.click(screen.getByText('Nueva comisión'));
    await screen.findByText('Nueva comisión de referido', { selector: 'h3' });

    fireEvent.change(screen.getByLabelText('Prima base'), { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText(/Comisión \(%\)/), { target: { value: '2' } });
    fireEvent.click(screen.getByText('Crear comisión'));

    await waitFor(() => {
      const post = pedidos.find((p) => p.metodo === 'POST');
      expect(post).toBeTruthy();
      const cuerpo = JSON.parse(post.cuerpo);
      expect(cuerpo).not.toHaveProperty('monto');
      expect(cuerpo.prima_base).toBe('100000');
      expect(cuerpo.comision_pct).toBe('2');
    });
  });

  it('la previsualización del monto se marca como tal, no como el valor guardado', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.click(screen.getByText('Nueva comisión'));
    await screen.findByText('Nueva comisión de referido', { selector: 'h3' });
    fireEvent.change(screen.getByLabelText('Prima base'), { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText(/Comisión \(%\)/), { target: { value: '2' } });
    expect(await screen.findByText(/previsualización/)).toBeTruthy();
  });
});

describe('marcar liquidada', () => {
  it('pide confirmación antes de tocar nada', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.click(screen.getByText('Marcar liquidada'));
    expect(await screen.findByText('Marcar la comisión como liquidada')).toBeTruthy();
    expect(pedidos.some((p) => p.metodo === 'PATCH')).toBe(false);
  });

  it('confirmada, manda PATCH {estado: LIQUIDADA} y nada más', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.click(screen.getByText('Marcar liquidada'));
    await screen.findByText('Marcar la comisión como liquidada');
    fireEvent.click(screen.getAllByText('Marcar liquidada').at(-1));

    await waitFor(() => {
      const patch = pedidos.find((p) => p.metodo === 'PATCH');
      expect(patch).toBeTruthy();
      // Sólo el estado: la fecha la sella el backend. Mandar `liquidada_en`
      // desde acá sería que el navegador decida cuándo se pagó.
      expect(JSON.parse(patch.cuerpo)).toEqual({ estado: 'LIQUIDADA' });
    });
  });
});

describe('anular', () => {
  it('avisa que anula y no borra, y usa DELETE', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    fireEvent.click(screen.getByText('Anular'));
    await screen.findByText('Anular la comisión');
    expect(screen.getByText(/Anula, no borra/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Anular').at(-1));
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'DELETE')).toBe(true));
  });
});

describe('el signo', () => {
  it('declara que es un egreso y que no se suma con las de Finanzas', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    expect(screen.getByText('egreso')).toBeTruthy();
    expect(screen.getByText(/no se suma con las comisiones/)).toBeTruthy();
  });

  it('los totales se parten por estado y no se suman entre sí', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    expect(screen.getByText('Devengado (se debe)')).toBeTruthy();
    expect(screen.getByText('Liquidado')).toBeTruthy();
    expect(screen.getByText(/no se suman entre sí/)).toBeTruthy();
  });
});

describe('nombres en vez de UUID', () => {
  it('resuelve el proveedor y el punto a nombre y slug', async () => {
    render(<ComisionesReferidoPanel token="t" />);
    expect(await screen.findByText('Silicon Brokers')).toBeTruthy();
    expect(await screen.findByText('jefa-auto')).toBeTruthy();
  });

  it('si no resuelve, dice "sin dato todavía" y nunca el UUID crudo', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      pedidos.push({ url: u, metodo: init?.method || 'GET', cuerpo: init?.body });
      if (u.includes('/direccion/proveedores')) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}), clone: () => ({ json: async () => ({}) }) });
      }
      if (u.includes('/puntos-contacto')) return Promise.resolve(respuesta([]));
      if (u.includes('/comisiones-referido')) return Promise.resolve(respuesta([COMISION]));
      return Promise.resolve(respuesta([]));
    });
    render(<ComisionesReferidoPanel token="t" />);
    await screen.findByText('A-123');
    await waitFor(() => expect(screen.getAllByText('sin dato todavía').length).toBeGreaterThan(0));
    expect(screen.queryByText('p1')).toBeNull();
  });
});
