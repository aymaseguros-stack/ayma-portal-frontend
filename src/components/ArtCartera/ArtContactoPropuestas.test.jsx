// @vitest-environment jsdom
//
// OPERACIONES-0016 · @PAZ - bandeja "Contactos propuestos" (backend PR #242
// y #243). Cubren: la métrica arriba (lo único que ve un EMPLEADO); que las
// filas con `bloquea_lote` no se puedan tildar y muestren sus alertas; que
// aceptar, rechazar y el lote pasen por ConfirmarModal; el motivo de rechazo
// obligatorio; el resultado del lote por ítem con "409 · caduca"; que Sin
// CUIT NO muestre el teléfono; y el diagnóstico sólo con números.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import ArtContactoPropuestas from './ArtContactoPropuestas';
import ArtCotizacionesBandejas from './ArtCotizacionesBandejas';
import { alertaPazInfo, resultadoLoteInfo, textoFraccion } from './artPazConstants';
import { CLAVE_ROL } from '../../utils/sesion';

afterEach(cleanup);

const TOKEN = 't';

const prop = (over = {}) => ({
  id: 1, empresa_id: 'e1', cuit: '30-71000001-7', razon_social: 'ACME SA', corrida_id: 4,
  tipo: 'TELEFONO', valor: '+543414000000', valor_raw: '0341 400-0000',
  fuente: 'WEB_CORPORATIVA', fuente_codigo: 'WEB_CORPORATIVA', url_origen: 'https://acme.com.ar/contacto',
  confianza_sugerida: 'MEDIA', es_personal: false, titular_dato: 'EMPRESA',
  persona_nombre: null, persona_cargo: null, notas: null, alertas: [], bloquea_lote: false,
  estado: 'PENDIENTE', registrado_por: 'WORKER', creado_en: '2026-09-27T15:30:00Z',
  ...over,
});

const PROPUESTAS = [
  prop(),
  prop({ id: 2, empresa_id: 'e2', razon_social: 'BETA SRL', tipo: 'EMAIL', valor: 'info@beta.com.ar' }),
  prop({
    id: 3, empresa_id: 'e3', razon_social: 'GAMMA SA', valor: '+5493415555555',
    alertas: ['ES_PERSONAL', 'COMPARTIDO_3_CUIT'], bloquea_lote: true, url_origen: 'javascript:alert(1)',
  }),
];

const METRICA = {
  bloque3_telefono_media_o_mas: { numerador: 40, total: 160, texto: '40/160', pct: 25 },
  p1_contactables_media_o_mas: { numerador: 12, total: 60, texto: '12/60', pct: 20 },
  p1_contactables_cualquier_confianza: { numerador: 45, total: 636, texto: '45/636', pct: 7.08 },
  por_fuente: { WEB_CORPORATIVA: 30 },
  bloque3_solo_mater_ii_excluidas: 3,
  pendientes: { total: 3, por_tipo: { TELEFONO: 2, EMAIL: 1 }, bloqueadas_lote: 1 },
  sin_cuit: 7,
  fuentes_no_contactables: ['MATER_II'],
  titulares_no_contactables: ['ESTUDIO_CONTABLE'],
};

const SIN_CUIT = {
  total: 2, por_motivo: { SIN_MATCH: 1, MATCH_AMBIGUO: 1 }, por_fuente: { OSM: 1, DIRECTORIO: 1 },
  limit: 100, offset: 0,
  items: [
    {
      id: 1, fuente: 'OSM', fuente_codigo: 'OSM', nombre: 'Panadería Sol', localidad: 'Rosario',
      web: 'https://sol.com.ar', telefono: '0341 4999999', url_origen: null, motivo: 'SIN_MATCH',
      candidatos: 0, primera_vez: '2026-09-26T10:00:00Z', ultima_vez: '2026-09-27T12:05:00Z', veces: 2,
    },
    {
      id: 2, fuente: 'DIRECTORIO', fuente_codigo: 'DIRECTORIO_CAMARA', nombre: 'Metalúrgica Norte', localidad: null,
      web: null, telefono: null, url_origen: null, motivo: 'MATCH_AMBIGUO',
      candidatos: 2, primera_vez: '2026-09-26T10:00:00Z', ultima_vez: '2026-09-26T10:00:00Z', veces: 1,
    },
  ],
};

