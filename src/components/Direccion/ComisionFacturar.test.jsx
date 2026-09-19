// @vitest-environment jsdom
//
// "Emitir Factura C" desde una comisión liquidada. Tres caminos, los tres
// con consecuencias distintas y ninguno intercambiable:
//
//  1. Feliz: confirmación con compañía, período, importe y AMBIENTE, y
//     recién ahí el POST.
//  2. 422 por datos fiscales incompletos: NO es un error terminal; se abre
//     el mini formulario del receptor y se sugiere cargar el CUIT en
//     Proveedores.
//  3. 409: "ya facturada", como mensaje claro. No hay nada que reintentar.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ModalFacturarComision from './ModalFacturarComision';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const COMISION = {
  id: 'c1', compania: 'San Cristóbal', ramo: 'ART', periodo: '2026-08',
  monto: '1250000.00', moneda: 'ARS', fuente: 'LIQUIDACION_COMPANIA',
};

let llamadas;
beforeEach(() => { llamadas = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const montar = (props = {}) => render(
  <ModalFacturarComision
    token="t" comision={COMISION} ambiente="homologacion"
    onCerrar={() => {}} onEmitida={() => {}} {...props}
  />,
);

describe('Confirmación', () => {
  it('muestra compañía, período, importe y AMBIENTE antes de emitir', () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({})));
    montar();
    expect(screen.getByText('San Cristóbal')).toBeTruthy();
    expect(screen.getByText(/agosto 2026/)).toBeTruthy();
    expect(screen.getByText('ARS 1.250.000,00')).toBeTruthy();
    expect(screen.getByLabelText('Ambiente HOMOLOGACIÓN')).toBeTruthy();
    expect(screen.getByText('Emitir en HOMOLOGACIÓN')).toBeTruthy();
    // Todavía no se llamó a nada: la confirmación es previa al POST.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('con PRODUCCIÓN avisa que el comprobante es real', () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({})));
    montar({ ambiente: 'produccion' });
    expect(screen.getByText(/comprobante REAL ante ARCA/)).toBeTruthy();
  });
});

describe('Camino feliz', () => {
  it('emite con el cuerpo VACÍO y con Idempotency-Key', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      llamadas.push({ url: String(url), init });
      return Promise.resolve(respuesta({
        id: 'f1', estado: 'AUTORIZADA', ambiente: 'homologacion', cae: '75000000000001',
        cae_vencimiento: '2026-09-29', tipo_comprobante: 'FACTURA_C',
        numero_completo: '0003-00000012', fecha_comprobante: '2026-09-19',
        importe_total: '1250000.00', moneda: 'PES', receptor_razon_social: 'San Cristóbal',
        receptor_tipo_documento: 'CUIT', receptor_numero_documento: '30500003859', items: [],
      }, 201));
    });
    montar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));

    await waitFor(() => expect(screen.getByText('0003-00000012')).toBeTruthy());
    const post = llamadas[0];
    expect(post.url).toContain('/finanzas/comisiones-liquidadas/c1/facturar');
    expect(post.init.method).toBe('POST');
    expect(JSON.parse(post.init.body)).toEqual({});
    expect(post.init.headers['Idempotency-Key']).toBeTruthy();
    expect(screen.getByText('75000000000001')).toBeTruthy();
  });
});

describe('422: faltan los datos fiscales de la compañía', () => {
  it('abre el mini formulario, sugiere Proveedores y reenvía con el receptor', async () => {
    let primera = true;
    globalThis.fetch = vi.fn((url, init) => {
      llamadas.push({ url: String(url), init });
      if (primera) {
        primera = false;
        return Promise.resolve(respuesta({
          detail: {
            error: 'datos_de_la_compania_incompletos',
            mensaje: 'No hay un único proveedor ASEGURADORA/ART con CUIT para "San Cristóbal"',
            faltantes: ['cuit', 'condicion_iva'],
            proveedores_candidatos: [{ nombre: 'San Cristobal Seguros' }],
          },
        }, 422));
      }
      return Promise.resolve(respuesta({
        id: 'f2', estado: 'AUTORIZADA', ambiente: 'homologacion', cae: '75000000000002',
        tipo_comprobante: 'FACTURA_C', numero_completo: '0003-00000013',
        fecha_comprobante: '2026-09-19', importe_total: '1250000.00', moneda: 'PES',
        receptor_razon_social: 'San Cristóbal', receptor_tipo_documento: 'CUIT',
        receptor_numero_documento: '30500003859', items: [],
      }, 201));
    });

    montar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));

    await waitFor(() => expect(screen.getByText('Faltan los datos fiscales de la compañía')).toBeTruthy());
    // El texto del backend, entero.
    expect(screen.getByText(/No hay un único proveedor ASEGURADORA\/ART con CUIT/)).toBeTruthy();
    // Y la salida de fondo: cargar el CUIT en Proveedores.
    expect(screen.getByText(/Dirección > Proveedores/)).toBeTruthy();
    expect(screen.getByText(/San Cristobal Seguros/)).toBeTruthy();
    // El ambiente sigue a la vista en el reenvío.
    expect(screen.getAllByText('HOMOLOGACIÓN').length).toBeGreaterThan(0);

    const campo = (etiqueta) => [...document.querySelectorAll('input, select')]
      .find((i) => i.closest('label')?.textContent?.startsWith(etiqueta));
    fireEvent.change(campo('CUIT'), { target: { value: '30500003859' } });
    fireEvent.change(campo('Condición frente al IVA'), { target: { value: 'RESPONSABLE_INSCRIPTO' } });
    fireEvent.click(screen.getByText('Emitir con estos datos'));

    await waitFor(() => expect(screen.getByText('0003-00000013')).toBeTruthy());
    const segundo = JSON.parse(llamadas[1].init.body);
    expect(segundo.receptor.numero_documento).toBe('30500003859');
    expect(segundo.receptor.condicion_iva).toBe('RESPONSABLE_INSCRIPTO');
  });
});

describe('409: ya facturada', () => {
  it('lo dice como mensaje claro y no ofrece reintentar', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({
      detail: 'La comisión liquidada c1 ya tiene la factura f0 (0003-00000001)',
    }, 409)));
    montar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));

    await waitFor(() => expect(screen.getByText('Esta liquidación ya está facturada')).toBeTruthy());
    expect(screen.getByText(/ya tiene la factura f0/)).toBeTruthy();
    expect(screen.getByText(/No hay nada que reintentar/)).toBeTruthy();
    // El botón de emitir desaparece: no hay nada que emitir.
    expect(screen.queryByText('Emitir en HOMOLOGACIÓN')).toBeNull();
  });
});
