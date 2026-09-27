// @vitest-environment jsdom
//
// OPERACIONES-0013 · ART-121 FE-2 - bandeja de decisión sobre el trabajo
// abierto de empresas impedidas (backend #237/#238). Cubren: la bandeja
// dentro de la tarjeta de Dirección (en_pool true/false, última resolución
// null y con valor, pendientes_de_decision), el circuito Previsualizar ->
// Confirmar (dry_run true y después false; un 409 no habilita Confirmar; sin
// ADMIN no hay botones), el tooltip del badge (como_revertir_texto con
// fallback) y el encabezado de la ficha (detalle con prioridad, prop de
// fallback).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { TrabajoAbiertoImpedidas } from './Impedimento';
import BadgeImpedida from './BadgeImpedida';
import OportunidadFichaModal from '../Crm/OportunidadFichaModal';
import { CLAVE_ROL } from '../../utils/sesion';

const TEXTO = 'La empresa figura con baja de oficio en ARCA: hasta que no la regularice no se cotiza.';
const TECNICO = 'Cargar ACTIVO o DESCONOCIDO en POST /art/empresas/{cuit}/estado-arca.';

const impedimento = (over = {}) => ({
  empresa_id: 'e9', cuit: '30-71000009-1', razon_social: 'CASEL SACEI', impedida: true,
  motivo: 'ESTADO_ARCA:BAJA_OFICIO', estado_arca: 'BAJA_OFICIO', estado_arca_fuente: 'PADRON_A5',
  estado_arca_fecha: '2026-09-20', no_cotizar_motivo: null,
  como_revertir: TECNICO, como_revertir_texto: TEXTO,
  ...over,
});

const item = (over = {}) => ({
  tipo: 'oportunidad', item_id: 'o-1', oportunidad_id: 'o-1', empresa_id: 'e9',
  razon_social: 'CASEL SACEI', cuit: '30-71000009-1', impedimento: impedimento(),
  estado: 'DATO', antiguedad_dias: 12, en_pool: true, ultima_resolucion: null,
  ...over,
});

const resumen = {
  total_empresas: 1,
  totales_por_tipo: { oportunidad: 1, tarea: 1, pedido_abierto: 0 },
  conteos: [],
  empresas: [{ empresa_id: 'e9', cuit: '30-71000009-1', razon_social: 'CASEL SACEI', motivo: 'ESTADO_ARCA:BAJA_OFICIO', impedimento: impedimento(), oportunidad: 1, tarea: 1, pedido_abierto: 0 }],
};

const detalleCenso = (items, pendientes) => ({ ...resumen, items, pendientes_de_decision: pendientes });

const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const conflicto = (detail) => ({ ok: false, status: 409, json: async () => ({ detail }) });

let llamadas;
let censo;
let resolver;

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
  llamadas = [];
  censo = detalleCenso([item()], 1);
  resolver = () => ok({});
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const metodo = (opts.method || 'GET').toUpperCase();
    llamadas.push({ metodo, path: u.pathname, search: u.searchParams, body: opts.body ? JSON.parse(opts.body) : null });
    if (u.pathname.endsWith('/impedidas-trabajo-abierto') && metodo === 'GET') {
      return ok(u.searchParams.get('detalle') === 'true' ? censo : resumen);
    }
    if (u.pathname.endsWith('/resolver') && metodo === 'POST') {
      return resolver(u, JSON.parse(opts.body));
    }
    return { ok: false, status: 404, json: async () => ({ detail: 'sin mock' }) };
  });
});
afterEach(cleanup);

