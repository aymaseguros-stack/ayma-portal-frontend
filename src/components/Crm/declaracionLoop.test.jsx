// @vitest-environment jsdom
//
// D-B8 - el NO con efecto, desde las puertas a LOOP.
//
// LO QUE ESTE TEST BLINDA, que es lo que rompió el deploy del backend #187:
//
// 1. `resultado_loop` VIAJA en las dos puertas con formulario (la transición
//    y el cierre PERDIDA). Sin él toda entrada a LOOP era un 409.
// 2. NO tiene valor por defecto: confirmar sin declararlo no llega a pegarle
//    al backend, y el motivo se lee en el modal.
// 3. CON_EFECTO exige las dos alícuotas, la fuente, y `posterior < previa`
//    ESTRICTO: si no bajó, no hubo efecto.
// 4. El 409/422 del backend se muestra legible EN EL MODAL. Nunca un alert().
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import TransicionEstadoModal from './TransicionEstadoModal';
import { FORM_LOOP_VACIO, payloadLoop, validarLoop } from './declaracionLoop';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

beforeEach(() => { globalThis.fetch = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cuerpoDelUltimoFetch = () => JSON.parse(globalThis.fetch.mock.calls.at(-1)[1].body);

describe('validarLoop — la regla, escrita una sola vez', () => {
  it('sin resultado declarado no deja seguir: no hay default', () => {
    expect(FORM_LOOP_VACIO.resultado_loop).toBe('');
    expect(validarLoop(FORM_LOOP_VACIO)).toMatch(/obligatorio/i);
  });

  it('SIN_EFECTO no pide nada más', () => {
    expect(validarLoop({ ...FORM_LOOP_VACIO, resultado_loop: 'SIN_EFECTO' })).toBeNull();
  });

  it('CON_EFECTO exige las dos alícuotas y la fuente', () => {
    const base = { ...FORM_LOOP_VACIO, resultado_loop: 'CON_EFECTO' };
    expect(validarLoop(base)).toMatch(/alícuotas/i);
    expect(validarLoop({ ...base, alicuota_previa: '5', alicuota_posterior: '4' }))
      .toMatch(/de dónde salió/i);
  });

  it('la posterior tiene que ser ESTRICTAMENTE menor que la previa', () => {
    const base = {
      ...FORM_LOOP_VACIO, resultado_loop: 'CON_EFECTO',
      alicuota_posterior_fuente: 'F931',
    };
    // Igual no es "bajó": un ahorro de cero contando como valor generado es
    // peor que no tener el dato.
    expect(validarLoop({ ...base, alicuota_previa: '5', alicuota_posterior: '5' }))
      .toMatch(/menor/i);
    expect(validarLoop({ ...base, alicuota_previa: '5', alicuota_posterior: '6' }))
      .toMatch(/menor/i);
    expect(validarLoop({ ...base, alicuota_previa: '5', alicuota_posterior: '4.2' })).toBeNull();
  });

  it('payloadLoop manda null y no cadena vacía en lo que no se cargó', () => {
    const cuerpo = payloadLoop({ ...FORM_LOOP_VACIO, resultado_loop: 'SIN_EFECTO' });
    expect(cuerpo.resultado_loop).toBe('SIN_EFECTO');
    expect(cuerpo.alicuota_previa).toBeNull();
    expect(cuerpo.ahorro_anual_generado).toBeNull();
  });
});

describe('TransicionEstadoModal — la puerta LOOP', () => {
  const abrir = (props = {}) => render(
    <TransicionEstadoModal
      token="tok"
      oportunidad={{ id: 'opp-1' }}
      destino="LOOP"
      onCerrar={() => {}}
      onAplicada={() => {}}
      {...props}
    />,
  );

  it('sin declarar el resultado no llama al backend y explica por qué', async () => {
    abrir();
    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/i), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar LOOP/i }));

    expect(await screen.findByText(/obligatorio/i)).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('SIN_EFECTO manda resultado_loop en el cuerpo del POST /transicion', async () => {
    const onAplicada = vi.fn();
    globalThis.fetch.mockResolvedValue(respuesta({ estado_crm: 'LOOP', estado_anterior: 'POTENCIAL' }));
    abrir({ onAplicada });

    fireEvent.click(screen.getByRole('radio', { name: /Sin efecto/i }));
    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/i), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar LOOP/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/crm/oportunidades/opp-1/transicion');
    expect(cuerpoDelUltimoFetch().resultado_loop).toBe('SIN_EFECTO');
    await waitFor(() => expect(onAplicada).toHaveBeenCalled());
  });

  it('CON_EFECTO manda las alícuotas, la fuente y el ahorro declarado', async () => {
    globalThis.fetch.mockResolvedValue(respuesta({ estado_crm: 'LOOP', estado_anterior: 'POTENCIAL' }));
    abrir();

    fireEvent.click(screen.getByRole('radio', { name: /Con efecto/i }));
    fireEvent.change(screen.getByLabelText(/Alícuota previa \(%\)/i), { target: { value: '5.2' } });
    fireEvent.change(screen.getByLabelText(/Alícuota posterior \(%\)/i), { target: { value: '3.8' } });
    fireEvent.change(screen.getByLabelText(/De dónde salió/i), { target: { value: 'F931' } });
    fireEvent.change(screen.getByLabelText(/Ahorro anual generado/i), { target: { value: '450000' } });
    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/i), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar LOOP/i }));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const cuerpo = cuerpoDelUltimoFetch();
    expect(cuerpo).toMatchObject({
      resultado_loop: 'CON_EFECTO',
      alicuota_previa: 5.2,
      alicuota_posterior: 3.8,
      alicuota_posterior_fuente: 'F931',
      ahorro_anual_generado: 450000,
    });
  });

  it('con la posterior mayor que la previa rebota acá, sin gastar el 409', async () => {
    abrir();
    fireEvent.click(screen.getByRole('radio', { name: /Con efecto/i }));
    fireEvent.change(screen.getByLabelText(/Alícuota previa \(%\)/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Alícuota posterior \(%\)/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/De dónde salió/i), { target: { value: 'F931' } });
    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/i), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar LOOP/i }));

    expect(await screen.findByText(/menor que la previa/i)).toBeTruthy();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('el 409 del backend se lee EN EL MODAL, no en un alert', async () => {
    const alerta = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    globalThis.fetch.mockResolvedValue(
      respuesta({ detail: 'LOOP exige declarar resultado_loop (SIN_EFECTO o CON_EFECTO)' }, 409),
    );
    abrir();

    fireEvent.click(screen.getByRole('radio', { name: /Sin efecto/i }));
    fireEvent.change(screen.getByLabelText(/Fecha de recontacto/i), { target: { value: '2026-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar LOOP/i }));

    expect(await screen.findByText(/resultado_loop/i)).toBeTruthy();
    expect(alerta).not.toHaveBeenCalled();
  });

  it('RECUPERABLE no pregunta el resultado del LOOP: es la baja de un cliente', () => {
    abrir({ destino: 'RECUPERABLE' });
    expect(screen.queryByRole('radio', { name: /Con efecto/i })).toBeNull();
  });
});
