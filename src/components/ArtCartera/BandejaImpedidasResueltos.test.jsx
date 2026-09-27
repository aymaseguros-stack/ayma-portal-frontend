// @vitest-environment jsdom
//
// OPERACIONES-0013 · ART-121 FE-3 (backend #239): "Ver resueltos"
// (incluir_resueltos), REVERTIR (sólo ADMIN, sólo si la última resolución es
// CERRAR; seco -> firme; 409 bloquea Confirmar) y la ficha de la oportunidad
// abierta desde la razón social.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';
import { TrabajoAbiertoImpedidas } from './Impedimento';
import { CLAVE_ROL } from '../../utils/sesion';

const impedimento = {
  empresa_id: 'e9', cuit: '30-71000009-1', razon_social: 'CASEL SACEI', impedida: true,
  motivo: 'ESTADO_ARCA:BAJA_OFICIO', estado_arca: 'BAJA_OFICIO', como_revertir_texto: 'texto',
};

const abierto = (over = {}) => ({
  tipo: 'oportunidad', item_id: 'o-1', oportunidad_id: 'o-1', empresa_id: 'e9',
  razon_social: 'CASEL SACEI', cuit: '30-71000009-1', impedimento,
  estado: 'DATO', antiguedad_dias: 12, en_pool: true, ultima_resolucion: null,
  ...over,
});

const cerradoPorResolver = (over = {}) => abierto({
  item_id: 'o-2', oportunidad_id: 'o-2', razon_social: 'TRANSPORTES CAÑADA', impedimento: null,
  ultima_resolucion: { decision: 'CERRAR', por: 'u-admin', en: '2026-09-26T15:30:00+00:00' },
  cerrado_por_resolver: true, resolucion_id: 'r-1',
  ...over,
});

const resumen = { total_empresas: 1, totales_por_tipo: { oportunidad: 1, tarea: 0, pedido_abierto: 0 }, conteos: [], empresas: [] };

const ok = (data) => ({ ok: true, status: 200, json: async () => data });
const conflicto = (detail) => ({ ok: false, status: 409, json: async () => ({ detail }) });

