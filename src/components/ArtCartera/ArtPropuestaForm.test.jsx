// @vitest-environment jsdom
//
// Tests del modal "Armar propuesta" (BLOQUE 1.3) contra POST
// /art/empresas/{id}/propuestas.
//
// LO QUE PROTEGEN:
//
// 1. Que el formulario venga PRELLENADO con la fila de la grilla desde la
//    que se abrió (aseguradora y alícuota). Re-tipear un número que ya
//    estaba bien es la forma más fácil de mandar una propuesta con un
//    precio equivocado.
// 2. Que el selector de origen arranque en lo que dice la grilla: una
//    alícuota PROPIA es una cotización real; una de benchmark, no. Al
//    entregar, sólo la primera se asienta como alícuota de la empresa en
//    el backend, así que el default importa.
// 3. Que la alícuota se valide contra el rango comercial [0,5 - 20] ANTES
//    de salir: una alícuota con la coma corrida -0,25 por 2,5- es una
//    propuesta con un precio diez veces menor al que pasó la aseguradora,
//    y eso se firma.
// 3b. Que el campo se seleccione entero al enfocarlo: viene prellenado con
//    la alícuota de la grilla y lo normal es reemplazarla. Sin esto el
//    cursor cae donde se hizo clic y queda "2.52.850".
// 4. Que un 409 del backend (empresa sin masa salarial estimable) se
//    muestre tal cual en vez de un "no se pudo".
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtPropuestaForm from './ArtPropuestaForm';

afterEach(cleanup);

beforeEach(() => {
  vi.restoreAllMocks();
});

const renderForm = (props = {}) => {
  const onCreada = vi.fn();
  const onClose = vi.fn();
  render(
    <ArtPropuestaForm
      token="tok"
      empresaId="emp-1"
      aseguradora="plus"
      alicuotaSugerida="2.500"
      origenSugerido="BENCHMARK"
      onClose={onClose}
      onCreada={onCreada}
      {...props}
    />,
  );
  return { onCreada, onClose };
};

describe('ArtPropuestaForm', () => {
  it('viene prellenado con la aseguradora y la alícuota de la fila', () => {
    renderForm();
    expect(screen.getByText(/Plus/)).toBeTruthy();
    expect(screen.getByLabelText('Alícuota ofertada (%)').value).toBe('2.500');
    expect(screen.getByLabelText('Origen de la alícuota').value).toBe('BENCHMARK');
  });

  it('una alícuota PROPIA de la grilla arranca como cotización real', () => {
    renderForm({ origenSugerido: 'PROPIA_VIGENTE' });
    expect(screen.getByLabelText('Origen de la alícuota').value).toBe('COTIZACION_REAL');
  });

  it('rechaza una alícuota por encima del tope y no llama al backend', async () => {
    globalThis.fetch = vi.fn();
    renderForm();
    fireEvent.change(screen.getByLabelText('Alícuota ofertada (%)'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(screen.getByText(/entre 0,5% y 20%/)).toBeTruthy());
    // No se llama al backend con un valor que ya se sabe inválido.
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('rechaza una alícuota por debajo del piso: 0,25 es un 2,5 con la coma corrida', async () => {
    globalThis.fetch = vi.fn();
    renderForm();
    fireEvent.change(screen.getByLabelText('Alícuota ofertada (%)'), { target: { value: '0.25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(screen.getByText(/entre 0,5% y 20%/)).toBeTruthy());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('el campo vacío tampoco sale', async () => {
    globalThis.fetch = vi.fn();
    renderForm({ alicuotaSugerida: null });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(screen.getByText(/Cargá la alícuota ofertada/)).toBeTruthy());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it.each([['0.5'], ['20'], ['2.85']])('acepta %s, que está dentro del rango', async (valor) => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 201, json: async () => ({ propuesta: { id: 'p' }, advertencias: [] }),
    });
    renderForm();
    fireEvent.change(screen.getByLabelText('Alícuota ofertada (%)'), { target: { value: valor } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body).alicuota_ofertada).toBe(Number(valor));
  });

  it('el error de rango se borra al corregir el número, sin tener que reintentar', async () => {
    globalThis.fetch = vi.fn();
    renderForm();
    const input = screen.getByLabelText('Alícuota ofertada (%)');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));
    await waitFor(() => expect(screen.getByText(/entre 0,5% y 20%/)).toBeTruthy());

    fireEvent.change(input, { target: { value: '2.5' } });
    expect(screen.queryByText(/entre 0,5% y 20%/)).toBeNull();
  });

  it('al enfocar el campo se selecciona todo, para reemplazar la alícuota de la grilla de una', () => {
    renderForm();
    const input = screen.getByLabelText('Alícuota ofertada (%)');
    // Se espía `select()` en vez de leer `selectionStart`: en un input
    // `type="number"` ese atributo no aplica (el getter tira
    // InvalidStateError en los browsers). Lo que importa es que el foco
    // dispare la selección.
    const select = vi.spyOn(input, 'select');
    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
  });

  it('el rango está escrito en la pantalla, no sólo en el error', () => {
    renderForm();
    expect(screen.getByText(/Entre 0,5% y 20%/)).toBeTruthy();
  });

  it('manda el cuerpo que espera el backend y devuelve la propuesta creada', async () => {
    const creada = { propuesta: { id: 'prop-9' }, advertencias: [] };
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true, status: 201, json: async () => creada,
    });
    const { onCreada } = renderForm();

    fireEvent.change(screen.getByLabelText('Alícuota ofertada (%)'), { target: { value: '2.1' } });
    fireEvent.change(screen.getByLabelText('Origen de la alícuota'), { target: { value: 'COTIZACION_REAL' } });
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: 'pasada por mail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(onCreada).toHaveBeenCalledWith(creada));
    const [url, opciones] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/art/empresas/emp-1/propuestas');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({
      aseguradora: 'plus',
      alicuota_ofertada: 2.1,
      origen_alicuota: 'COTIZACION_REAL',
      observaciones: 'pasada por mail',
    });
  });

  it('el 409 de la empresa sin masa salarial se muestra tal cual', async () => {
    const detalle = 'No se puede armar una propuesta sin masa salarial: la empresa no '
      + 'tiene F.931 cargado y no hay referencia salarial aplicable.';
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false, status: 409,
      json: async () => ({ detail: detalle }),
      text: async () => JSON.stringify({ detail: detalle }),
    });
    const { onCreada } = renderForm();

    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(screen.getByText(/sin masa salarial/)).toBeTruthy());
    expect(onCreada).not.toHaveBeenCalled();
  });
});
