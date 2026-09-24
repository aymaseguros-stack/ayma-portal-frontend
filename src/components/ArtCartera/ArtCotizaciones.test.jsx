// @vitest-environment jsdom
//
// OPERACIONES-0008 - sub-pestaña "Cotizaciones" de Acción comercial
// (backend PR #204 y #205). Cubren: las cinco solapas de la bandeja con el
// contador que manda el backend; la fila con SLA vencido resaltada; el body
// del modal de respuesta por tipo y que NO se registre sin la confirmación;
// que armar una tanda NUNCA llame a dry_run=false sin pasar por la
// previsualización del mismo body; el override de aseguradoras en el body;
// el badge "Pedida (n)" en la tabla principal y el historial de pedidos en
// el detalle de empresa.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import ArtCotizacionesBandejas from './ArtCotizacionesBandejas';
import ArtArmarTanda from './ArtArmarTanda';
import ArtAccionComercialView from './ArtAccionComercialView';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';
import ArtAccionComercialDetalle from './ArtAccionComercialDetalle';
import { armarBodyRespuesta, armarBodyTanda } from './artCotizacionesConstants';
import { CLAVE_ROL } from '../../utils/sesion';

afterEach(cleanup);

const TOKEN = 't';

const par = (over = {}) => ({
  evento_id: 11,
  empresa_id: 'e1',
  cuit: '30-71000001-7',
  razon_social: 'ACME SA',
  aseguradora: 'berkley',
  tanda_id: 3,
  canal: 'SILICON_BROKERS',
  fecha_pedido: '2026-09-10',
  dias_desde_pedido: 14,
  dias_sla: 10,
  estado: 'PEDIDA',
  etapa: 'PEDIDA',
  fecha_etapa: '2026-09-10',
  dias_en_etapa: 14,
  respuesta: null,
  propuesta: null,
  alicuota: null,
  ...over,
});

const bandeja = (items, porEtapa = {}) => ({
  etapa: 'PEDIDA',
  total: items.length,
  items,
  resumen: {
    total: 9,
    por_etapa: { PEDIDA: 4, EN_TECNICA: 1, RECIBIDA: 2, ENTREGADA: 1, CERRADA: 1, ...porEtapa },
  },
});

// Router de fetch: cada test declara qué devuelve cada endpoint.
const mockFetch = (rutas) => {
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const metodo = (opts.method || 'GET').toUpperCase();
    const clave = `${metodo} ${u.pathname}`;
    const handler = rutas[clave];
    if (!handler) return { ok: false, status: 404, json: async () => ({ detail: `sin mock ${clave}` }), text: async () => '' };
    const data = typeof handler === 'function' ? handler(u, opts) : handler;
    return { ok: true, status: 200, json: async () => data };
  });
};