let llamadas;
let abiertos;
let resueltos;
let resolver;

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
  llamadas = [];
  abiertos = [abierto()];
  resueltos = [cerradoPorResolver()];
  resolver = () => ok({});
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const metodo = (opts.method || 'GET').toUpperCase();
    llamadas.push({ metodo, path: u.pathname, search: u.searchParams, body: opts.body ? JSON.parse(opts.body) : null });
    if (u.pathname.endsWith('/impedidas-trabajo-abierto') && metodo === 'GET') {
      if (u.searchParams.get('detalle') !== 'true') return ok(resumen);
      if (u.searchParams.get('incluir_resueltos') === 'true') {
        return ok({
          ...resumen,
          items: [...abiertos.map((i) => ({ ...i, cerrado_por_resolver: false })), ...resueltos],
          pendientes_de_decision: abiertos.length,
          resueltos_total: resueltos.length,
        });
      }
      return ok({ ...resumen, items: abiertos, pendientes_de_decision: abiertos.length });
    }
    if (u.pathname.endsWith('/resolver') && metodo === 'POST') return resolver(u, JSON.parse(opts.body));
    if (u.pathname === '/api/v1/crm/oportunidades/o-1' && metodo === 'GET') {
      return ok({
        id: 'o-1', token: 'OPO-0001', track: 'ART', estado_crm: 'DATO', resultado: 'EN_CURSO',
        prima_estimada: null, nombre_vinculado: 'CASEL SACEI', persona_id: null, empresa_id: 'e9',
        tareas: [], adjuntos_count: 0, etapa_saida: 'SONDEO', origen: 'OTRO', notas: null, impedimento,
      });
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

const censos = () => llamadas.filter((l) => l.metodo === 'GET' && l.path.endsWith('/impedidas-trabajo-abierto') && l.search.get('detalle') === 'true');
const posts = () => llamadas.filter((l) => l.metodo === 'POST');

describe('Ver resueltos', () => {
  it('sin el interruptor: la llamada no lleva incluir_resueltos y no hay resueltos', async () => {
    await abrirBandeja();
    const filas = await screen.findAllByTestId('fila-impedida');
    expect(filas).toHaveLength(1);
    expect(censos()).toHaveLength(1);
    expect(censos()[0].search.has('incluir_resueltos')).toBe(false);
    expect(screen.queryByTestId('marca-resuelto')).toBeNull();
    expect(screen.queryByRole('button', { name: 'REVERTIR' })).toBeNull();
  });

  it('con el interruptor: pide incluir_resueltos=true y distingue los resueltos', async () => {
    await abrirBandeja();
    await screen.findAllByTestId('fila-impedida');
    fireEvent.click(screen.getByLabelText('Ver resueltos'));
    await waitFor(() => expect(screen.getAllByTestId('fila-impedida')).toHaveLength(2));
    const ultima = censos().at(-1);
    expect(ultima.search.get('incluir_resueltos')).toBe('true');
    const [fAbierta, fResuelta] = screen.getAllByTestId('fila-impedida');
    expect(fAbierta.dataset.resuelto).toBe('false');
    expect(fResuelta.dataset.resuelto).toBe('true');
    expect(within(fResuelta).getByTestId('marca-resuelto')).toBeTruthy();
    expect(within(fAbierta).queryByTestId('marca-resuelto')).toBeNull();
    // El resuelto no ofrece CERRAR/MANTENER, sólo REVERTIR.
    expect(within(fResuelta).queryByRole('button', { name: 'CERRAR' })).toBeNull();
    expect(within(fResuelta).getByRole('button', { name: 'REVERTIR' })).toBeTruthy();
    expect(within(fAbierta).queryByRole('button', { name: 'REVERTIR' })).toBeNull();
    expect(screen.getByTestId('resueltos-total').textContent).toMatch(/1 resueltos/);
    // Apagarlo vuelve a la bandeja de siempre.
    fireEvent.click(screen.getByLabelText('Ver resueltos'));
    await waitFor(() => expect(screen.getAllByTestId('fila-impedida')).toHaveLength(1));
    expect(censos().at(-1).search.has('incluir_resueltos')).toBe(false);
  });
});

describe('REVERTIR', () => {
  const verResueltos = async () => {
    await abrirBandeja();
    await screen.findAllByTestId('fila-impedida');
    fireEvent.click(screen.getByLabelText('Ver resueltos'));
    await waitFor(() => expect(screen.getAllByTestId('fila-impedida')).toHaveLength(2));
  };

  it('sólo aparece si la última resolución es CERRAR', async () => {
    abiertos = [abierto({ item_id: 'o-3', ultima_resolucion: { decision: 'MANTENER', por: 'u', en: '2026-09-26T10:00:00Z' } })];
    resueltos = [cerradoPorResolver(), cerradoPorResolver({ item_id: 'o-4', ultima_resolucion: { decision: 'REVERTIR', por: 'u', en: '2026-09-27T10:00:00Z' } })];
    await abrirBandeja();
    await screen.findAllByTestId('fila-impedida');
    fireEvent.click(screen.getByLabelText('Ver resueltos'));
    await waitFor(() => expect(screen.getAllByTestId('fila-impedida')).toHaveLength(3));
    const filas = screen.getAllByTestId('fila-impedida');
    expect(within(filas[0]).queryByRole('button', { name: 'REVERTIR' })).toBeNull();
    expect(within(filas[1]).getByRole('button', { name: 'REVERTIR' })).toBeTruthy();
    expect(within(filas[2]).queryByRole('button', { name: 'REVERTIR' })).toBeNull();
  });

  it('sin ADMIN no hay REVERTIR', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    await verResueltos();
    expect(screen.queryByRole('button', { name: 'REVERTIR' })).toBeNull();
  });

  it('seco -> firme con el mismo body, muestra tareas que vuelven y refresca; el ítem vuelve a CERRAR/MANTENER', async () => {
    resolver = (u, body) => {
      const firme = u.searchParams.get('dry_run') === 'false';
      if (firme) {
        // Después del REVERTIR el ítem vuelve a ser trabajo abierto.
        resueltos = [];
        abiertos = [abierto(), abierto({
          item_id: 'o-2', oportunidad_id: 'o-2', razon_social: 'TRANSPORTES CAÑADA',
          ultima_resolucion: { decision: 'REVERTIR', por: 'u-admin', en: '2026-09-27T12:00:00Z' },
        })];
      }
      return ok({
        escritura: firme, dry_run: !firme, tipo: 'oportunidad', item_id: 'o-2', decision: body.decision,
        antes: { estado_crm: 'DATO', no_colocable_motivo: 'EMPRESA_IMPEDIDA' },
        despues: { estado_crm: 'DATO', no_colocable_motivo: null },
        cascada: [{ tipo: 'tarea', item_id: 't-1', antes: { estado: 'CANCELADA', titulo: 'Cotizar ART — aniversario' }, despues: { estado: 'PENDIENTE', titulo: 'Cotizar ART — aniversario' } }],
      });
    };
    await verResueltos();
    fireEvent.click(screen.getByRole('button', { name: 'REVERTIR' }));
    const modal = screen.getByLabelText('Resolver impedida');
    expect(within(modal).getByLabelText('REVERTIR').checked).toBe(true);
    expect(within(modal).queryByLabelText('CERRAR')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    const cascada = await screen.findByTestId('cascada-resolver');
    expect(cascada.textContent).toMatch(/Tareas que vuelven a PENDIENTE: 1/);
    expect(cascada.textContent).toMatch(/CANCELADA → PENDIENTE/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(false));
    const antes = censos().length;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(screen.queryByLabelText('Resolver impedida')).toBeNull());

    const p = posts();
    expect(p).toHaveLength(2);
    expect(p[0].path).toBe('/api/v1/art/admin/impedidas-trabajo-abierto/oportunidad/o-2/resolver');
    expect(p[0].search.get('dry_run')).toBe('true');
    expect(p[1].search.get('dry_run')).toBe('false');
    expect(p[0].body).toEqual({ decision: 'REVERTIR' });
    expect(p[1].body).toEqual(p[0].body);
    await waitFor(() => expect(censos().length).toBeGreaterThan(antes));
    // Refrescó también los contadores de la tarjeta (GET sin detalle).
    expect(llamadas.filter((l) => l.metodo === 'GET' && l.path.endsWith('/impedidas-trabajo-abierto') && !l.search.has('detalle')).length).toBeGreaterThanOrEqual(2);
    await waitFor(() => {
      const fila = screen.getAllByTestId('fila-impedida').find((f) => f.textContent.includes('TRANSPORTES'));
      expect(fila.dataset.resuelto).toBe('false');
      expect(within(fila).getByRole('button', { name: 'CERRAR' })).toBeTruthy();
      expect(within(fila).getByRole('button', { name: 'MANTENER' })).toBeTruthy();
      expect(within(fila).queryByRole('button', { name: 'REVERTIR' })).toBeNull();
    });
  });

  it.each([
    ['NADA_QUE_REVERTIR', /No hay nada que revertir/],
    ['ITEM_CERRADO', /ya no es trabajo abierto/],
  ])('409 %s: mensaje en castellano y Confirmar deshabilitado', async (codigo, texto) => {
    resolver = () => conflicto({ codigo, mensaje: 'texto del backend' });
    await verResueltos();
    fireEvent.click(screen.getByRole('button', { name: 'REVERTIR' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    expect((await screen.findByTestId('conflicto-resolver')).textContent).toMatch(texto);
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(confirmar);
    expect(posts()).toHaveLength(1);
  });
});

describe('Ficha desde la bandeja', () => {
  it('clic en la razón social abre OportunidadFichaModal con ese id', async () => {
    await abrirBandeja();
    const fila = (await screen.findAllByTestId('fila-impedida'))[0];
    fireEvent.click(within(fila).getByRole('button', { name: 'CASEL SACEI' }));
    expect(await screen.findByText('OPO-0001')).toBeTruthy();
    expect(llamadas.some((l) => l.metodo === 'GET' && l.path === '/api/v1/crm/oportunidades/o-1')).toBe(true);
  });

  it('sin oportunidad_id la razón social no es clicable', async () => {
    abiertos = [abierto({ tipo: 'tarea', item_id: 't-9', oportunidad_id: null })];
    await abrirBandeja();
    const fila = (await screen.findAllByTestId('fila-impedida'))[0];
    expect(within(fila).queryByRole('button', { name: 'CASEL SACEI' })).toBeNull();
    expect(within(fila).getByText('CASEL SACEI')).toBeTruthy();
  });
});
