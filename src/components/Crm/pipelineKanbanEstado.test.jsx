// @vitest-environment jsdom
//
// El Kanban ya NO escribe el estado del embudo.
//
// EL BUG QUE CIERRA. Soltar una tarjeta en otra columna hacía
// `PATCH /crm/oportunidades/{id}/estado` con el estado de la columna: el estado
// comercial era literalmente lo que alguien arrastró, sin que hubiera pasado
// nada. Desde el PR #176 del backend ese PATCH pasa por la máquina de
// transiciones y contesta 409 - así que arrastrar a PROSPECTO/POTENCIAL/CLIENTE
// sólo podía producir un cartel de error y, peor, un optimistic update que
// movía la tarjeta antes de que el backend la rechazara.
//
// Quedan LOOP y RECUPERABLE, que sí son explícitas y piden sus campos.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PipelineKanban from './PipelineKanban';

const oportunidad = (extra = {}) => ({
  id: 'o-1', token: 'OPO-0001', track: 'AUTO', estado_crm: 'PROSPECTO',
  nombre_vinculado: 'Juan Pérez', prima_estimada: '100000', persona_id: 'p-1',
  empresa_id: null, agente_id: 'a-1', updated_at: '2026-09-18T10:00:00',
  ...extra,
});

let llamadas;

const json = (data, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 409, json: async () => data });

beforeEach(() => {
  llamadas = [];
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    llamadas.push({ url: String(url), metodo, body: opts.body });
    if (String(url).includes('/pipeline')) {
      return json({
        columnas: [
          { estado_crm: 'PROSPECTO', cantidad: 1, prima_estimada_total: 100000, oportunidades: [oportunidad()] },
        ],
      });
    }
    if (String(url).includes('/transicion')) {
      return json({
        oportunidad_id: 'o-1', token: 'OPO-0001', estado_anterior: 'PROSPECTO',
        estado_crm: 'LOOP', estado_cambio: true, puntos: '0', interaccion_id: 'i-1',
      });
    }
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const tarjeta = async () => {
  await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());
  return screen.getByText('Juan Pérez').closest('div[draggable]');
};
const columna = (label) => screen.getByText(label, { selector: 'span' })
  .closest('div[class*="rounded-xl"]');
const patchDeEstado = () => llamadas.filter(
  (l) => l.metodo === 'PATCH' && l.url.includes('/estado'),
);

const arrastrarA = async (label) => {
  const card = await tarjeta();
  fireEvent.dragStart(card, { dataTransfer: { effectAllowed: '' } });
  fireEvent.drop(columna(label));
};

describe('PipelineKanban · el estado no se arrastra', () => {
  it('soltar en POTENCIAL no manda ningún PATCH de estado y explica el camino', async () => {
    render(<PipelineKanban token="t" />);
    await arrastrarA('Potencial');

    await waitFor(() => expect(document.body.textContent).toContain('no se asigna a mano'));
    expect(patchDeEstado()).toEqual([]);
    expect(document.body.textContent).toContain('registrá la cotización entregada');
  });

  it('tampoco en CLIENTE ni en DATO', async () => {
    render(<PipelineKanban token="t" />);
    await arrastrarA('Cliente');
    await arrastrarA('Dato');
    expect(patchDeEstado()).toEqual([]);
  });

  it('soltar en LOOP abre el modal que pide la fecha de recontacto', async () => {
    render(<PipelineKanban token="t" />);
    await arrastrarA('Loop');

    await waitFor(() => expect(screen.getByText('Pasar a LOOP', { selector: 'h3' })).toBeTruthy());
    expect(screen.getByLabelText('Fecha de recontacto *')).toBeTruthy();
    // El modal recién se abrió: todavía no se mandó nada.
    expect(llamadas.some((l) => l.url.includes('/transicion'))).toBe(false);
  });

  it('confirmando el LOOP manda POST /transicion (no PATCH /estado) y recarga el pipeline', async () => {
    render(<PipelineKanban token="t" />);
    await arrastrarA('Loop');
    await waitFor(() => expect(screen.getByLabelText('Fecha de recontacto *')).toBeTruthy());

    // D-B8: declarar el resultado del LOOP es obligatorio (ver
    // declaracionLoop.test.jsx); sin eso ni se manda el POST.
    fireEvent.click(screen.getByRole('radio', { name: /Sin efecto/i }));
    fireEvent.change(screen.getByLabelText('Fecha de recontacto *'), { target: { value: '2026-12-01' } });
    fireEvent.click([...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Confirmar LOOP'));

    await waitFor(() => {
      const post = llamadas.find((l) => l.url.includes('/transicion'));
      expect(post).toBeTruthy();
      expect(post.metodo).toBe('POST');
      expect(JSON.parse(post.body)).toMatchObject({
        estado_crm: 'LOOP', fecha_recontacto: '2026-12-01', resultado_loop: 'SIN_EFECTO',
      });
    });
    expect(patchDeEstado()).toEqual([]);
    // Dos GET del pipeline: el del montaje y el de después de la transición.
    await waitFor(() => expect(
      llamadas.filter((l) => l.metodo === 'GET' && l.url.includes('/pipeline')).length,
    ).toBe(2));
  });

  it('soltar en la MISMA columna no hace nada', async () => {
    render(<PipelineKanban token="t" />);
    await arrastrarA('Prospecto');

    expect(patchDeEstado()).toEqual([]);
    expect(document.body.textContent).not.toContain('no se asigna a mano');
  });
});