const llamadas = (metodo, path) => globalThis.fetch.mock.calls.filter(([u, o = {}]) => (
  (o.method || 'GET').toUpperCase() === metodo && new URL(String(u)).pathname === path
));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Bandejas', () => {
  it('muestra las cinco solapas con el contador del backend', async () => {
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': bandeja([par()]),
      'GET /api/v1/art/tandas': { total: 0, items: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    await screen.findByText('ACME SA');

    const nav = screen.getByRole('navigation', { name: 'Bandejas' });
    const solapas = within(nav).getAllByRole('button').map((b) => b.textContent);
    expect(solapas).toEqual(['Pedidas4', 'En técnica1', 'Recibidas2', 'Entregadas1', 'Cerradas1']);
    expect(screen.getByTestId('contador-RECIBIDA').textContent).toBe('2');
  });

  it('cada solapa pide su etapa al backend y el filtro de respuesta sólo aparece en Recibidas', async () => {
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': (u) => bandeja([par({ etapa: u.searchParams.get('etapa') })]),
      'GET /api/v1/art/tandas': { total: 0, items: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    await screen.findByText('ACME SA');
    expect(screen.queryByLabelText('Respuesta')).toBeNull();

    for (const [label, etapa] of [['En técnica', 'EN_TECNICA'], ['Recibidas', 'RECIBIDA'], ['Entregadas', 'ENTREGADA'], ['Cerradas', 'CERRADA']]) {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
      await waitFor(() => {
        const urls = llamadas('GET', '/api/v1/art/cotizaciones/bandeja').map(([u]) => new URL(String(u)));
        expect(urls.some((x) => x.searchParams.get('etapa') === etapa)).toBe(true);
      });
      await screen.findByText('ACME SA');
      if (etapa === 'RECIBIDA') {
        fireEvent.change(screen.getByLabelText('Respuesta'), { target: { value: 'RECHAZADA' } });
        await waitFor(() => {
          const urls = llamadas('GET', '/api/v1/art/cotizaciones/bandeja').map(([u]) => new URL(String(u)));
          expect(urls.some((x) => x.searchParams.get('respuesta') === 'RECHAZADA')).toBe(true);
        });
      }
    }
  });

  it('resalta la fila con SLA vencido (estado SIN_RESPUESTA del backend)', async () => {
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': bandeja([
        par(),
        par({ evento_id: 12, razon_social: 'VENCIDA SRL', estado: 'SIN_RESPUESTA' }),
      ]),
      'GET /api/v1/art/tandas': { total: 0, items: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    const vencida = (await screen.findByText('VENCIDA SRL')).closest('tr');
    expect(vencida.dataset.slaVencido).toBe('true');
    expect(within(vencida).getByText('SLA vencido')).toBeTruthy();
    expect(screen.getByText('ACME SA').closest('tr').dataset.slaVencido).toBe('false');
  });

  it('cargar respuesta: no registra nada hasta la confirmación y manda el body armado', async () => {
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': bandeja([par()]),
      'GET /api/v1/art/tandas': { total: 0, items: [] },
      'POST /api/v1/art/cotizaciones/respuesta': { razon_social: 'ACME SA', aseguradora: 'berkley', registros: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: 'Cargar respuesta' }));

    fireEvent.change(screen.getByLabelText('Qué contestó la compañía'), { target: { value: 'ALICUOTA' } });
    fireEvent.change(screen.getByLabelText('Alícuota (%)'), { target: { value: '8,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }));

    await screen.findByRole('button', { name: 'Confirmar y registrar' });
    expect(llamadas('POST', '/api/v1/art/cotizaciones/respuesta')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y registrar' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/cotizaciones/respuesta')).toHaveLength(1));
    const [, opts] = llamadas('POST', '/api/v1/art/cotizaciones/respuesta')[0];
    expect(JSON.parse(opts.body)).toEqual({
      empresa_id: 'e1', aseguradora: 'berkley', respuesta: 'ALICUOTA', alicuota_pct: 8.5,
    });
  });
});

describe('armarBodyRespuesta', () => {
  const p = { empresa_id: 'e1', aseguradora: 'plus' };

  it('ALICUOTA exige alícuota y manda sólo alicuota_pct', () => {
    expect(armarBodyRespuesta(p, { tipo: 'ALICUOTA', alicuota: '' }).error).toBeTruthy();
    expect(armarBodyRespuesta(p, { tipo: 'ALICUOTA', alicuota: '7,25', motivo: 'JUICIOS' }).body)
      .toEqual({ empresa_id: 'e1', aseguradora: 'plus', respuesta: 'ALICUOTA', alicuota_pct: 7.25 });
  });

  it('TECNICA acepta el SLA vacío', () => {
    expect(armarBodyRespuesta(p, { tipo: 'TECNICA', dias_sla: '' }).body)
      .toEqual({ empresa_id: 'e1', aseguradora: 'plus', respuesta: 'TECNICA' });
    expect(armarBodyRespuesta(p, { tipo: 'TECNICA', dias_sla: '15' }).body.dias_sla).toBe(15);
  });

  it('RECHAZADA exige motivo', () => {
    expect(armarBodyRespuesta(p, { tipo: 'RECHAZADA' }).error).toBeTruthy();
    expect(armarBodyRespuesta(p, { tipo: 'RECHAZADA', motivo: 'CUPO_TOMADO', alicuota: '9' }).body)
      .toEqual({ empresa_id: 'e1', aseguradora: 'plus', respuesta: 'RECHAZADA', motivo: 'CUPO_TOMADO' });
  });

  it('BLOQUEADA exige productor', () => {
    expect(armarBodyRespuesta(p, { tipo: 'BLOQUEADA', productor_bloqueante: '  ' }).error).toBeTruthy();
    expect(armarBodyRespuesta(p, { tipo: 'BLOQUEADA', productor_bloqueante: ' Pérez ', nota: 'x', fecha_respuesta: '2026-09-20' }).body)
      .toEqual({
        empresa_id: 'e1', aseguradora: 'plus', respuesta: 'BLOQUEADA',
        productor_bloqueante: 'Pérez', nota: 'x', fecha_respuesta: '2026-09-20',
      });
  });
});