const DIAGNOSTICO = {
  por_fuente: {
    ESCALAR: { total: 900, menos_6_dig: 12, no_numericos: 4, en_compartidos_3mas: 30, estudio_contable: 0 },
    MATER_II: { total: 120, menos_6_dig: 0, no_numericos: 0, en_compartidos_3mas: 8, estudio_contable: 5 },
  },
  google_places_activas: { total: 30, por_tipo: { TELEFONO: 28, WEB: 2 } },
  numeros_compartidos_3mas: 9,
  empresas_en_numeros_compartidos_3mas: 41,
  mater_ii_activas: { total: 150, por_tipo: { TELEFONO: 120, EMAIL: 30 } },
  umbral_compartido: 3,
};

const bloque = (filas, over = {}) => ({
  filas_empresa_contacto: filas, por_tipo: filas ? { TELEFONO: filas } : {}, empresas: filas,
  muestra: filas ? [{ empresa_id: 'e9', razon_social: 'DELTA SA', fuente: 'MATER_II', tipo: 'TELEFONO' }] : [],
  ...over,
});

const SANEO = (dryRun, vacio = false) => ({
  escritura: !dryRun, dry_run: dryRun, umbral_compartido: 3,
  filas_actualizadas: vacio ? 0 : 363 + 30 + 400 + 55,
  bloques: {
    mater_ii: bloque(vacio ? 0 : 363),
    google_places: bloque(vacio ? 0 : 30),
    compartidos_3mas: bloque(vacio ? 0 : 400, { numeros: vacio ? 0 : 217, escalares_no_contactables: { ESCALAR: vacio ? 0 : 120 } }),
    basura: bloque(vacio ? 0 : 55, { escalares_no_contactables: { ESCALAR: vacio ? 0 : 1461 } }),
  },
});

// Valores de contacto que NUNCA tienen que aparecer en pantalla.
const VALORES_CONTACTO = [/\+54\d/, /@[a-z]+\./i, /https?:\/\//, /0341/];

const mockFetch = (extra = {}) => {
  const rutas = {
    'GET /api/v1/art/workers/paz/metrica': METRICA,
    'GET /api/v1/art/contacto-propuestas': { total: PROPUESTAS.length, limit: 100, offset: 0, items: PROPUESTAS },
    'GET /api/v1/art/workers/paz/sin-cuit': SIN_CUIT,
    'GET /api/v1/art/workers/paz/diagnostico-telefonos': DIAGNOSTICO,
    'POST /api/v1/art/workers/paz/saneamiento': (u) => SANEO(u.searchParams.get('dry_run') !== 'false'),
    'POST /api/v1/art/contacto-propuestas/{id}/aceptar': (u) => ({
      id: Number(u.pathname.split('/').at(-2)), estado: 'ACEPTADA', empresa_id: 'e1', tipo: 'TELEFONO',
      accion: 'ALTA', contacto_id: 'c1', confianza: 'MEDIA',
    }),
    'POST /api/v1/art/contacto-propuestas/{id}/rechazar': (u, o) => ({
      id: Number(u.pathname.split('/').at(-2)), estado: 'RECHAZADA', empresa_id: 'e1', motivo_rechazo: JSON.parse(o.body).motivo,
    }),
    'POST /api/v1/art/contacto-propuestas/aceptar-lote': {
      total: 2, aceptadas: 1, bloqueadas: 0, con_error: 1,
      items: [
        { id: 1, resultado: 'ACEPTADA', accion: 'ALTA' },
        { id: 2, resultado: 'ERROR', status_code: 409, error: { mensaje: 'YA_EXISTE' } },
      ],
    },
    // Lo que pide la bandeja de cotizaciones al montar.
    'GET /api/v1/art/tandas': { items: [] },
    'GET /api/v1/art/cotizaciones/bandeja': { items: [], total: 0, resumen: { por_etapa: {} } },
    'GET /api/v1/art/dotacion-propuestas': { total: 0, items: [], por_revision: { lote: 0, individual: 0 } },
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
      return {
        ok: false, status: data.__status,
        json: async () => ({ detail: data.detail }), text: async () => JSON.stringify({ detail: data.detail }),
        clone() { return this; },
      };
    }
    return { ok: true, status: 200, json: async () => data };
  });
};

