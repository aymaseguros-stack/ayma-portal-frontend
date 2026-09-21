// @vitest-environment jsdom
//
// El cierre PERDIDA es UNA DE LAS CUATRO PUERTAS A LOOP, y es la que más se
// usa para registrar el NO que la compañía actual defendió bajando la tarifa.
// Desde el backend #187 exige `resultado_loop`, así que sin esto el botón
// "Confirmar cierre" contestaba 409 y la venta perdida no se podía cerrar.
//
// También verifica el otro lado del mismo modal: la compañía ganadora salió
// de ser un campo de texto (C-16).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import OportunidadFichaModal from './OportunidadFichaModal';

const DETALLE = {
  id: 'opp-1', token: 'AYMA-OPP-1', track: 'ART', estado_crm: 'POTENCIAL',
  resultado: 'EN_CURSO', prima_estimada: 41000, interacciones: [], tareas: [],
  adjuntos_count: 0, fecha_alta: '2026-09-01', notas: null, origen: 'REFERIDO',
  patente: null, numero_solicitud_compania: null, resultado_loop: null,
};

const CATALOGO = {
  total: 1,
  companias: [{ id: 'p1', nombre: 'San Cristóbal', tipo: 'ASEGURADORA', cuit: '30-1-9' }],
};

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

// El modal pide el detalle, el catálogo de compañías y -si hay empresa- sus
// contactos. Se responde por URL en vez de por orden de llamada: el orden lo
// decide React y un test atado a él se rompe con cualquier refactor.
const enrutar = (url) => {
  if (String(url).includes('/catalogos/companias')) return respuesta(CATALOGO);
  if (String(url).includes('/crm/oportunidades/opp-1')) return respuesta(DETALLE);
  return respuesta({ items: [], personas: [], empresas: [] });
};

beforeEach(() => {
  globalThis.fetch = vi.fn((url) => Promise.resolve(enrutar(url)));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const abrirCierre = async () => {
  render(<OportunidadFichaModal token="tok" oportunidadId="opp-1" onClose={() => {}} />);
  await waitFor(() => expect(screen.getByRole('button', { name: /Cerrar oportunidad/i })).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: /Cerrar oportunidad/i }));
  await waitFor(() => expect(screen.getByRole('button', { name: /Confirmar cierre/i })).toBeTruthy());
};

const cuerpoDelPatch = () => {
  const llamada = globalThis.fetch.mock.calls.find(([, o]) => o?.method === 'PATCH');
  return JSON.parse(llamada[1].body);
};

describe('Cierre de oportunidad — la puerta PERDIDA a LOOP', () => {
  it('GANADA elige la compañía de una lista, no de un campo de texto', async () => {
    await abrirCierre();
    await waitFor(() => expect(screen.getByRole('option', { name: /San Cristóbal/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Compañía ganadora/i), { target: { value: 'San Cristóbal' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    await waitFor(() => expect(cuerpoDelPatch().compania_ganadora).toBe('San Cristóbal'));
  });

  it('PERDIDA no deja confirmar sin declarar el resultado del LOOP', async () => {
    await abrirCierre();
    fireEvent.click(screen.getByRole('button', { name: /^Perdida$/i }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'PRECIO' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    expect(await screen.findByText(/obligatorio/i)).toBeTruthy();
    expect(globalThis.fetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false);
  });

  it('PERDIDA con efecto manda las alícuotas junto con el motivo', async () => {
    await abrirCierre();
    fireEvent.click(screen.getByRole('button', { name: /^Perdida$/i }));
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'PRECIO' } });
    fireEvent.click(screen.getByRole('radio', { name: /Con efecto/i }));
    fireEvent.change(screen.getByLabelText(/Alícuota previa \(%\)/i), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText(/Alícuota posterior \(%\)/i), { target: { value: '4.5' } });
    fireEvent.change(screen.getByLabelText(/De dónde salió/i), { target: { value: 'SRT_VENTANILLA' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(true));
    expect(cuerpoDelPatch()).toMatchObject({
      resultado: 'PERDIDA',
      motivo_perdida: 'PRECIO',
      resultado_loop: 'CON_EFECTO',
      alicuota_previa: 6,
      alicuota_posterior: 4.5,
      alicuota_posterior_fuente: 'SRT_VENTANILLA',
    });
  });

  it('GANADA no manda campos del LOOP: no entra a LOOP', async () => {
    await abrirCierre();
    await waitFor(() => expect(screen.getByRole('option', { name: /San Cristóbal/ })).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Compañía ganadora/i), { target: { value: 'San Cristóbal' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar cierre/i }));

    await waitFor(() => expect(globalThis.fetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(true));
    expect(cuerpoDelPatch().resultado_loop).toBeUndefined();
  });
});