describe('armarBodyTanda', () => {
  it('todas tildadas = id pelado; subconjunto = override; ninguna o no incluida = no viaja', () => {
    const propuesta = [
      { empresa_id: 'a', aseguradoras: ['berkley', 'prevencion', 'federacion_patronal'] },
      { empresa_id: 'b', aseguradoras: ['berkley', 'prevencion'] },
      { empresa_id: 'c', aseguradoras: ['berkley'] },
      { empresa_id: 'd', aseguradoras: ['berkley'] },
    ];
    const seleccion = {
      a: { incluida: true, aseguradoras: ['federacion_patronal', 'berkley', 'prevencion'] },
      b: { incluida: true, aseguradoras: ['prevencion'] },
      c: { incluida: true, aseguradoras: [] },
      d: { incluida: false, aseguradoras: ['berkley'] },
    };
    expect(armarBodyTanda({ canal: 'SILICON_BROKERS', propuesta, seleccion, nota: ' ' })).toEqual({
      canal: 'SILICON_BROKERS',
      empresa_ids: ['a', { empresa_id: 'b', aseguradoras: ['prevencion'] }],
    });
  });
});

const propuestaTanda = {
  canal: 'SILICON_BROKERS',
  companias_del_canal: ['berkley', 'prevencion', 'federacion_patronal'],
  n: 20,
  dias_min_a_vencimiento: 30,
  total: 2,
  items: [
    {
      empresa_id: 'e1', cuit: '30-71000001-7', razon_social: 'ACME SA', fecha_vencimiento: '2026-11-20',
      dias_a_vencimiento: 57, dotacion: 3500, dotacion_fuente: 'PLANILLA_HISTORICA', dotacion_confianza: 'BAJA',
      dotacion_revisar: true, aseguradoras: ['berkley', 'prevencion', 'federacion_patronal'], impedidas: [],
    },
    {
      empresa_id: 'e2', cuit: '30-72000002-8', razon_social: 'BETA SRL', fecha_vencimiento: '2026-12-01',
      dias_a_vencimiento: 68, dotacion: 40, dotacion_fuente: 'F931', dotacion_confianza: 'ALTA',
      dotacion_revisar: false, aseguradoras: ['berkley', 'prevencion'], impedidas: ['federacion_patronal'],
    },
  ],
  excluidas_ventana_cerrada: 5,
  excluidas_permanencia_total: 1,
  excluidas_permanencia: [{ empresa_id: 'e9', empresa: 'GAMMA SA', habilitada_desde: '2027-01-01', motivo: 'PERMANENCIA_12M' }],
  excluidas_pedido_abierto: 2,
  excluidas_sin_compania: 0,
};

const respuestaTanda = (dryRun, body) => ({
  escritura: !dryRun,
  dry_run: dryRun,
  tanda_id: dryRun ? null : 7,
  tanda_creada: !dryRun,
  canal: 'SILICON_BROKERS',
  companias_del_canal: ['berkley', 'prevencion', 'federacion_patronal'],
  fecha_envio: '2026-09-24',
  empresas: body.empresa_ids.map((e) => ({
    empresa_id: typeof e === 'string' ? e : e.empresa_id,
    razon_social: 'X',
    override: typeof e !== 'string',
    aseguradoras_elegidas: [],
    pedidos: [{ aseguradora: 'berkley', evento_id: dryRun ? null : 1 }],
    impedidas: [],
    ya_pedidas: [{ aseguradora: 'prevencion', evento_id: 99, tanda_id: 2, fecha_pedido: '2026-09-21' }],
  })),
  total_pedidos: body.empresa_ids.length,
  total_impedidas: 0,
  total_ya_pedidas: body.empresa_ids.length,
});

