// @vitest-environment jsdom
//
// Los seis campos de relación económica en Proveedores (C-12B sección 1,
// contra el backend del PR #184).
//
// QUÉ DEFIENDE CADA BLOQUE:
//
// 1. SIN CLASIFICAR SE VE. Un `relacion_economica` en NULL no es una celda
//    vacía que se pasa de largo: es la lista de trabajo pendiente. La
//    migración de datos del backend deja en NULL a los tipos SERVICIOS y
//    OTRO a propósito ("no hay forma de saber la dirección sin mirar el
//    contrato"), así que esa marca en ámbar es el dato, no un error.
// 2. EL PATCH MANDA LOS SEIS Y LOS VACÍOS COMO `null`. El backend honra el
//    null para los cinco nullables (`CAMPOS_BORRABLES`) justamente para que
//    se puedan DESVINCULAR desde esta pantalla: sin eso se podría poner el
//    punto de contacto y no sacarlo nunca más.
// 3. `es_receptor_factura` VIAJA COMO `false`, NUNCA COMO `null`: su columna
//    es NOT NULL y un null ahí no lo apagaría (el endpoint ignora el null
//    para ese campo).
// 4. LA LISTA DE COMPAÑÍAS VIAJA COMO ARRAY, no como el string que se tipea.
// 5. EL FILTRO POR RELACIÓN AVISA CUANDO PUEDE SER PARCIAL. Es el único
//    filtro de esta pantalla que corre en el cliente (el backend no lo
//    acepta como query), así que la pantalla lo dice si el padrón llegó al
//    tope, en vez de mostrar un subconjunto como si fuera todo.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionProveedores from './DireccionProveedores';

const respuesta = (data) => ({
  ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }),
});

const BERKLEY = {
  id: 'p1', nombre: 'Berkley', tipo: 'ASEGURADORA', estado: 'ACTIVO',
  es_persona_fisica: false, transfiere_datos_exterior: false, dpa_firmado: false,
  relacion_economica: 'INGRESO',
  companias_habilitadas: ['BERKLEY', 'PREVENCION'],
  comision_pct_aplicable: '2.50', es_receptor_factura: true,
  sla_respuesta_horas: 48, punto_contacto_id: 'pc1',
  creado_en: '2026-09-01T00:00:00', actualizado_en: '2026-09-01T00:00:00',
};

const SIN_CLASIFICAR_FILA = {
  id: 'p2', nombre: 'Coworking Rosario', tipo: 'LOCACION', estado: 'ACTIVO',
  es_persona_fisica: false, transfiere_datos_exterior: false, dpa_firmado: false,
  relacion_economica: null, companias_habilitadas: null,
  comision_pct_aplicable: null, es_receptor_factura: false,
  sla_respuesta_horas: null, punto_contacto_id: null,
  creado_en: '2026-09-01T00:00:00', actualizado_en: '2026-09-01T00:00:00',
};

const PUNTO = {
  id: 'pc1', slug: 'jefa-auto', nombre: 'Mostrador de la jefa',
  url_corta: 'https://aymaseguros.com.ar/r/jefa-auto',
};

let pedidos;

const servidor = (filas = [BERKLEY, SIN_CLASIFICAR_FILA]) => vi.fn((url, init) => {
  const u = String(url);
  pedidos.push({ url: u, metodo: init?.method || 'GET', cuerpo: init?.body });
  if (u.includes('/proveedores/alertas')) return Promise.resolve(respuesta([]));
  if (u.includes('/proveedores/costos')) return Promise.resolve(respuesta({ por_rubro: {}, por_moneda: {} }));
  if (u.includes('/comercial/puntos-contacto')) return Promise.resolve(respuesta([PUNTO]));
  if (u.match(/\/proveedores\/p1(\?|$)/)) return Promise.resolve(respuesta(BERKLEY));
  if (u.includes('/proveedores/p1/')) return Promise.resolve(respuesta([]));
  if (u.includes('/proveedores')) return Promise.resolve(respuesta(filas));
  return Promise.resolve(respuesta([]));
});