const llamadas = (metodo, path) => globalThis.fetch.mock.calls.filter(([u, o = {}]) => (
  (o.method || 'GET').toUpperCase() === metodo && new URL(String(u)).pathname === path
));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
});

describe('helpers', () => {
  it('resultadoLoteInfo: 409 es "409 · caduca"; otro error lleva su código', () => {
    expect(resultadoLoteInfo({ resultado: 'ERROR', status_code: 409, error: 'YA_EXISTE' }).label).toBe('409 · caduca');
    expect(resultadoLoteInfo({ resultado: 'ERROR', status_code: 422 }).label).toBe('Error 422');
    expect(resultadoLoteInfo({ resultado: 'ACEPTADA', accion: 'UPGRADE' }).label).toBe('Aceptada · UPGRADE');
    expect(resultadoLoteInfo({ resultado: 'BLOQUEADA_POR_ALERTA', motivo: 'x' }).detalle).toBe('x');
  });

  it('alertaPazInfo: las cinco tienen etiqueta; una desconocida sale cruda', () => {
    ['ES_PERSONAL', 'DECISOR', 'COMPARTIDO_3_CUIT', 'CONFLICTO_MEDIA', 'BASURA']
      .forEach((a) => expect(alertaPazInfo(a).label).not.toBe(a));
    expect(alertaPazInfo('OTRA').label).toBe('OTRA');
  });

  it('textoFraccion usa el texto del backend y el pct', () => {
    expect(textoFraccion({ texto: '40/160', pct: 25 })).toBe('40/160 · 25%');
    expect(textoFraccion({ texto: '0/0', pct: null })).toBe('0/0');
  });
});

