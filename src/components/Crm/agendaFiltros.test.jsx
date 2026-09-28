// @vitest-environment jsdom
//
// C-9g: la Agenda en grupos (Próximas acciones · Libres · Prospección ART ·
// Todas), con contadores y el default sin la prospección ART; y la
// confirmación antes de completar una tarea libre o de prospección.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import AgendaPanel from './AgendaPanel';
import {
  contarPorGrupo, filtrarAgenda, grupoDeTarea, GRUPOS_DEFAULT, PREGUNTA_COMPLETAR,
} from './agendaFiltros';

const tarea = (id, titulo, extra = {}) => ({
  id, titulo, tipo: null, prioridad: 'MEDIA', estado: 'PENDIENTE',
  fecha_programada: '2026-09-28T13:00:00', origen: null, impedimento: null, ...extra,
});

const PA = tarea('pa', 'Llamar a Juan', { origen: 'PROXIMA_ACCION', tipo: 'LLAMADA' });
const LIBRE = tarea('li', 'Pasar por la compañía');
const POOL = tarea('po', 'Cotizar ART — aniversario 2026-10-01', { tipo: 'COTIZAR' });
const SRT1 = tarea('s1', 'Sin cobertura ART vigente - ACME SA', { tipo: 'LLAMADA', fecha_programada: '2026-09-01T12:00:00' });
const SRT2 = tarea('s2', 'Sin cobertura ART vigente - BETA SRL', { tipo: 'LLAMADA', fecha_programada: '2026-09-02T12:00:00' });

// SRT1 vencida; PA vencida HOY y también en los días (se cuenta una vez).
const AGENDA = {
  vencidas: [SRT1, SRT2, PA],
  dias: { '2026-09-28': [PA, LIBRE], '2026-09-30': [POOL] },
};

describe('clasificación', () => {
  it('cada tarea cae en un solo grupo', () => {
    expect(grupoDeTarea(PA)).toBe('PROXIMA_ACCION');
    expect(grupoDeTarea(LIBRE)).toBe('LIBRE');
    expect(grupoDeTarea(POOL)).toBe('PROSPECCION_ART');
    expect(grupoDeTarea(SRT1)).toBe('PROSPECCION_ART');
    // Una LLAMADA cargada a mano sigue siendo libre: decide el prefijo.
    expect(grupoDeTarea(tarea('x', 'Llamar por la ART', { tipo: 'LLAMADA' }))).toBe('LIBRE');
  });

  it('contadores por grupo, sin contar dos veces la que viene en las dos listas', () => {
    expect(contarPorGrupo(AGENDA)).toEqual({ PROXIMA_ACCION: 1, LIBRE: 1, PROSPECCION_ART: 3, TODAS: 5 });
  });

  it('el filtro saca los días que quedan vacíos', () => {
    const v = filtrarAgenda(AGENDA, GRUPOS_DEFAULT);
    expect(v.vencidas.map((t) => t.id)).toEqual(['pa']);
    expect(Object.keys(v.dias)).toEqual(['2026-09-28']);
  });
});

describe('AgendaPanel', () => {
  let patches;
  beforeEach(() => {
    patches = [];
    globalThis.fetch = vi.fn((url, init = {}) => {
      if ((init.method || 'GET') === 'PATCH') patches.push(url);
      return Promise.resolve({ ok: true, status: 200, json: async () => (url.includes('/agenda') ? AGENDA : {}) });
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('default: próximas acciones + libres; la prospección ART se ve con su chip', async () => {
    render(<AgendaPanel token="t" />);
    expect(await screen.findByText('Pasar por la compañía')).toBeTruthy();
    expect(screen.getAllByText('Llamar a Juan').length).toBeGreaterThan(0);
    expect(screen.queryByText('Sin cobertura ART vigente - ACME SA')).toBeNull();

    const chip = screen.getByRole('button', { name: /Prospección ART \(3\)/ });
    expect(chip.getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: /Próximas acciones \(1\)/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Libres \(1\)/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Todas \(5\)/ })).toBeTruthy();

    fireEvent.click(chip);
    expect(screen.getByText('Sin cobertura ART vigente - ACME SA')).toBeTruthy();
    expect(screen.getByText('Vencidas (3)')).toBeTruthy();
  });

  it('"Todas" prende los tres grupos', async () => {
    render(<AgendaPanel token="t" />);
    await screen.findByText('Pasar por la compañía');
    fireEvent.click(screen.getByRole('button', { name: /Todas/ }));
    expect(screen.getByText('Cotizar ART — aniversario 2026-10-01')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Todas/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('la hora se muestra en hora argentina, 24 h (13:00 UTC = 10:00)', async () => {
    render(<AgendaPanel token="t" />);
    await screen.findByText('Pasar por la compañía');
    expect(screen.getAllByText('28/09/2026 10:00').length).toBeGreaterThan(0);
  });

  // C-9j: la confirmación es el modal propio, nunca `window.confirm`.
  it('completar una tarea libre abre el modal propio; Cancelar no llama al PATCH', async () => {
    const nativo = vi.spyOn(window, 'confirm');
    render(<AgendaPanel token="t" />);
    fireEvent.click(await screen.findByLabelText('Completar Pasar por la compañía'));
    const dialogo = screen.getByRole('alertdialog', { name: PREGUNTA_COMPLETAR });
    expect(within(dialogo).getByText('Pasar por la compañía')).toBeTruthy();
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(patches).toHaveLength(0);
    expect(nativo).not.toHaveBeenCalled();
  });

  it('Confirmar sí llama al PATCH y cierra el modal', async () => {
    render(<AgendaPanel token="t" />);
    fireEvent.click(await screen.findByLabelText('Completar Pasar por la compañía'));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como hecha' }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toContain('/tareas/li/completar');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('completar una de prospección ART también pasa por el modal', async () => {
    render(<AgendaPanel token="t" />);
    await screen.findByText('Pasar por la compañía');
    fireEvent.click(screen.getByRole('button', { name: /Prospección ART/ }));
    fireEvent.click(screen.getByLabelText('Completar Sin cobertura ART vigente - ACME SA'));
    expect(screen.getByRole('alertdialog', { name: PREGUNTA_COMPLETAR })).toBeTruthy();
    expect(patches).toHaveLength(0);
  });

  it('una de próxima acción NO pide confirmación (abre su formulario)', async () => {
    render(<AgendaPanel token="t" />);
    await screen.findByText('Pasar por la compañía');
    fireEvent.click(screen.getAllByLabelText('Completar Llamar a Juan')[0]);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(patches).toHaveLength(0);
  });
});