beforeEach(() => { pedidos = []; globalThis.fetch = servidor(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
// 1. La lectura
// ---------------------------------------------------------------------------

describe('la relación económica en la lista', () => {
  it('muestra la relación como chip en la tabla', async () => {
    render(<DireccionProveedores token="t" />);
    expect(await screen.findByText('INGRESO')).toBeTruthy();
  });

  it('un NULL se pinta "Sin clasificar" en ámbar, nunca vacío', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Berkley');
    // `findAllByText` y no `findByText`: "Sin clasificar" aparece dos veces
    // a propósito -como chip en la fila y como opción del filtro-, y las dos
    // son deliberadas. Lo que se afirma es el CHIP.
    const chip = (await screen.findAllByText('Sin clasificar'))
      .find((n) => n.tagName === 'SPAN');
    expect(chip).toBeTruthy();
    expect(chip.className).toMatch(/amber/);
  });

  it('el detalle muestra los seis campos', async () => {
    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Berkley'));
    await screen.findByText('Relación económica');

    expect(screen.getByText('Comisión aplicable')).toBeTruthy();
    expect(screen.getByText('2,5 %')).toBeTruthy();
    expect(screen.getByText('48 h')).toBeTruthy();
    expect(screen.getByText('Receptor de factura')).toBeTruthy();
    expect(screen.getByText('PREVENCION')).toBeTruthy();
    // El punto vinculado se resuelve a su SLUG, no al UUID.
    expect(await screen.findByText('jefa-auto')).toBeTruthy();
    expect(screen.queryByText('pc1')).toBeNull();
  });

  it('en el detalle, lo que falta dice "sin dato todavía" y no un cero', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      pedidos.push({ url: u, metodo: init?.method || 'GET', cuerpo: init?.body });
      if (u.includes('/proveedores/alertas')) return Promise.resolve(respuesta([]));
      if (u.includes('/comercial/puntos-contacto')) return Promise.resolve(respuesta([]));
      if (u.match(/\/proveedores\/p2(\?|$)/)) return Promise.resolve(respuesta(SIN_CLASIFICAR_FILA));
      if (u.includes('/proveedores/p2/')) return Promise.resolve(respuesta([]));
      if (u.includes('/proveedores')) return Promise.resolve(respuesta([SIN_CLASIFICAR_FILA]));
      return Promise.resolve(respuesta([]));
    });
    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Coworking Rosario'));
    await screen.findByText('Relación económica');
    await waitFor(() => expect(screen.getAllByText('sin dato todavía').length).toBeGreaterThan(0));
    expect(screen.queryByText('0 h')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. La escritura
// ---------------------------------------------------------------------------

describe('la edición de la relación económica', () => {
  const abrirEdicion = async () => {
    render(<DireccionProveedores token="t" />);
    fireEvent.click(await screen.findByText('Berkley'));
    fireEvent.click(await screen.findByText('Editar'));
    await screen.findByText('Editar proveedor', { selector: 'h3' });
  };

  const cuerpoDelPatch = () => {
    const patch = pedidos.find((p) => p.metodo === 'PATCH');
    expect(patch).toBeTruthy();
    return JSON.parse(patch.cuerpo);
  };

  it('el formulario llega cargado con los valores actuales', async () => {
    await abrirEdicion();
    expect(screen.getByDisplayValue('BERKLEY, PREVENCION')).toBeTruthy();
    expect(screen.getByDisplayValue('2.50')).toBeTruthy();
    expect(screen.getByDisplayValue('48')).toBeTruthy();
  });

  it('el PATCH manda los seis campos', async () => {
    await abrirEdicion();
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => {
      const c = cuerpoDelPatch();
      ['relacion_economica', 'companias_habilitadas', 'comision_pct_aplicable',
        'es_receptor_factura', 'sla_respuesta_horas', 'punto_contacto_id']
        .forEach((campo) => expect(c).toHaveProperty(campo));
    });
  });

  it('las compañías viajan como ARRAY, no como el string tipeado', async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByDisplayValue('BERKLEY, PREVENCION'),
      { target: { value: ' BERKLEY , FEDERACION ' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() =>
      expect(cuerpoDelPatch().companias_habilitadas).toEqual(['BERKLEY', 'FEDERACION']));
  });

  it('vaciar un campo lo manda como null, que es lo que lo BORRA', async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText('Punto de contacto vinculado'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('48'), { target: { value: '' } });
    fireEvent.change(screen.getByDisplayValue('BERKLEY, PREVENCION'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => {
      const c = cuerpoDelPatch();
      expect(c.punto_contacto_id).toBeNull();
      expect(c.sla_respuesta_horas).toBeNull();
      expect(c.companias_habilitadas).toBeNull();
    });
  });

  it('es_receptor_factura se apaga con false, NUNCA con null', async () => {
    await abrirEdicion();
    const check = screen.getByLabelText('Le emitimos comprobante (es receptor de factura)');
    expect(check.checked).toBe(true);
    fireEvent.click(check);
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(cuerpoDelPatch().es_receptor_factura).toBe(false));
  });

  it('la relación se puede volver a "Sin clasificar" y eso manda null', async () => {
    await abrirEdicion();
    fireEvent.change(screen.getByLabelText('Relación'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Guardar cambios'));
    await waitFor(() => expect(cuerpoDelPatch().relacion_economica).toBeNull());
  });

  it('el desplegable de puntos ofrece el slug, no el UUID', async () => {
    await abrirEdicion();
    await waitFor(() =>
      expect(screen.getByText('jefa-auto — Mostrador de la jefa')).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// 3. El filtro
// ---------------------------------------------------------------------------

describe('el filtro por relación económica', () => {
  it('filtra la tabla y NO se manda como query (el backend no lo acepta)', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Berkley');
    fireEvent.change(screen.getByLabelText('Relación económica'), { target: { value: 'INGRESO' } });

    await waitFor(() => expect(screen.queryByText('Coworking Rosario')).toBeNull());
    expect(screen.getByText('Berkley')).toBeTruthy();
    expect(pedidos.every((p) => !p.url.includes('relacion_economica='))).toBe(true);
  });

  it('"Sin clasificar" ES un filtro: deja los que están en NULL', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Berkley');
    fireEvent.change(screen.getByLabelText('Relación económica'),
      { target: { value: '__SIN_CLASIFICAR__' } });
    await waitFor(() => expect(screen.queryByText('Berkley')).toBeNull());
    expect(screen.getByText('Coworking Rosario')).toBeTruthy();
  });

  it('pide el padrón entero (limit=500) para que el filtro del cliente sea completo', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Berkley');
    expect(pedidos.some((p) => p.url.includes('/proveedores?') && p.url.includes('limit=500'))).toBe(true);
  });

  it('si el padrón llegó al tope, avisa que el filtro puede ser parcial', async () => {
    const muchos = Array.from({ length: 500 }, (_, i) => ({
      ...SIN_CLASIFICAR_FILA, id: `x${i}`, nombre: `Proveedor ${i}`,
    }));
    globalThis.fetch = servidor(muchos);
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Proveedor 0');
    fireEvent.change(screen.getByLabelText('Relación económica'), { target: { value: 'INGRESO' } });
    expect(await screen.findByText(/puede haber proveedores que coincidan/)).toBeTruthy();
  });

  it('sin filtro de relación no hay cartel: no se alarma cuando no hace falta', async () => {
    render(<DireccionProveedores token="t" />);
    await screen.findByText('Berkley');
    expect(screen.queryByText(/puede haber proveedores que coincidan/)).toBeNull();
  });
});
