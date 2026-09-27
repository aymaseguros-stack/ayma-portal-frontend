// @vitest-environment jsdom
//
// OPERACIONES-0013 · ART-121 FE-1 - la marca `impedimento` en el CRM.
// El backend (#235) manda el objeto de `impedimento_comercial` en los ítems de
// /crm/oportunidades, /pipeline, /crm/tareas/agenda y en las tareas del
// GET /crm/oportunidades/{id}. Acá sólo se pinta el MISMO badge de FE #94
// (`BadgeImpedida`): con impedimento, "Impedida · <motivo>" y `como_revertir`
// como tooltip; con null o sin el campo, nada. Sólo lectura: no se esconde ni
// se deshabilita nada.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import PipelineKanban from './PipelineKanban';
import BuscadorOportunidades from './BuscadorOportunidades';
import AgendaPanel from './AgendaPanel';
import OportunidadFichaModal from './OportunidadFichaModal';

const COMO_REVERTIR = 'Cargar ACTIVO o DESCONOCIDO en POST /art/empresas/{cuit}/estado-arca.';
const impedimento = (over = {}) => ({
  empresa_id: 'e-9', cuit: '30-71000009-1', razon_social: 'CASEL SACEI',
  impedida: true, motivo: 'ESTADO_ARCA:BAJA_OFICIO', estado_arca: 'BAJA_OFICIO',
  estado_arca_fuente: 'PADRON_A5', estado_arca_fecha: '2026-09-20',
  no_cotizar_motivo: null, como_revertir: COMO_REVERTIR,
  ...over,
});

const oportunidad = (extra = {}) => ({
  id: 'o-1', token: 'OPO-0001', track: 'ART', estado_crm: 'PROSPECTO',
  nombre_vinculado: 'CASEL SACEI', prima_estimada: '100000', persona_id: null,
  empresa_id: 'e-9', updated_at: '2026-09-18T10:00:00',
  ...extra,
});

const tarea = (extra = {}) => ({
  id: 't-1', titulo: 'Cotizar ART — aniversario CASEL', tipo: 'COTIZAR', prioridad: 'MEDIA',
  estado: 'PENDIENTE', fecha_programada: '2026-09-28T10:00:00',
  ...extra,
});

const json = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });
let rutas;

