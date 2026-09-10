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
// 3. Que la alícuota se valide contra el mismo rango que el backend, (0, 10].
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

  it('rechaza una alícuota fuera del rango que acepta el backend', async () => {
    globalThis.fetch = vi.fn();
    renderForm();
    fireEvent.change(screen.getByLabelText('Alícuota ofertada (%)'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Armar propuesta' }));

    await waitFor(() => expect(screen.getByText(/mayor a 0 y hasta 10%/)).toBeTruthy());
    // No se llama al backend con un valor que ya se sabe inválido.
    expect(globalThis.fetch).not.toHaveBeenCalled();
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