const mockTanda = () => mockFetch({
  'GET /api/v1/art/tandas/propuesta': propuestaTanda,
  'POST /api/v1/art/tandas': (u, opts) => respuestaTanda(u.searchParams.get('dry_run') !== 'false', JSON.parse(opts.body)),
});

const postsTanda = () => llamadas('POST', '/api/v1/art/tandas').map(([u, o]) => ({
  dryRun: new URL(String(u)).searchParams.get('dry_run'),
  body: JSON.parse(o.body),
}));

describe('Armar tanda', () => {
  it('muestra dotación, fuente, confianza, dotacion_revisar y el aviso de permanencia', async () => {
    mockTanda();
    render(<ArtArmarTanda token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    const fila = (await screen.findByText('ACME SA')).closest('tr');
    expect(within(fila).getByText('revisar dotación')).toBeTruthy();
    expect(within(fila).getByText(/PLANILLA_HISTORICA · confianza BAJA/)).toBeTruthy();
    expect(fila.querySelector('[data-dotacion-revisar="true"]')).toBeTruthy();
    expect(screen.getByText(/GAMMA SA/)).toBeTruthy();
    const url = new URL(String(llamadas('GET', '/api/v1/art/tandas/propuesta')[0][0]));
    expect(url.searchParams.get('canal')).toBe('SILICON_BROKERS');
    expect(url.searchParams.get('n')).toBe('20');
  });

  it('nunca llama dry_run=false sin previsualizar, y confirma el MISMO body con override', async () => {
    mockTanda();
    render(<ArtArmarTanda token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await screen.findByText('ACME SA');

    // Sin previsualización no existe el botón de confirmar.
    expect(screen.queryByRole('button', { name: 'Confirmar envío' })).toBeNull();

    fireEvent.click(screen.getByLabelText('Incluir ACME SA'));
    fireEvent.click(screen.getByLabelText('Incluir BETA SRL'));
    fireEvent.click(screen.getByLabelText('Prevención para ACME SA'));
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));

    await screen.findByText(/Previsualización — todavía no se escribió nada/);
    expect(screen.getAllByText(/ya pedida el/).length).toBeGreaterThan(0);
    expect(postsTanda()).toEqual([{
      dryRun: 'true',
      body: {
        canal: 'SILICON_BROKERS',
        empresa_ids: [{ empresa_id: 'e1', aseguradoras: ['berkley', 'federacion_patronal'] }, 'e2'],
      },
    }]);

    // Cambiar la selección invalida la previsualización: no hay confirmar.
    fireEvent.click(screen.getByLabelText('Berkley para BETA SRL'));
    expect(screen.queryByRole('button', { name: 'Confirmar envío' })).toBeNull();
    expect(screen.getByText(/volvé a previsualizar/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Berkley para BETA SRL'));

    // Confirmar pide una segunda confirmación explícita.
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar envío' }));
    expect(postsTanda().filter((p) => p.dryRun === 'false')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Sí, registrar la tanda' }));

    await screen.findByText('Tanda #7 creada.');
    const firmes = postsTanda().filter((p) => p.dryRun === 'false');
    expect(firmes).toHaveLength(1);
    expect(firmes[0].body).toEqual(postsTanda()[0].body);
  });

  it('ajustar dotación (admin): dry_run primero, después confirma con fuente DECLARADA', async () => {
    localStorage.setItem(CLAVE_ROL, 'ADMIN');
    mockFetch({
      'GET /api/v1/art/tandas/propuesta': propuestaTanda,
      'POST /api/v1/art/empresas/e1/dotacion': (u) => ({
        escritura: u.searchParams.get('dry_run') === 'false',
        dry_run: u.searchParams.get('dry_run') !== 'false',
        empresa_id: 'e1',
        antes: { dotacion: 3500, dotacion_fuente: 'PLANILLA_HISTORICA' },
        despues: { dotacion: 35, dotacion_fuente: 'DECLARADA', dotacion_confianza_lectura: 'MEDIA' },
      }),
    });
    render(<ArtArmarTanda token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getAllByRole('button', { name: 'Ajustar dotación' })[0]);
    fireEvent.change(screen.getByLabelText('Dotación declarada (trabajadores)'), { target: { value: '35' } });
    const form = screen.getByRole('form', { name: 'Dotación declarada' });
    fireEvent.click(within(form).getByRole('button', { name: 'Previsualizar' }));
    await screen.findByRole('button', { name: 'Confirmar dotación' });

    let posts = llamadas('POST', '/api/v1/art/empresas/e1/dotacion');
    expect(posts).toHaveLength(1);
    expect(new URL(String(posts[0][0])).searchParams.get('dry_run')).toBe('true');
    expect(JSON.parse(posts[0][1].body)).toEqual({ dotacion: 35, fuente: 'DECLARADA' });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar dotación' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/empresas/e1/dotacion')).toHaveLength(2));
    posts = llamadas('POST', '/api/v1/art/empresas/e1/dotacion');
    expect(new URL(String(posts[1][0])).searchParams.get('dry_run')).toBe('false');
  });

  it('sin rol ADMIN no ofrece ajustar la dotación (el endpoint es require_admin)', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    mockTanda();
    render(<ArtArmarTanda token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Proponer' }));
    await screen.findByText('ACME SA');
    expect(screen.queryByRole('button', { name: 'Ajustar dotación' })).toBeNull();
  });
});