const abrirBandeja = async () => {
  render(<TrabajoAbiertoImpedidas token="t" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar casos' }));
  return screen.findByTestId('bandeja-impedidas');
};

const gets = (detalle) => llamadas.filter((l) => l.metodo === 'GET' && (l.search.get('detalle') === 'true') === detalle);
const posts = () => llamadas.filter((l) => l.metodo === 'POST');

describe('Bandeja dentro de la tarjeta', () => {
  it('pide detalle=true y muestra columnas, en_pool y última resolución', async () => {
    censo = detalleCenso([
      item(),
      item({
        tipo: 'tarea', item_id: 't-7', estado: 'PENDIENTE', en_pool: false, antiguedad_dias: 3,
        ultima_resolucion: { decision: 'MANTENER', por: 'u-admin', en: '2026-09-26T15:30:00+00:00' },
      }),
    ], 1);
    await abrirBandeja();
    expect(gets(true)).toHaveLength(1);
    expect((await screen.findByTestId('pendientes-de-decision')).textContent).toMatch(/Pendientes de decisión: 1/);
    const filas = screen.getAllByTestId('fila-impedida');
    expect(filas).toHaveLength(2);
    // Orden del backend, tal cual.
    expect(within(filas[0]).getByText('Oportunidad')).toBeTruthy();
    expect(within(filas[0]).getByText('Sí')).toBeTruthy();
    expect(within(filas[0]).getByText('Sin decisión')).toBeTruthy();
    expect(within(filas[0]).getByText('12 días')).toBeTruthy();
    expect(within(filas[0]).getByTestId('badge-impedida')).toBeTruthy();
    expect(within(filas[1]).getByText('Tarea')).toBeTruthy();
    expect(within(filas[1]).getByText('No')).toBeTruthy();
    const ultima = within(filas[1]).getByTestId('ultima-resolucion');
    expect(ultima.textContent).toMatch(/^MANTENER · u-admin · /);
  });

  it('un pedido abierto no tiene botones de decisión', async () => {
    censo = detalleCenso([item({ tipo: 'pedido_abierto', item_id: 'ev-1', estado: 'PEDIDA', ultima_resolucion: null })], 0);
    await abrirBandeja();
    const fila = (await screen.findAllByTestId('fila-impedida'))[0];
    expect(within(fila).getByText('Pedido')).toBeTruthy();
    expect(within(fila).queryByRole('button', { name: 'CERRAR' })).toBeNull();
  });

  it('sin ADMIN no hay botones CERRAR ni MANTENER', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    await abrirBandeja();
    await screen.findAllByTestId('fila-impedida');
    expect(screen.queryByRole('button', { name: 'CERRAR' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'MANTENER' })).toBeNull();
  });
});

