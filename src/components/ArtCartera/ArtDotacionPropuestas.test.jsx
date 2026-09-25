// @vitest-environment jsdom
//
// OPERACIONES-0009 · ART-93 - bandeja "Dotación propuesta" (@CERVI,
// backend PR #207 y #208). Cubren: los dos grupos con `por_revision` y la
// métrica del encabezado; que la edición inline mande /aceptar con {valor}
// y el resto vaya por aceptar-lote; que el lote nunca lleve a un grande;
// "Revisar a mano" precarga la planilla; el rechazo exige motivo; y que el
// modal de corrida no llame a dry_run=false sin confirmar.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import ArtDotacionPropuestas from './ArtDotacionPropuestas';
import ArtCotizacionesBandejas from './ArtCotizacionesBandejas';
import {
  planAceptacion, alertaInfo, datosPropuesta, enNomencladorClae, ordenarPorVencimiento,
} from './artCerviConstants';
import { CLAVE_ROL } from '../../utils/sesion';

afterEach(cleanup);

const TOKEN = 't';

const prop = (over = {}) => ({
  id: 1,
  empresa_id: 'e1',
  cuit: '30-71000001-7',
  razon_social: 'ACME SA',
  corrida_id: 9,
  worker: 'CERVI',
  valor_propuesto: 8,
  dotacion_previa: 120,
  fuente_previa: 'PLANILLA_HISTORICA',
  dotacion_actual: 120,
  fuente_actual: 'PLANILLA_HISTORICA',
  metodo: 'SECTOR_PROMEDIO',
  evidencia: {
    ciiu: '471110', prom_empleador_ciiu: '7.85', ratio: '15.29',
    tramo_previo: '101 a 500', tramo_nuevo: '6 a 10', version_cuadro: '2026-04/REV4',
  },
  confianza_sugerida: 'MEDIA',
  alerta: 'PLANILLA_INFLADA x15.29 · CAMBIA_TRAMO 101 a 500->6 a 10',
  alertas: ['PLANILLA_INFLADA x15.29', 'CAMBIA_TRAMO 101 a 500->6 a 10'],
  requiere_revision_individual: false,
  estado: 'PENDIENTE',
  registrado_por: 'WORKER',
  creado_en: '2026-09-23T10:00:00',
  ...over,
});

const LOTE = [
  prop(),
  prop({ id: 2, empresa_id: 'e2', razon_social: 'BETA SRL', valor_propuesto: 3, dotacion_previa: 40, alertas: ['PLANILLA_INFLADA x13.3'] }),
];
const GRANDES = [
  prop({
    id: 3, empresa_id: 'e3', razon_social: 'COTO', valor_propuesto: 42, dotacion_previa: 14100,
    alertas: ['PLANILLA_INFLADA x335.7', 'GRANDE_REVISAR'], requiere_revision_individual: true,
  }),
];

const pagina = (items, revision) => ({
  total: items.length, items, limit: 100, offset: 0, revision,
  por_revision: { lote: LOTE.length, individual: GRANDES.length },
});

const RECHAZADAS = [
  prop({
    id: 10, empresa_id: 'e10', razon_social: 'COTO', estado: 'RECHAZADA', valor_propuesto: 42, dotacion_previa: 14100,
    motivo_rechazo: 'Promedio no aplica a supermercado', resuelto_en: '2026-09-24T12:00:00', resuelto_por: 'admin@ayma.com.ar',
    rechazo_vigente: true, motivo_reapertura: null,
  }),
  prop({
    id: 11, empresa_id: 'e11', razon_social: 'HAVANNA', estado: 'RECHAZADA', valor_propuesto: 63,
    motivo_rechazo: 'Subdeclara', resuelto_en: '2026-09-20T12:00:00',
    rechazo_vigente: false, motivo_reapertura: 'DOTACION_NUEVA',
  }),
  prop({
    id: 12, empresa_id: 'e12', razon_social: 'ARGENTA TOWER', estado: 'RECHAZADA', valor_propuesto: 21,
    motivo_rechazo: 'Otro', resuelto_en: '2026-09-19T12:00:00',
    rechazo_vigente: false, motivo_reapertura: 'REABIERTA', reabierta_en: '2026-09-24T15:00:00', reabierta_por: 'admin@ayma.com.ar',
  }),
];