beforeEach(() => {
  rutas = [];
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const texto = String(url);
    const metodo = opts.method || 'GET';
    const r = rutas.find(([frag, m]) => texto.includes(frag) && (m || 'GET') === metodo);
    return json(r ? r[2] : {});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const badges = () => screen.queryAllByTestId('badge-impedida');

describe('PipelineKanban · tarjetas', () => {
  const pipeline = (ops) => ({
    columnas: [{ estado_crm: 'PROSPECTO', cantidad: ops.length, prima_estimada_total: 0, oportunidades: ops }],
  });

  it('con impedimento pinta el badge con motivo y como_revertir de tooltip', async () => {
    rutas.push(['/pipeline', 'GET', pipeline([oportunidad({ impedimento: impedimento() })])]);
    render(<PipelineKanban token="t" />);
    const badge = await screen.findByTestId('badge-impedida');
    expect(badge.textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
    expect(badge.getAttribute('title')).toBe(COMO_REVERTIR);
    // Sólo lectura: la tarjeta sigue siendo arrastrable y clickeable.
    expect(badge.closest('div[draggable]')).toBeTruthy();
  });

  it('con null o sin el campo no pinta nada', async () => {
    rutas.push(['/pipeline', 'GET', pipeline([
      oportunidad({ id: 'o-1', nombre_vinculado: 'Con null', impedimento: null }),
      oportunidad({ id: 'o-2', nombre_vinculado: 'Sin campo' }),
    ])]);
    render(<PipelineKanban token="t" />);
    await screen.findByText('Sin campo');
    expect(screen.getByText('Con null')).toBeTruthy();
    expect(badges()).toHaveLength(0);
  });
});

describe('BuscadorOportunidades · resultados', () => {
  it('marca sólo el resultado impedido', async () => {
    rutas.push(['/crm/oportunidades', 'GET', { items: [
      oportunidad({ id: 'o-1', nombre_vinculado: 'CASEL SACEI', impedimento: impedimento({ motivo: 'NO_COTIZAR:SIN_MOTIVO' }) }),
      oportunidad({ id: 'o-2', nombre_vinculado: 'OTRA SRL', impedimento: null }),
      oportunidad({ id: 'o-3', nombre_vinculado: 'TERCERA SA' }),
    ] }]);
    const onAbrir = vi.fn();
    render(<BuscadorOportunidades token="t" onAbrir={onAbrir} />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'casel' } });
    await screen.findByText('TERCERA SA', {}, { timeout: 2000 });
    expect(badges()).toHaveLength(1);
    const fila = screen.getByText('CASEL SACEI').closest('button');
    expect(within(fila).getByTestId('badge-impedida').textContent).toBe('Impedida · NO_COTIZAR:SIN_MOTIVO');
    // No se deshabilita: abrir sigue funcionando y lleva el ítem.
    fireEvent.click(fila);
    expect(onAbrir).toHaveBeenCalledWith('o-1', expect.objectContaining({ impedimento: expect.any(Object) }));
  });
});

describe('AgendaPanel · tareas', () => {
  it('con impedimento badge; null o ausente, nada', async () => {
    rutas.push(['/crm/tareas/agenda', 'GET', {
      vencidas: [tarea({ id: 't-1', titulo: 'Tarea impedida', impedimento: impedimento() })],
      dias: { '2026-09-28': [
        tarea({ id: 't-2', titulo: 'Tarea null', impedimento: null }),
        tarea({ id: 't-3', titulo: 'Tarea sin campo' }),
      ] },
    }]);
    render(<AgendaPanel token="t" />);
    await screen.findByText('Tarea sin campo');
    expect(badges()).toHaveLength(1);
    const fila = screen.getByText('Tarea impedida').closest('div.rounded-lg');
    const badge = within(fila).getByTestId('badge-impedida');
    expect(badge.textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
    expect(badge.getAttribute('title')).toBe(COMO_REVERTIR);
    expect(within(fila).getByRole('checkbox').disabled).toBe(false);
  });
});

describe('OportunidadFichaModal · encabezado y tareas', () => {
  const detalle = (extra = {}) => ({
    id: 'o-1', token: 'OPO-0001', track: 'ART', estado_crm: 'PROSPECTO',
    resultado: 'EN_CURSO', prima_estimada: null, nombre_vinculado: 'CASEL SACEI',
    persona_id: null, empresa_id: null, tareas: [], adjuntos_count: 0,
    etapa_saida: 'ATENCION', origen: 'OTRO', notas: null,
    ...extra,
  });
  const abrirTareas = () => fireEvent.click(
    [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Tareas'),
  );

  it('el encabezado usa el impedimento del ítem del listado', async () => {
    rutas.push(['/crm/oportunidades/o-1', 'GET', detalle()]);
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} impedimento={impedimento()} />);
    const badge = await screen.findByTestId('badge-impedida');
    expect(badge.textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
    expect(badge.getAttribute('title')).toBe(COMO_REVERTIR);
  });

  it('sin impedimento no hay badge en el encabezado', async () => {
    rutas.push(['/crm/oportunidades/o-1', 'GET', detalle()]);
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await screen.findByText('OPO-0001');
    expect(badges()).toHaveLength(0);
  });

  it('cada tarea listada lleva su propia marca', async () => {
    rutas.push(['/crm/oportunidades/o-1', 'GET', detalle({ tareas: [
      tarea({ id: 't-1', titulo: 'Tarea impedida', impedimento: impedimento() }),
      tarea({ id: 't-2', titulo: 'Tarea null', impedimento: null }),
      tarea({ id: 't-3', titulo: 'Tarea sin campo' }),
    ] })]);
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await screen.findByText('OPO-0001');
    abrirTareas();
    await screen.findByText('Tarea sin campo');
    expect(badges()).toHaveLength(1);
    const fila = screen.getByText('Tarea impedida').closest('div.rounded-lg');
    expect(within(fila).getByTestId('badge-impedida').textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
  });
});
