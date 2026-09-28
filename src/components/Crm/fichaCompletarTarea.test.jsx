// @vitest-environment jsdom
//
// C-9i + C-9j: el casillero de tareas de la ficha.
// - Una tarea de próxima acción abre el MISMO modal que la Agenda
//   (`CompletarProximaAccionModal`): el backend rechaza el PATCH vacío.
// - Una tarea libre pide confirmación con el modal propio (`ConfirmarModal`),
//   nunca con `window.confirm`. Cancelar no llama al PATCH; Confirmar sí.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import OportunidadFichaModal from './OportunidadFichaModal';
import { PREGUNTA_COMPLETAR } from './agendaFiltros';
import { olvidarCatalogoProximaAccion } from './proximaAccion';

const CATALOGO = {
  tipos: ['WHATSAPP', 'LLAMAR', 'RECOTIZAR', 'PEDIR_DATOS', 'REUNION', 'EMITIR', 'SIN_ACCION_LOOP'],
  tipo_tarea_por_accion: {},
  loop_motivos: ['SIN_RESPUESTA', 'PRECIO', 'RENOVO_CON_ACTUAL', 'NO_INTERESADO', 'MAS_ADELANTE', 'OTRO'],
  canales_toque: ['WHATSAPP', 'LLAMADA'],
  plazo_max_accion_dias: 90,
  plazo_max_recontacto_dias: 365,
};

const tarea = (extra = {}) => ({
  id: 't-1', titulo: 'Pasar por la compañía', tipo: null, prioridad: 'MEDIA',
  estado: 'PENDIENTE', fecha_programada: '2026-09-28T13:00:00', origen: null, ...extra,
});

const detalle = (tareas) => ({
  id: 'o-1', token: 'OPO-0001', track: 'AUTO', estado_crm: 'PROSPECTO',
  resultado: 'EN_CURSO', prima_estimada: null, nombre_vinculado: 'Juan Pérez',
  persona_id: null, empresa_id: null, tareas, adjuntos_count: 0,
  etapa_saida: 'ATENCION', origen: 'OTRO', notas: null,
});

let patches;
let detalleActual;

beforeEach(() => {
  patches = [];
  olvidarCatalogoProximaAccion();
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const texto = String(url);
    const metodo = opts.method || 'GET';
    if (metodo === 'PATCH') patches.push({ url: texto, body: JSON.parse(opts.body || '{}') });
    let data = {};
    if (texto.includes('/catalogos/proxima-accion')) data = CATALOGO;
    else if (texto.includes('/crm/oportunidades/o-1') && metodo === 'GET') data = detalleActual;
    return Promise.resolve({ ok: true, status: 200, json: async () => data });
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const abrirTareas = async () => {
  render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
  await screen.findByText('OPO-0001');
  fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tareas'));
};

describe('Ficha · completar una tarea', () => {
  it('una tarea de próxima acción abre el modal de próxima acción, sin PATCH ni confirmación', async () => {
    detalleActual = detalle([tarea({ titulo: 'Llamar a Juan', origen: 'PROXIMA_ACCION' })]);
    await abrirTareas();
    fireEvent.click(await screen.findByLabelText('Completar Llamar a Juan'));
    expect(await screen.findByRole('radiogroup', { name: 'Próxima acción' })).toBeTruthy();
    expect(screen.getByText('Completar · Llamar a Juan')).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(patches).toHaveLength(0);
  });

  it('una tarea libre abre el modal propio; Cancelar no llama al PATCH', async () => {
    const nativo = vi.spyOn(window, 'confirm');
    detalleActual = detalle([tarea()]);
    await abrirTareas();
    fireEvent.click(await screen.findByLabelText('Completar Pasar por la compañía'));
    const dialogo = screen.getByRole('alertdialog', { name: PREGUNTA_COMPLETAR });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(patches).toHaveLength(0);
    expect(nativo).not.toHaveBeenCalled();
  });

  it('Confirmar llama al PATCH vacío de esa tarea y cierra el modal', async () => {
    detalleActual = detalle([tarea()]);
    await abrirTareas();
    fireEvent.click(await screen.findByLabelText('Completar Pasar por la compañía'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como hecha' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0].url).toContain('/crm/tareas/t-1/completar');
    expect(patches[0].body).toEqual({});
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('si el PATCH falla, el modal queda abierto con el error (sin alert nativo)', async () => {
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {});
    detalleActual = detalle([tarea()]);
    await abrirTareas();
    globalThis.fetch.mockImplementationOnce(() => Promise.resolve({
      ok: false, status: 409, json: async () => ({ detail: 'La tarea ya está completada' }),
      text: async () => '', headers: { get: () => 'application/json' }, clone() { return this; },
    }));
    fireEvent.click(await screen.findByLabelText('Completar Pasar por la compañía'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como hecha' }));
    const error = await screen.findByRole('alert');
    expect(error.textContent).toContain('No se pudo completar la tarea');
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(alerta).not.toHaveBeenCalled();
  });
});
