// @vitest-environment jsdom
//
// "Seguimientos de hoy": la fila trae todo lo necesario para escribir sin una
// segunda vuelta, y el botón de WhatsApp es un <a href>.
//
// POR QUÉ SE ASEVERA SOBRE EL <a> Y NO SOBRE UN window.open. Es el bug que la
// landing tuvo en el primer click: un `window.open` que corre DESPUÉS de un
// `await` ya perdió la activación del gesto y el navegador lo bloquea. Un test
// que espiara `window.open` pasaría igual con el bug puesto (la llamada
// ocurre; lo que no ocurre es la ventana). Sobre un ancla no hay nada que
// bloquear, y eso es lo que se fija acá.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SeguimientosHoyPanel from './SeguimientosHoyPanel';

const SEG = {
  id: 's-1',
  oportunidad_id: 'o-1',
  oportunidad_token: 'OPO-0001',
  numero_de_toque: 1,
  programado_para: '2026-09-19T10:00:00',
  vencido: false,
  nombre: 'Juan Pérez',
  telefono: '+54 9 341 695-2259',
  email: 'juan@example.com',
  vehiculo: 'Ford Focus 2019',
  compania: 'San Cristóbal',
  premio: '185000.00',
  estado_crm: 'POTENCIAL',
};

let llamadas;
let respuestaHoy;
let respuestaRegistrar;

const json = (data, ok = true) => Promise.resolve({
  ok, status: ok ? 200 : 400, json: async () => data,
});

beforeEach(() => {
  llamadas = [];
  respuestaHoy = { fecha: '2026-09-19', total: 1, seguimientos: [SEG] };
  respuestaRegistrar = {
    seguimiento_id: 's-1', estado: 'HECHO', interaccion_id: 'i-1',
    proximo_seguimiento_id: 's-2', proximo_toque: 2,
    proximo_programado_para: '2026-09-22T10:00:00', propone_loop: false, detalle: null,
  };
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    llamadas.push({ url: String(url), metodo, body: opts.body ? JSON.parse(opts.body) : null });
    if (String(url).includes('/seguimientos/hoy')) return json(respuestaHoy);
    if (String(url).includes('/registrar')) return json(respuestaRegistrar);
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const boton = (texto) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

const esperarFila = async () => waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());

describe('SeguimientosHoyPanel', () => {
  it('la fila muestra nombre, vehículo, compañía, premio y número de toque', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    expect(screen.getByText('Ford Focus 2019')).toBeTruthy();
    expect(screen.getByText('San Cristóbal')).toBeTruthy();
    expect(screen.getByText('Toque 1/3')).toBeTruthy();
    // El premio se muestra formateado como moneda, no como "185000.00".
    expect(document.body.textContent).toMatch(/185\.000/);
  });

  it('el botón de WhatsApp es un <a href> a wa.me con el número normalizado y el mensaje del toque', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Abrir WhatsApp'));
    expect(link).toBeTruthy();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
    // El 54 una sola vez, sin espacios: el bug de `wa.me/54${telefono}`.
    expect(link.href.startsWith('https://wa.me/5493416952259?text=')).toBe(true);
    expect(decodeURIComponent(link.href)).toContain('pudiste ver la cotización');
  });

  it('el toque 2 abre editable y el texto editado viaja al link', async () => {
    respuestaHoy = { ...respuestaHoy, seguimientos: [{ ...SEG, numero_de_toque: 2 }] };
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    const textarea = screen.getByLabelText('Mensaje de WhatsApp');
    expect(textarea.value).toContain('[escribí acá el dato de valor');

    fireEvent.change(textarea, { target: { value: 'El premio se congela hasta fin de mes' } });
    const link = [...document.querySelectorAll('a')].find((a) => a.textContent.includes('Abrir WhatsApp'));
    expect(decodeURIComponent(link.href)).toContain('El premio se congela hasta fin de mes');
  });

  it('el toque 1 no arranca editable y se puede editar a pedido', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    expect(screen.queryByLabelText('Mensaje de WhatsApp')).toBeNull();
    fireEvent.click(boton('Editar mensaje'));
    expect(screen.getByLabelText('Mensaje de WhatsApp')).toBeTruthy();
  });

  it('"Registrar" manda el resultado y avisa cuándo es el próximo toque', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    fireEvent.click(boton('Registrar'));
    fireEvent.change(screen.getByLabelText(/Resultado/), { target: { value: 'Contesté, lo mira el finde' } });
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => {
      const post = llamadas.find((l) => l.metodo === 'POST' && l.url.includes('/seguimientos/s-1/registrar'));
      expect(post).toBeTruthy();
      expect(post.body).toMatchObject({
        resultado: 'Contesté, lo mira el finde',
        hubo_respuesta: true,
        canal: 'WHATSAPP',
      });
    });
    await waitFor(() => expect(document.body.textContent).toContain('próximo toque 2'));
  });

  it('un tercer toque sin respuesta PROPONE el LOOP y no lo aplica solo', async () => {
    respuestaHoy = { ...respuestaHoy, seguimientos: [{ ...SEG, numero_de_toque: 3 }] };
    respuestaRegistrar = {
      ...respuestaRegistrar, proximo_seguimiento_id: null, proximo_toque: null,
      proximo_programado_para: null, propone_loop: true,
      detalle: 'Tercer toque sin respuesta. Corresponde pasar a LOOP',
    };
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    fireEvent.click(boton('Registrar'));
    fireEvent.change(screen.getByLabelText(/Resultado/), { target: { value: 'No contestó' } });
    fireEvent.click(screen.getByLabelText(/Hubo respuesta/).closest('label').querySelector('input'));
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(boton('Pasar a LOOP')).toBeTruthy());
    // Hasta que una persona lo confirme con su fecha de recontacto, NADIE
    // mandó la transición.
    expect(llamadas.some((l) => l.url.includes('/transicion'))).toBe(false);

    fireEvent.click(boton('Pasar a LOOP'));
    expect(screen.getByText('Pasar a LOOP', { selector: 'h3' })).toBeTruthy();
  });

  it('una fila con no_contactar se muestra deshabilitada y con el motivo, no se esconde', async () => {
    respuestaHoy = { ...respuestaHoy, seguimientos: [{ ...SEG, no_contactar: true }] };
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    expect(document.body.textContent).toContain('pidió no ser contactada');
    expect([...document.querySelectorAll('a')].some((a) => a.textContent.includes('Abrir WhatsApp'))).toBe(false);
    expect(boton('Registrar')).toBeUndefined();
  });

  it('sin teléfono usable avisa en vez de armar un link roto', async () => {
    respuestaHoy = { ...respuestaHoy, seguimientos: [{ ...SEG, telefono: null }] };
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    expect(document.body.textContent).toContain('Sin teléfono válido');
    expect([...document.querySelectorAll('a')].some((a) => a.href.includes('wa.me'))).toBe(false);
  });

  it('los vencidos se marcan y se cuentan (un toque de anteayer sigue siendo trabajo)', async () => {
    respuestaHoy = {
      fecha: '2026-09-19', total: 1,
      seguimientos: [{ ...SEG, vencido: true, programado_para: '2026-09-17T10:00:00' }],
    };
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    expect(document.body.textContent).toContain('1 vencido');
    expect(document.body.textContent).toContain('Vencido');
  });

  it('"Solo míos" se traduce a solo_mios=true en el GET', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await esperarFila();

    fireEvent.click(screen.getByLabelText(/Solo míos/).closest('label').querySelector('input'));
    await waitFor(() => expect(llamadas.some((l) => l.url.includes('solo_mios=true'))).toBe(true));
  });
});