const filaLista = (over = {}) => ({
  empresa_id: 'e1', cuit: '30-71000001-7', razon_social: 'ACME SA', fecha_vencimiento: '2026-10-15',
  dias_a_vencimiento: 31, dotacion: 40, alicuota_actual: null, via_colocacion: 'PROPIO',
  elegible_traspaso: true, pedido_en_curso: false, pedidos_abiertos: [], ...over,
});

describe('Acción comercial', () => {
  it('muestra el badge "Pedida (n)" con aseguradoras y días en el tooltip', async () => {
    mockFetch({
      'GET /api/v1/art/accion-comercial/lista': {
        total: 2,
        items: [
          filaLista({
            pedido_en_curso: true,
            pedidos_abiertos: [
              { aseguradora: 'berkley', tipo: 'PEDIDA', tanda_id: 3, fecha: '2026-09-21', dias: 3 },
              { aseguradora: 'prevencion', tipo: 'TECNICA', tanda_id: null, fecha: '2026-09-10', dias: 14 },
            ],
          }),
          filaLista({ empresa_id: 'e2', razon_social: 'SIN PEDIDO SA' }),
        ],
        resumen: {},
      },
    });
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('SIN PEDIDO SA');
    const badges = screen.getAllByTestId('badge-pedido-en-curso');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('Pedida (2)');
    expect(badges[0].title).toContain('Berkley · pedida · 3 d · tanda #3');
    expect(badges[0].title).toContain('Prevención · en técnica · 14 d');
  });

  it('Cotizaciones es una sub-pestaña dentro de Acción comercial', async () => {
    mockFetch({
      'GET /api/v1/art/accion-comercial/lista': { total: 0, items: [], resumen: {} },
      'GET /api/v1/art/cotizaciones/bandeja': bandeja([par()]),
      'GET /api/v1/art/tandas': { total: 0, items: [] },
    });
    render(<ArtAccionComercialView token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cotizaciones' }));
    await screen.findByText('Cotizaciones ART');
    await screen.findByText('ACME SA');
  });

  it('el detalle de empresa muestra el historial de pedidos por par', async () => {
    mockFetch({
      'GET /api/v1/art/empresas/30-71000001-7': {
        historial_contratos: [],
        pedidos: [
          par({ estado: 'RECIBIDA', respuesta: { evento_id: 5, tipo: 'ALICUOTA', alicuota: 7.2, fecha: '2026-09-15' }, dias_respuesta: 5 }),
          par({ evento_id: 12, aseguradora: 'prevencion', tanda_id: null, estado: 'SIN_RESPUESTA' }),
        ],
      },
    });
    render(<ArtAccionComercialDetalle token={TOKEN} fila={filaLista()} onCerrar={() => {}} />);
    await screen.findByText('Pedidos de cotización (2)');
    expect(screen.getByText('Tarifa · 7,2%')).toBeTruthy();
    expect(screen.getByText('Sin respuesta (SLA vencido)')).toBeTruthy();
    expect(screen.getByText('Silicon Brokers · suelto')).toBeTruthy();
  });
});
