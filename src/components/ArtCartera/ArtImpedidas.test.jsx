// @vitest-environment jsdom
//
// OPERACIONES-0012 · ART-115 FE - empresas IMPEDIDAS (estado ARCA excluyente
// o no_cotizar). Cubren: el bloque "Impedidas (N) — no se piden" del armado
// de tanda y el mensaje cuando en firme no se crea la tanda; la línea de
// excluidas de la cola de alícuotas; el badge en bandeja y en el detalle de
// tanda (y que una fila sin impedimento no lo lleve); la tarjeta de trabajo
// abierto; y el 409 EMPRESA_IMPEDIDA traducido a su motivo.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import ArtArmarTanda from './ArtArmarTanda';
import ArtCotizacionesBandejas from './ArtCotizacionesBandejas';
import ArtTandasBoard from './ArtTandasBoard';
import ArtRelevamientoAlicuotas from './ArtRelevamientoAlicuotas';
import { ExcluidasImpedidas, TrabajoAbiertoImpedidas } from './Impedimento';
import { motivoCorto } from './artCotizacionesConstants';
import { formatApiError } from '../../utils/api';

afterEach(cleanup);

const TOKEN = 't';

const impedimento = (over = {}) => ({
  empresa_id: 'e9',
  cuit: '30-71000009-1',
  razon_social: 'CASEL SACEI',
  impedida: true,
  motivo: 'ESTADO_ARCA:BAJA_OFICIO',
  estado_arca: 'BAJA_OFICIO',
  estado_arca_fuente: 'PADRON_A5',
  estado_arca_fecha: '2026-09-20',
  no_cotizar_motivo: null,
  como_revertir: 'Cargar ACTIVO o DESCONOCIDO en POST /art/empresas/{cuit}/estado-arca.',
  ...over,
});

const mockFetch = (rutas) => {
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const clave = `${(opts.method || 'GET').toUpperCase()} ${u.pathname}`;
    const handler = rutas[clave];
    if (!handler) return { ok: false, status: 404, json: async () => ({ detail: `sin mock ${clave}` }), text: async () => '' };
    const data = typeof handler === 'function' ? handler(u, opts) : handler;
    return { ok: true, status: 200, json: async () => data };
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const propuesta = {
  canal: 'SILICON_BROKERS',
  total: 1,
  dias_min_a_vencimiento: 30,
  companias_del_canal: ['berkley'],
  excluidas_ventana_cerrada: 0,
  excluidas_pedido_abierto: 0,
  excluidas_sin_compania: 0,
  excluidas_permanencia_total: 0,
  excluidas_permanencia: [],
  items: [{ empresa_id: 'e1', razon_social: 'ACME SA', cuit: '30-1', aseguradoras: ['berkley'], impedidas: [] }],
};

const tanda = (dryRun, { impedidaTodo }) => ({
  dry_run: dryRun,
  tanda_id: null,
  tanda_creada: false,
  canal: 'SILICON_BROKERS',
  fecha_envio: '2026-09-27',
  empresas: impedidaTodo ? [] : [{
    empresa_id: 'e1', razon_social: 'ACME SA', pedidos: [{ aseguradora: 'berkley', evento_id: null }], impedidas: [], ya_pedidas: [],
  }],
  total_pedidos: impedidaTodo ? 0 : 1,
  total_impedidas: 0,
  total_ya_pedidas: 0,
  empresas_impedidas: [impedimento({ empresa_id: 'e1', razon_social: 'ACME SA' })],
});

describe('Armar tanda con impedidas', () => {
  it('muestra el bloque de impedidas en seco y, en firme sin tanda, "todas impedidas"', async () => {
    mockFetch({
      'GET /api/v1/art/tandas/propuesta': propuesta,
      // En seco todavía había algo que pedir; en firme la empresa ya quedó impedida.
      'POST /api/v1/art/tandas': (u) => tanda(u.searchParams.get('dry_run') !== 'false', {
        impedidaTodo: u.searchParams.get('dry_run') === 'false',
      }),
    });
    render(<ArtArmarTanda token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByLabelText('Incluir ACME SA'));
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));

    const bloque = await screen.findByTestId('empresas-impedidas');
    expect(within(bloque).getByText('Impedidas (1) — no se piden')).toBeTruthy();
    expect(within(bloque).getByText('ESTADO_ARCA:BAJA_OFICIO')).toBeTruthy();
    expect(within(bloque).getByText(/Cargar ACTIVO o DESCONOCIDO/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar envío' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar la tanda' }));
    expect(await screen.findByText('No se creó la tanda: todas las empresas están impedidas.')).toBeTruthy();
    expect(screen.queryByText(/creada\./)).toBeNull();
  });
});