describe('Previsualizar -> Confirmar', () => {
  it('llama dry_run=true y después dry_run=false con el mismo body, y refresca', async () => {
    resolver = (u, body) => ok({
      escritura: u.searchParams.get('dry_run') === 'false', dry_run: u.searchParams.get('dry_run') === 'true',
      tipo: 'OPORTUNIDAD', item_id: 'o-1', decision: body.decision, detalle: body.detalle ?? null,
      antes: { estado_crm: 'DATO', no_colocable_motivo: null },
      despues: { estado_crm: 'DATO', no_colocable_motivo: 'EMPRESA_IMPEDIDA' },
      impedimento: impedimento(),
      cascada: [{ tipo: 'TAREA', item_id: 't-1', antes: { estado: 'PENDIENTE', titulo: 'Cotizar ART — aniversario' }, despues: { estado: 'CANCELADA', titulo: 'Cotizar ART — aniversario' } }],
    });
    await abrirBandeja();
    fireEvent.click(await screen.findByRole('button', { name: 'CERRAR' }));
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Detalle (opcional)'), { target: { value: 'baja de oficio confirmada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    expect((await screen.findByTestId('cascada-resolver')).textContent).toMatch(/Tareas que se cancelarían: 1/);
    expect(screen.getByText('EMPRESA_IMPEDIDA')).toBeTruthy();
    const getsAntes = gets(true).length + gets(false).length;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.queryByLabelText('Resolver impedida')).toBeNull());

    const p = posts();
    expect(p).toHaveLength(2);
    expect(p[0].path).toBe('/api/v1/art/admin/impedidas-trabajo-abierto/oportunidad/o-1/resolver');
    expect(p[0].search.get('dry_run')).toBe('true');
    expect(p[1].search.get('dry_run')).toBe('false');
    expect(p[0].body).toEqual({ decision: 'CERRAR', detalle: 'baja de oficio confirmada' });
    expect(p[1].body).toEqual(p[0].body);
    // Refresca la bandeja (detalle=true) y los contadores de la tarjeta.
    await waitFor(() => expect(gets(true).length + gets(false).length).toBeGreaterThanOrEqual(getsAntes + 2));
    expect(gets(false).length).toBeGreaterThanOrEqual(2);
  });

  it('cambiar la decisión después de previsualizar deshabilita Confirmar', async () => {
    resolver = () => ok({ antes: {}, despues: {}, cascada: [] });
    await abrirBandeja();
    fireEvent.click(await screen.findByRole('button', { name: 'CERRAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(false));
    fireEvent.click(screen.getByLabelText('MANTENER'));
    expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(true);
    expect(screen.getByText(/volvé a previsualizar/)).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });

  it.each([
    ['EMPRESA_NO_IMPEDIDA', /ya no está impedida/],
    ['ITEM_CERRADO', /ya no es trabajo abierto/],
    ['VIA_NO_APLICA', /NO COLOCABLE sólo se declara desde DATO o PROSPECTO.*POTENCIAL/],
  ])('409 %s: mensaje legible y Confirmar deshabilitado', async (codigo, texto) => {
    resolver = () => conflicto({ codigo, mensaje: 'texto del backend', estado_crm: 'POTENCIAL' });
    await abrirBandeja();
    fireEvent.click(await screen.findByRole('button', { name: 'CERRAR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    expect((await screen.findByTestId('conflicto-resolver')).textContent).toMatch(texto);
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(confirmar);
    expect(posts()).toHaveLength(1);
    expect(posts()[0].search.get('dry_run')).toBe('true');
  });
});

describe('BadgeImpedida · tooltip', () => {
  it('usa como_revertir_texto', () => {
    render(<BadgeImpedida impedimento={impedimento()} />);
    expect(screen.getByTestId('badge-impedida').getAttribute('title')).toBe(TEXTO);
  });

  it('sin texto, cae en como_revertir', () => {
    render(<BadgeImpedida impedimento={impedimento({ como_revertir_texto: null })} />);
    expect(screen.getByTestId('badge-impedida').getAttribute('title')).toBe(TECNICO);
  });
});

describe('OportunidadFichaModal · encabezado', () => {
  const detalle = (extra = {}) => ({
    id: 'o-1', token: 'OPO-0001', track: 'ART', estado_crm: 'DATO', resultado: 'EN_CURSO',
    prima_estimada: null, nombre_vinculado: 'CASEL SACEI', persona_id: null, empresa_id: 'e9',
    tareas: [], adjuntos_count: 0, etapa_saida: 'SONDEO', origen: 'OTRO', notas: null,
    ...extra,
  });
  const montar = (d, prop) => {
    globalThis.fetch = vi.fn(async (url) => ok(String(url).includes('/crm/oportunidades/o-1') ? d : {}));
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} impedimento={prop} />);
  };

  it('toma el impedimento del detalle con prioridad sobre el prop', async () => {
    montar(detalle({ impedimento: impedimento({ motivo: 'NO_COTIZAR:SIN_MOTIVO' }) }), impedimento());
    expect((await screen.findByTestId('badge-impedida')).textContent).toBe('Impedida · NO_COTIZAR:SIN_MOTIVO');
  });

  it('detalle con impedimento null gana: la empresa dejó de estar impedida', async () => {
    montar(detalle({ impedimento: null }), impedimento());
    await screen.findByText('OPO-0001');
    expect(screen.queryAllByTestId('badge-impedida')).toHaveLength(0);
  });

  it('detalle sin la clave: fallback al prop del listado', async () => {
    montar(detalle(), impedimento());
    expect((await screen.findByTestId('badge-impedida')).textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
  });
});