describe('Bandeja Contactos propuestos', () => {
  it('muestra la métrica y las propuestas; la fila con alerta no se tilda', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');

    expect(screen.getByTestId('metrica-bloque3').textContent).toBe('40/160 · 25%');
    expect(screen.getByTestId('metrica-p1-media').textContent).toContain('12/60');
    expect(screen.getByTestId('metrica-pendientes').textContent).toBe('3');

    const filas = screen.getAllByTestId('fila-contacto');
    const gamma = filas.find((f) => f.textContent.includes('GAMMA SA'));
    expect(gamma.dataset.bloqueaLote).toBe('true');
    expect(within(gamma).getByRole('checkbox').disabled).toBe(true);
    expect(gamma.querySelector('[data-alerta="ES_PERSONAL"]')).not.toBeNull();
    expect(gamma.querySelector('[data-alerta="COMPARTIDO_3_CUIT"]')).not.toBeNull();
    // Un url_origen que no es http(s) no se enlaza.
    expect(within(gamma).queryByRole('link')).toBeNull();

    const acme = filas.find((f) => f.textContent.includes('ACME SA'));
    expect(within(acme).getByRole('link').getAttribute('href')).toBe('https://acme.com.ar/contacto');
    // dd/mm/aaaa hh:mm hora Argentina (15:30Z = 12:30 AR).
    expect(acme.textContent).toContain('27/09/2026 12:30');

    // Tildar todas deja afuera a la bloqueada.
    fireEvent.click(screen.getByLabelText('Tildar todas las que entran en el lote'));
    expect(screen.getByRole('button', { name: /Aceptar seleccionadas \(2\)/ }).disabled).toBe(false);
  });

  it('el EMPLEADO ve sólo la métrica', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByTestId('metrica-bloque3');
    expect(screen.queryByRole('button', { name: 'Sin CUIT' })).toBeNull();
    expect(llamadas('GET', '/api/v1/art/contacto-propuestas')).toHaveLength(0);
  });

  it('aceptar pasa por ConfirmarModal y no llama antes de confirmar', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    const fila = (await screen.findByText('ACME SA')).closest('tr');
    fireEvent.click(within(fila).getByRole('button', { name: 'Aceptar' }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Aceptar contacto' });
    expect(llamadas('POST', '/api/v1/art/contacto-propuestas/1/aceptar')).toHaveLength(0);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/contacto-propuestas/1/aceptar')).toHaveLength(1));
    expect((await screen.findByTestId('resultado-contactos')).textContent).toContain('Aceptada · ALTA');
  });

  it('aceptar con 409 muestra "409 · caduca"', async () => {
    mockFetch({ 'POST /api/v1/art/contacto-propuestas/{id}/aceptar': { __status: 409, detail: { mensaje: 'YA_EXISTE' } } });
    render(<ArtContactoPropuestas token={TOKEN} />);
    const fila = (await screen.findByText('ACME SA')).closest('tr');
    fireEvent.click(within(fila).getByRole('button', { name: 'Aceptar' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Aceptar' }));
    expect((await screen.findByTestId('resultado-contactos')).textContent).toContain('409 · caduca');
  });

  it('rechazar exige motivo y lo manda', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    const fila = (await screen.findByText('BETA SRL')).closest('tr');
    fireEvent.click(within(fila).getByRole('button', { name: 'Rechazar' }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Rechazar contacto' });
    const textarea = within(dialogo).getByLabelText(/Motivo/);
    expect(textarea.getAttribute('maxlength')).toBe('500');

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));
    expect((await within(dialogo).findByRole('alert')).textContent).toContain('El motivo es obligatorio.');
    expect(llamadas('POST', '/api/v1/art/contacto-propuestas/2/rechazar')).toHaveLength(0);

    fireEvent.change(textarea, { target: { value: '  Es el de otra empresa  ' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Rechazar' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/contacto-propuestas/2/rechazar')).toHaveLength(1));
    const [, o] = llamadas('POST', '/api/v1/art/contacto-propuestas/2/rechazar')[0];
    expect(JSON.parse(o.body)).toEqual({ motivo: 'Es el de otra empresa' });
  });

  it('el lote manda sólo las tildadas y muestra el resultado por ítem', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByLabelText(/Tildar ACME SA/));
    fireEvent.click(screen.getByLabelText(/Tildar BETA SRL/));
    fireEvent.click(screen.getByRole('button', { name: /Aceptar seleccionadas \(2\)/ }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Aceptar seleccionadas' });
    expect(llamadas('POST', '/api/v1/art/contacto-propuestas/aceptar-lote')).toHaveLength(0);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Aceptar 2' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/contacto-propuestas/aceptar-lote')).toHaveLength(1));
    const [, o] = llamadas('POST', '/api/v1/art/contacto-propuestas/aceptar-lote')[0];
    expect(JSON.parse(o.body)).toEqual({ ids: [1, 2] });

    const items = await screen.findAllByTestId('resultado-item');
    expect(items[0].textContent).toContain('ACME SA');
    expect(items[0].textContent).toContain('Aceptada');
    expect(items[1].textContent).toContain('BETA SRL');
    expect(items[1].textContent).toContain('409 · caduca');
  });

  it('Sin CUIT: conteos y lista SIN el teléfono, sólo si lo tiene', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: 'Sin CUIT' }));
    await screen.findByText('Panadería Sol');

    expect(screen.getByTestId('sin-cuit-total').textContent).toBe('2');
    expect(screen.getByTestId('sin-cuit-por-motivo').textContent).toContain('Sin coincidencia');
    expect(screen.getByTestId('sin-cuit-por-fuente').textContent).toContain('OSM');
    const tel = screen.getAllByTestId('tiene-telefono').map((c) => c.textContent);
    expect(tel).toEqual(['Sí', 'No']);
    expect(document.body.textContent).not.toContain('4999999');
    expect(screen.getByRole('link', { name: 'sol.com.ar' }).getAttribute('href')).toBe('https://sol.com.ar');
    // Sólo lectura: ningún botón de acción en las filas.
    screen.getAllByTestId('fila-sin-cuit').forEach((f) => expect(within(f).queryByRole('button')).toBeNull());
  });

  it('Diagnóstico ART-116: sólo números, con MATER II activas', async () => {
    mockFetch();
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: 'Diagnóstico ART-116' }));
    expect((await screen.findByTestId('diag-mater-total')).textContent).toBe('150');
    expect(screen.getByTestId('diag-compartidos').textContent).toBe('9');
    expect(screen.getByTestId('diag-empresas-compartidos').textContent).toBe('41');
    expect(screen.getAllByTestId('fila-diagnostico')).toHaveLength(2);
    expect(screen.getByTestId('diag-places-total').textContent).toBe('30');
    expect(screen.getByTestId('diag-estudio-MATER_II').textContent).toBe('5');
  });

  const abrirDiagnostico = async () => {
    render(<ArtContactoPropuestas token={TOKEN} />);
    await screen.findByText('ACME SA');
    fireEvent.click(screen.getByRole('button', { name: 'Diagnóstico ART-116' }));
    await screen.findByTestId('diag-mater-total');
  };

  it('Saneamiento: sin previsualizar no se puede confirmar', async () => {
    mockFetch();
    await abrirDiagnostico();
    const confirmar = screen.getByRole('button', { name: 'Confirmar saneamiento' });
    expect(confirmar.disabled).toBe(true);
    fireEvent.click(confirmar);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(llamadas('POST', '/api/v1/art/workers/paz/saneamiento')).toHaveLength(0);
  });

  it('Saneamiento: previsualiza en seco, confirma con modal y refresca métrica y diagnóstico', async () => {
    mockFetch();
    await abrirDiagnostico();
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar saneamiento' }));
    expect((await screen.findByTestId('saneo-filas-mater_ii')).textContent).toBe('363');
    expect(screen.getByTestId('saneo-filas-compartidos_3mas').textContent).toBe('400');
    expect(screen.getByTestId('saneo-escalares').textContent).toContain('No se escriben; /lista y la métrica ya no los usan');
    const post = llamadas('POST', '/api/v1/art/workers/paz/saneamiento');
    expect(post).toHaveLength(1);
    expect(new URL(String(post[0][0])).searchParams.get('dry_run')).toBe('true');

    const metricaAntes = llamadas('GET', '/api/v1/art/workers/paz/metrica').length;
    const diagAntes = llamadas('GET', '/api/v1/art/workers/paz/diagnostico-telefonos').length;
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar saneamiento' }));
    const modal = await screen.findByRole('alertdialog');
    expect(modal.textContent).toContain('Se desactivan 448 filas y se marcan 400 como estudio contable. No se borra nada.');
    fireEvent.click(within(modal).getByRole('button', { name: 'Sanear' }));
    await waitFor(() => expect(llamadas('POST', '/api/v1/art/workers/paz/saneamiento')).toHaveLength(2));
    const firme = llamadas('POST', '/api/v1/art/workers/paz/saneamiento')[1];
    expect(new URL(String(firme[0])).searchParams.get('dry_run')).toBe('false');
    expect(await screen.findByText(/Saneamiento aplicado/)).toBeTruthy();
    await waitFor(() => {
      expect(llamadas('GET', '/api/v1/art/workers/paz/metrica').length).toBeGreaterThan(metricaAntes);
      expect(llamadas('GET', '/api/v1/art/workers/paz/diagnostico-telefonos').length).toBeGreaterThan(diagAntes);
    });
    // Aplicado: hay que volver a previsualizar para confirmar otra vez.
    expect(screen.getByRole('button', { name: 'Confirmar saneamiento' }).disabled).toBe(true);
  });

  it('Saneamiento: ningún valor de contacto en pantalla', async () => {
    mockFetch();
    await abrirDiagnostico();
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar saneamiento' }));
    await screen.findByTestId('saneo-filas-mater_ii');
    const seccion = screen.getByRole('region', { name: 'Saneamiento ART-116' });
    VALORES_CONTACTO.forEach((re) => expect(seccion.textContent).not.toMatch(re));
    expect(within(seccion).getAllByTestId('saneo-muestra')[0].textContent).toBe('DELTA SAMATER_IITELEFONO');
  });

  it('Saneamiento: todo en 0 dice que no hay nada y no deja confirmar', async () => {
    mockFetch({ 'POST /api/v1/art/workers/paz/saneamiento': SANEO(true, true) });
    await abrirDiagnostico();
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar saneamiento' }));
    expect((await screen.findByTestId('saneo-nada')).textContent)
      .toBe('Nada para sanear. Si ya se aplicó antes, esto es lo esperado.');
    expect(screen.getByRole('button', { name: 'Confirmar saneamiento' }).disabled).toBe(true);
  });

  it('la bandeja de cotizaciones suma la solapa con el contador de pendientes', async () => {
    mockFetch();
    render(<ArtCotizacionesBandejas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('contador-CONTACTOS').textContent).toBe('3'));
    fireEvent.click(screen.getByRole('button', { name: /Contactos propuestos/ }));
    expect(await screen.findByText('ACME SA')).toBeTruthy();
  });
});