const METRICA = {
  ventana_40: { total: 40, medias_o_mas: 12 },
  bloque3_pct_comision_sobre_media: '0.44',
  bloque3_comision_total: '1000', bloque3_comision_media_o_mas: '314.7', bloque3_empresas: 180,
};

const CIIUS = {
  corrida_id: 9, corrida_inicio: '2026-09-23T10:00:00', origen: 'CORRIDA', total_ciius: 7, total_empresas: 12,
  items: [
    { ciiu: '011111', empresas: 4, empresa_ids: [] },
    { ciiu: '999999', empresas: 7, empresa_ids: [] },
    { ciiu: null, empresas: 1, empresa_ids: [] },
  ],
};

const mockFetch = (extra = {}) => {
  const rutas = {
    'GET /api/v1/art/dotacion-propuestas': (u) => {
      if (u.searchParams.get('estado') === 'RECHAZADA') return pagina(RECHAZADAS, 'todas');
      return u.searchParams.get('revision') === 'individual' ? pagina(GRANDES, 'individual') : pagina(LOTE, 'lote');
    },
    // Catálogo CLAE del buscador de CIIU: 011111 está; 999999 no.
    'GET /api/v1/art/ciiu': (u) => {
      const q = u.searchParams.get('q');
      const items = q === '011111'
        ? [{ codigo: '011111', descripcion: 'Cultivo de arroz', seccion: 'A', en_catalogo_vigente: true }]
        : [];
      return { total: items.length, items, limit: 50, truncado: false };
    },
    'GET /api/v1/art/workers/cervi/metrica': METRICA,
    'GET /api/v1/art/workers/cervi/ciiu-sin-cuadro': CIIUS,
    ...extra,
  };
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const metodo = (opts.method || 'GET').toUpperCase();
    let clave = `${metodo} ${u.pathname}`;
    if (!rutas[clave]) clave = `${metodo} ${u.pathname.replace(/\/\d+\//, '/{id}/')}`;
    const handler = rutas[clave];
    if (!handler) return { ok: false, status: 404, json: async () => ({ detail: `sin mock ${clave}` }), text: async () => '' };
    const data = typeof handler === 'function' ? handler(u, opts) : handler;
    if (data && data.__status) {
      return { ok: false, status: data.__status, json: async () => ({ detail: data.detail }), text: async () => JSON.stringify({ detail: data.detail }) };
    }
    return { ok: true, status: 200, json: async () => data };
  });
};

const llamadas = (metodo, path) => globalThis.fetch.mock.calls.filter(([u, o = {}]) => (
  (o.method || 'GET').toUpperCase() === metodo && new URL(String(u)).pathname === path
));

const body = ([, o]) => JSON.parse(o.body);

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
});

describe('helpers', () => {
  it('planAceptacion: editada va individual, sin editar al lote, grande nunca', () => {
    const filas = [...LOTE, ...GRANDES];
    const plan = planAceptacion(filas, new Set([1, 2, 3]), { 2: '25' });
    expect(plan.lote).toEqual([1]);
    expect(plan.individuales).toEqual([{ id: 2, valor: 25 }]);
    expect(plan.grandes).toEqual([3]);
    expect(planAceptacion(filas, new Set([1]), { 1: '0' }).invalidas).toEqual([1]);
    expect(planAceptacion(filas, new Set([1]), { 1: ' 8 ' }).lote).toEqual([1]);
  });

  it('alertaInfo separa código y parámetro; una desconocida sale cruda', () => {
    expect(alertaInfo('PLANILLA_INFLADA x15.29')).toMatchObject({ codigo: 'PLANILLA_INFLADA', detalle: 'x15.29' });
    expect(alertaInfo('NUEVA_COSA 1').label).toBe('NUEVA_COSA 1');
  });

  it('datosPropuesta lee la evidencia y no inventa el vencimiento', () => {
    const d = datosPropuesta(prop());
    expect(d).toMatchObject({ ciiu: '471110', promSector: 7.85, ratio: 15.29, tramoPrevio: '101 a 500', tramoNuevo: '6 a 10', venceEnDias: null });
  });
});