describe('Cola de alícuotas', () => {
  it('muestra la línea de excluidas sin el prefijo ESTADO_ARCA', async () => {
    mockFetch({
      'GET /api/v1/art/cola-alicuotas': {
        total: 0,
        items: [],
        excluidas_impedidas: { total: 5, por_motivo: { 'ESTADO_ARCA:BAJA_OFICIO': 3, 'ESTADO_ARCA:LIMITADA': 2 } },
      },
    });
    render(<ArtRelevamientoAlicuotas token={TOKEN} />);
    expect((await screen.findByTestId('excluidas-impedidas')).textContent)
      .toBe('Excluidas de la cola: 5 (BAJA_OFICIO 3 · LIMITADA 2)');
  });

  it('con total 0 no muestra nada', () => {
    const { container } = render(<ExcluidasImpedidas excluidas={{ total: 0, por_motivo: {} }} />);
    expect(container.textContent).toBe('');
    expect(motivoCorto('NO_COTIZAR:DUPLICADA')).toBe('NO_COTIZAR:DUPLICADA');
  });
});

describe('Badge en bandeja y detalle de tanda', () => {
  it('bandeja: badge rojo con tooltip sólo en la fila impedida', async () => {
    const fila = (id, rs, imp) => ({
      evento_id: id, empresa_id: `e${id}`, cuit: '30-1', razon_social: rs, aseguradora: 'berkley',
      tanda_id: 3, canal: 'SILICON_BROKERS', fecha_pedido: '2026-09-10', dias_sla: 10, estado: 'PEDIDA',
      etapa: 'PEDIDA', fecha_etapa: '2026-09-10', dias_en_etapa: 4, respuesta: null, alicuota: null, impedimento: imp,
    });
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': {
        etapa: 'PEDIDA', total: 2,
        items: [fila(1, 'ACME SA', impedimento()), fila(2, 'BETA SRL', null)],
        resumen: { por_etapa: { PEDIDA: 2 }, total: 2 },
      },
      'GET /api/v1/art/tandas': { items: [] },
      'GET /api/v1/art/dotacion-propuestas': { total: 0, items: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    const acme = (await screen.findByText('ACME SA')).closest('tr');
    const badge = within(acme).getByTestId('badge-impedida');
    expect(badge.textContent).toBe('Impedida · ESTADO_ARCA:BAJA_OFICIO');
    expect(badge.getAttribute('title')).toMatch(/Cargar ACTIVO/);
    expect(within(screen.getByText('BETA SRL').closest('tr')).queryByTestId('badge-impedida')).toBeNull();
  });

  it('detalle de tanda: badge por empresa impedida', async () => {
    mockFetch({
      'GET /api/v1/art/tandas': { items: [{ id: 4, canal: 'SILICON_BROKERS', fecha_envio: '2026-09-21', enviadas: 1, devueltas: 0, faltan: 1, sin_respuesta: 0, empresas: 1, dias_desde_envio: 6, dias_sla: 10 }] },
      'GET /api/v1/art/tandas/4': {
        id: 4, canal: 'SILICON_BROKERS', fecha_envio: '2026-09-21', enviadas: 1, devueltas: 0, faltan: 1, sin_respuesta: 0, dias_desde_envio: 6, dias_sla: 10,
        empresas: [{ empresa_id: 'e9', razon_social: 'CASEL SACEI', cuit: '30-9', impedimento: impedimento({ motivo: 'NO_COTIZAR:DUPLICADA' }), pares: [], enviadas: 1, devueltas: 0, faltan: 1 }],
      },
    });
    render(<ArtTandasBoard token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: '#4' }));
    expect((await screen.findByTestId('badge-impedida')).textContent).toBe('Impedida · NO_COTIZAR:DUPLICADA');
  });
});

describe('Trabajo abierto sobre impedidas', () => {
  it('muestra totales y la lista desplegable', async () => {
    mockFetch({
      'GET /api/v1/art/admin/impedidas-trabajo-abierto': {
        total_empresas: 1,
        totales_por_tipo: { oportunidad: 2, tarea: 1, pedido_abierto: 3 },
        conteos: [],
        empresas: [{ empresa_id: 'e9', cuit: '30-9', razon_social: 'CASEL SACEI', motivo: 'ESTADO_ARCA:SIN_IMPUESTOS', impedimento: impedimento(), oportunidad: 2, tarea: 1, pedido_abierto: 3 }],
      },
    });
    render(<TrabajoAbiertoImpedidas token={TOKEN} />);
    expect(await screen.findByText(/2 oportunidades · 1 tareas · 3 pedidos/)).toBeTruthy();
    expect(screen.getByText('Ver empresas')).toBeTruthy();
    expect(screen.getByText('ESTADO_ARCA:SIN_IMPUESTOS')).toBeTruthy();
  });
});

describe('409 EMPRESA_IMPEDIDA', () => {
  it('formatApiError muestra el motivo y cómo revertirlo', async () => {
    const res = { status: 409, json: async () => ({ detail: { motivo_bloqueo: 'EMPRESA_IMPEDIDA', impedimento: impedimento() } }) };
    const msg = await formatApiError(res);
    expect(msg).toMatch(/^Error 409: Empresa impedida \(ESTADO_ARCA:BAJA_OFICIO\): CASEL SACEI\./);
    expect(msg).toMatch(/Cargar ACTIVO o DESCONOCIDO/);
  });
});