describe('Bandeja Dotación propuesta', () => {
  it('renderiza métrica, los dos grupos con por_revision y el panel de CIIU', async () => {
    mockFetch();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');

    expect(screen.getByTestId('metrica-ventana40').textContent).toContain('12 / 40');
    expect(screen.getByTestId('metrica-bloque3').textContent).toContain('0,44 %');
    expect(screen.getByTestId('contador-lote').textContent).toBe('2');
    expect(screen.getByTestId('contador-individual').textContent).toBe('1');
    expect(screen.getByTestId('titulo-ciiu').textContent).toBe('CIIU sin Cuadro 1 · 7 códigos · 12 empresas');
    expect(screen.getByText('Sin CIIU')).toBeTruthy();

    const fila = screen.getByTestId('propuesta-1');
    expect(fila.textContent).toContain('471110');
    expect(fila.textContent).toContain('101 a 500 → 6 a 10');
    expect(within(fila).getByLabelText('Propuesta ACME SA').value).toBe('8');
    expect(screen.queryByText('COTO')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Revisar a mano/ }));
    const grande = await screen.findByTestId('propuesta-3');
    expect(grande.querySelector('[data-alerta="GRANDE_REVISAR"]')).toBeTruthy();
    // Precargado con la planilla, no con la propuesta; sin checkbox de lote.
    expect(within(grande).getByLabelText('Valor a aceptar COTO').value).toBe('14100');
    expect(within(grande).queryByRole('checkbox')).toBeNull();
  });

  it('aceptar seleccionadas: la editada va por /aceptar con {valor}, el resto por aceptar-lote', async () => {
    mockFetch({
      'POST /api/v1/art/dotacion-propuestas/aceptar-lote': {
        total: 1, aceptadas: 1, requieren_revision: 0, con_error: 0,
        items: [{ id: 1, resultado: 'ACEPTADA', forzada: false }],
      },
      'POST /api/v1/art/dotacion-propuestas/{id}/aceptar': (u, o) => ({
        id: 2, estado: 'EDITADA', empresa_id: 'e2', valor_propuesto: 3, valor_final: JSON.parse(o.body).valor,
        antes: {}, despues: {}, caducadas: 0,
      }),
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');

    fireEvent.change(screen.getByLabelText('Propuesta BETA SRL'), { target: { value: '25' } });
    fireEvent.click(screen.getByLabelText('Seleccionar todas'));
    fireEvent.click(screen.getByRole('button', { name: /Aceptar seleccionadas \(2\)/ }));

    await waitFor(() => expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/2/aceptar')).toHaveLength(1));
    expect(body(llamadas('POST', '/api/v1/art/dotacion-propuestas/2/aceptar')[0])).toEqual({ valor: 25 });
    const lote = llamadas('POST', '/api/v1/art/dotacion-propuestas/aceptar-lote');
    expect(lote).toHaveLength(1);
    expect(body(lote[0])).toEqual({ ids: [1] });

    const resumen = await screen.findByTestId('resumen-acciones');
    expect(resumen.textContent).toContain('Aceptada');
    expect(resumen.textContent).toContain('Editada');
    // Refresca métrica después de aceptar.
    await waitFor(() => expect(llamadas('GET', '/api/v1/art/workers/cervi/metrica').length).toBeGreaterThan(1));
  });

  it('el lote no incluye grandes aunque el backend los mezcle, y muestra REQUIERE_REVISION por fila', async () => {
    const mezclado = [...LOTE, { ...GRANDES[0] }];
    mockFetch({
      'GET /api/v1/art/dotacion-propuestas': (u) => (
        u.searchParams.get('revision') === 'individual' ? pagina(GRANDES, 'individual') : pagina(mezclado, 'lote')
      ),
      'POST /api/v1/art/dotacion-propuestas/aceptar-lote': {
        total: 2, aceptadas: 1, requieren_revision: 1, con_error: 0,
        items: [
          { id: 1, resultado: 'ACEPTADA' },
          { id: 2, resultado: 'REQUIERE_REVISION', motivo: 'GRANDE_REVISAR' },
        ],
      },
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('COTO');
    expect(screen.getByLabelText('Seleccionar COTO').disabled).toBe(true);

    fireEvent.click(screen.getByLabelText('Seleccionar todas'));
    fireEvent.click(screen.getByRole('button', { name: /Aceptar seleccionadas/ }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/aceptar-lote')).toHaveLength(1));
    const enviado = body(llamadas('POST', '/api/v1/art/dotacion-propuestas/aceptar-lote')[0]);
    expect(enviado.ids).not.toContain(3);
    expect(enviado.forzar_ids).toBeUndefined();

    const fila = await screen.findByTestId('propuesta-2');
    await waitFor(() => expect(within(fila).getByTestId('resultado-fila').textContent).toContain('Requiere revisión'));
  });

  it('revisar a mano: acepta con el valor tipeado; rechazar exige motivo', async () => {
    mockFetch({
      'POST /api/v1/art/dotacion-propuestas/{id}/aceptar': (u, o) => ({
        id: 3, estado: 'EDITADA', empresa_id: 'e3', valor_propuesto: 42, valor_final: JSON.parse(o.body).valor,
        antes: {}, despues: {}, caducadas: 0,
      }),
      'POST /api/v1/art/dotacion-propuestas/{id}/rechazar': (u, o) => ({
        id: 3, estado: 'RECHAZADA', empresa_id: 'e3', motivo_rechazo: JSON.parse(o.body).motivo, caducadas: 0,
      }),
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: /^Revisar a mano/ }));
    const fila = await screen.findByTestId('propuesta-3');

    fireEvent.change(within(fila).getByLabelText('Valor a aceptar COTO'), { target: { value: '9800' } });
    fireEvent.click(within(fila).getByRole('button', { name: 'Aceptar con este valor' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/3/aceptar')).toHaveLength(1));
    expect(body(llamadas('POST', '/api/v1/art/dotacion-propuestas/3/aceptar')[0])).toEqual({ valor: 9800 });

    fireEvent.click(within(await screen.findByTestId('propuesta-3')).getByRole('button', { name: 'Rechazar' }));
    const form = await screen.findByRole('form', { name: 'Rechazar propuesta' });
    fireEvent.click(within(form).getByRole('button', { name: 'Rechazar' }));
    expect((await within(form).findByRole('alert')).textContent).toContain('obligatorio');
    expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/3/rechazar')).toHaveLength(0);

    fireEvent.change(within(form).getByLabelText('Motivo (obligatorio)'), { target: { value: 'Dato de ARCA' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/3/rechazar')).toHaveLength(1));
    expect(body(llamadas('POST', '/api/v1/art/dotacion-propuestas/3/rechazar')[0])).toEqual({ motivo: 'Dato de ARCA' });
  });

  it('correr CERVI: dry_run primero, no escribe sin confirmar, y confirma con dry_run=false', async () => {
    mockFetch({
      'POST /api/v1/art/workers/cervi/corrida': (u) => ({
        escritura: u.searchParams.get('dry_run') === 'false',
        dry_run: u.searchParams.get('dry_run') !== 'false',
        corrida_id: null, worker: 'CERVI', limit: 50, dias_min_a_vencimiento: 30,
        contadores: { candidatas: 60, propuestas: 1, omitidas_por_motivo: { FUENTE_SUPERIOR: 3 }, fuera_de_limite: 0, errores: 0 },
        items: [{
          empresa_id: 'e9', razon_social: 'GAMMA SA', vence_en_dias: 70, ciiu: '471110', dotacion_previa: 50,
          fuente_previa: 'PLANILLA_HISTORICA', prom_sector: '7.85', ratio: '6.37', valor_propuesto: 8,
          tramo_previo: '41 a 50', tramo_nuevo: '6 a 10', alertas: ['PLANILLA_INFLADA x6.37'],
        }],
      }),
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');

    fireEvent.click(screen.getByRole('button', { name: 'Correr CERVI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Simular (dry run)' }));
    await screen.findByText('GAMMA SA');
    expect(screen.getByTestId('corrida-contadores').textContent).toContain('60');

    const corridas = () => llamadas('POST', '/api/v1/art/workers/cervi/corrida').map(([u]) => new URL(String(u)).searchParams.get('dry_run'));
    expect(corridas()).toEqual(['true']);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar corrida' }));
    await waitFor(() => expect(corridas()).toEqual(['true', 'false']));
    await waitFor(() => expect(screen.queryByText('GAMMA SA')).toBeNull());
  });

  it('correr CERVI: un 4xx muestra el detail y no reintenta', async () => {
    mockFetch({ 'POST /api/v1/art/workers/cervi/corrida': { __status: 422, detail: 'limit fuera de rango' } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: 'Correr CERVI' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Simular (dry run)' }));
    const form = screen.getByRole('form', { name: 'Simular corrida' });
    expect((await within(form).findByRole('alert')).textContent).toContain('limit fuera de rango');
    expect(llamadas('POST', '/api/v1/art/workers/cervi/corrida')).toHaveLength(1);
  });

  it('sin rol ADMIN no ofrece aceptar, rechazar ni correr', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    mockFetch();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    expect(screen.queryByRole('button', { name: 'Correr CERVI' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Aceptar seleccionadas/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).toBeNull();
  });

  it('estado vacío y error de carga explícitos', async () => {
    mockFetch({ 'GET /api/v1/art/dotacion-propuestas': { total: 0, items: [], limit: 100, offset: 0, revision: 'lote', por_revision: { lote: 0, individual: 0 } } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('No hay propuestas pendientes para aceptar en lote.');
    cleanup();

    mockFetch({ 'GET /api/v1/art/dotacion-propuestas': { __status: 500, detail: 'boom' } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    expect((await screen.findAllByRole('alert')).some((a) => a.textContent.includes('boom'))).toBe(true);
  });

  it('pagina en cliente: limit=100 + offset hasta total', async () => {
    const muchos = Array.from({ length: 150 }, (_, i) => prop({ id: 100 + i, razon_social: `E${i}` }));
    mockFetch({
      'GET /api/v1/art/dotacion-propuestas': (u) => {
        if (u.searchParams.get('revision') === 'individual') return pagina([], 'individual');
        const off = Number(u.searchParams.get('offset'));
        return { ...pagina(muchos.slice(off, off + 100), 'lote'), total: 150, offset: off };
      },
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('E149');
    const offs = llamadas('GET', '/api/v1/art/dotacion-propuestas')
      .map(([u]) => new URL(String(u)))
      .filter((u) => u.searchParams.get('revision') === 'lote')
      .map((u) => [u.searchParams.get('limit'), u.searchParams.get('offset')]);
    expect(offs).toEqual([['100', '0'], ['100', '100']]);
  });

  it('es una solapa más de Bandejas: "Dotación propuesta (n)"', async () => {
    mockFetch({
      'GET /api/v1/art/cotizaciones/bandeja': { etapa: 'PEDIDA', total: 0, items: [], resumen: { por_etapa: {} } },
      'GET /api/v1/art/tandas': { total: 0, items: [] },
    });
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('contador-DOTACION').textContent).toBe('3'));
    fireEvent.click(screen.getByRole('button', { name: /^Dotación propuesta/ }));
    await screen.findByText('ACME SA');
    expect(screen.queryByLabelText('Canal')).toBeNull();
  });
});

describe('ART-96 · formato y solapa Rechazadas', () => {
  it('% comisión Bloque 3 con dos decimales fijos', async () => {
    mockFetch({ 'GET /api/v1/art/workers/cervi/metrica': { ...METRICA, bloque3_pct_comision_sobre_media: '12.5' } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('metrica-bloque3').textContent).toContain('12,50 %'));
  });

  it('lista estado=RECHAZADA con motivo, fecha, vigente y por qué dejó de estarlo', async () => {
    mockFetch();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    const tab = await screen.findByRole('button', { name: 'Rechazadas (3)' });
    fireEvent.click(tab);

    const coto = await screen.findByTestId('rechazada-10');
    expect(coto.textContent).toContain('Promedio no aplica a supermercado');
    expect(within(coto).getByTestId('vigente-10').textContent).toBe('Sí');
    expect(within(coto).getByRole('button', { name: 'Reabrir' })).toBeTruthy();

    const havanna = screen.getByTestId('rechazada-11');
    expect(within(havanna).getByTestId('vigente-11').textContent).toBe('No');
    expect(havanna.textContent).toContain('La empresa recibió una dotación nueva');

    const argenta = screen.getByTestId('rechazada-12');
    expect(argenta.textContent).toContain('Reabierta a mano');
    expect(argenta.textContent).toContain('admin@ayma.com.ar');
    // Ya reabierta: no hay nada que reabrir.
    expect(within(argenta).queryByRole('button', { name: 'Reabrir' })).toBeNull();

    const url = llamadas('GET', '/api/v1/art/dotacion-propuestas')
      .map(([u]) => new URL(String(u)))
      .find((u) => u.searchParams.get('estado') === 'RECHAZADA');
    expect(url).toBeTruthy();
  });

  it('Reabrir llama a /reabrir y recarga', async () => {
    mockFetch({
      'POST /api/v1/art/dotacion-propuestas/{id}/reabrir': {
        id: 10, estado: 'RECHAZADA', empresa_id: 'e10', reabierta_en: '2026-09-25T10:00:00', cambio: true,
      },
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazadas (3)' }));
    fireEvent.click(within(await screen.findByTestId('rechazada-10')).getByRole('button', { name: 'Reabrir' }));

    await waitFor(() => expect(llamadas('POST', '/api/v1/art/dotacion-propuestas/10/reabrir').length).toBe(1));
    expect(await screen.findByText(/la próxima corrida de CERVI vuelve a proponer/)).toBeTruthy();
  });

  it('un 409 de /reabrir se muestra con el detail del backend', async () => {
    const detail = 'La empresa tiene un rechazo más nuevo (#15): se reabre ése.';
    mockFetch({ 'POST /api/v1/art/dotacion-propuestas/{id}/reabrir': { __status: 409, detail } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazadas (3)' }));
    const havanna = await screen.findByTestId('rechazada-11');
    fireEvent.click(within(havanna).getByRole('button', { name: 'Reabrir' }));

    const alerta = await within(havanna).findByRole('alert');
    expect(alerta.textContent).toContain('409');
    expect(alerta.textContent).toContain(detail);
  });

  it('sin rol ADMIN no hay botón Reabrir', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    mockFetch();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazadas (3)' }));
    await screen.findByTestId('rechazada-10');
    expect(screen.queryByRole('button', { name: 'Reabrir' })).toBeNull();
  });
});

describe('ART-98 · CIIU fuera del CLAE', () => {
  it('enNomencladorClae compara a 6 dígitos y no decide sin datos', () => {
    expect(enNomencladorClae('11111', [{ codigo: '011111' }])).toBe(true);
    expect(enNomencladorClae('999999', [{ codigo: '999990' }])).toBe(false);
    expect(enNomencladorClae(null, [])).toBeNull();
    expect(enNomencladorClae('011111', undefined)).toBeNull();
  });

  it('marca sólo el código que no está en el catálogo CLAE', async () => {
    mockFetch();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    const viejo = await screen.findByTestId('ciiu-999999');
    await waitFor(() => expect(within(viejo).getByTestId('marca-clanae97').textContent)
      .toBe('código ClaNAE-97: requiere resolución T30'));
    await waitFor(() => expect(llamadas('GET', '/api/v1/art/ciiu').length).toBe(2));
    expect(within(screen.getByTestId('ciiu-011111')).queryByTestId('marca-clanae97')).toBeNull();
    expect(within(screen.getByTestId('ciiu-sin')).queryByTestId('marca-clanae97')).toBeNull();
  });

  it('si el catálogo no contesta, no marca', async () => {
    mockFetch({ 'GET /api/v1/art/ciiu': { __status: 500, detail: 'caído' } });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByTestId('ciiu-999999');
    await waitFor(() => expect(llamadas('GET', '/api/v1/art/ciiu').length).toBe(2));
    expect(screen.queryByTestId('marca-clanae97')).toBeNull();
  });
});

// ART-103: los dos grupos ordenados por vence_en_dias ASC; la cabecera invierte.
describe('ART-103 · orden por vencimiento', () => {
  it('ordenarPorVencimiento: ASC por defecto, DESC al invertir, sin dato siempre al final', () => {
    const filas = [
      prop({ id: 1, vence_en_dias: 80 }),
      prop({ id: 2, vence_en_dias: null }),
      prop({ id: 3, vence_en_dias: -5 }),
      prop({ id: 4, vence_en_dias: 40 }),
    ];
    expect(ordenarPorVencimiento(filas).map((p) => p.id)).toEqual([3, 4, 1, 2]);
    expect(ordenarPorVencimiento(filas, 'desc').map((p) => p.id)).toEqual([1, 4, 3, 2]);
    // No muta la lista del estado.
    expect(filas.map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it('la bandeja arranca con lo que vence antes y la cabecera invierte, en los dos grupos', async () => {
    const lote = [
      prop({ id: 1, razon_social: 'TARDE SA', vence_en_dias: 70 }),
      prop({ id: 2, empresa_id: 'e2', razon_social: 'PRONTO SA', vence_en_dias: 35 }),
    ];
    const grandes = [
      prop({ id: 3, empresa_id: 'e3', razon_social: 'GRANDE LEJOS', vence_en_dias: 88, requiere_revision_individual: true }),
      prop({ id: 4, empresa_id: 'e4', razon_social: 'GRANDE CERCA', vence_en_dias: 31, requiere_revision_individual: true }),
    ];
    mockFetch({
      'GET /api/v1/art/dotacion-propuestas': (u) => (
        u.searchParams.get('revision') === 'individual' ? pagina(grandes, 'individual') : pagina(lote, 'lote')
      ),
    });
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await screen.findByText('PRONTO SA');
    const orden = () => screen.getAllByTestId(/^propuesta-\d+$/).map((tr) => tr.getAttribute('data-testid'));

    expect(orden()).toEqual(['propuesta-2', 'propuesta-1']);
    const cabecera = screen.getByRole('button', { name: /Vence en/ });
    expect(cabecera.closest('th').getAttribute('aria-sort')).toBe('ascending');

    fireEvent.click(cabecera);
    expect(orden()).toEqual(['propuesta-1', 'propuesta-2']);
    expect(cabecera.closest('th').getAttribute('aria-sort')).toBe('descending');

    fireEvent.click(cabecera);
    fireEvent.click(screen.getByRole('button', { name: /^Revisar a mano/ }));
    await screen.findByText('GRANDE CERCA');
    expect(orden()).toEqual(['propuesta-4', 'propuesta-3']);
  });
});
