// @vitest-environment jsdom
//
// Tests de la pantalla "Grilla de cotización" (BLOQUE 1.2) contra GET
// /art/empresas/{id}/grilla.
//
// LO QUE PROTEGEN, en orden de gravedad comercial:
//
// 1. Que un importe en `null` NO se renderice como 0. Cuando el backend no
//    pudo estimar la masa manda null en todos los pesos (advertencia
//    SIN_MASA); un "$ 0" ahí afirma que no hay ahorro cuando lo que pasa
//    es que no se sabe. Es la misma regla que el backend protege del otro
//    lado (tests/test_grilla_art.py::test_sin_masa_los_importes_quedan_en_null).
// 2. Que la fila de la mejor oferta se distinga y las no cotizables
//    muestren su motivo y su vencimiento.
// 3. Que la leyenda "a confirmar" acompañe SIEMPRE a la tarifa actual: es
//    un dato de planilla, no de póliza, y todo el ahorro cuelga de él.
// 4. Que ninguna de las formas que puede mandar el backend (completa,
//    campos faltantes, cuerpo vacío, 500) tire React error #31 - mismo
//    patrón que ArtMercadoBoard.test.jsx / ArtReferencialTarifasBoard.test.jsx.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtGrillaCotizacion from './ArtGrillaCotizacion';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const fila = (aseguradora, extra = {}) => ({
  aseguradora,
  aseguradora_display: aseguradora,
  estado_efectivo: 'COTIZABLE',
  estado_motivo: null,
  estado_vence: null,
  estado_desde: null,
  estado_sla: null,
  alicuota_propia: null,
  alicuota_benchmark: null,
  alicuota_ref: null,
  origen_alicuota: null,
  delta_vs_actual: null,
  lrtm: null,
  lrta: null,
  ahorro_anual: null,
  comision_neta: null,
  win: null,
  w_x_trbj: null,
  ...extra,
});

// Los Decimal del backend llegan como STRING (FastAPI los serializa así
// para no perder precisión), nunca como number - los fixtures lo respetan.
const GRILLA_COMPLETA = {
  empresa_id: 'emp-1',
  cuit: '30500001234',
  razon_social: 'COMERCIAL SANTAFESINA SA',
  ciiu: '4711',
  ciiu_seccion: 'G',
  provincia: 'SANTA FE',
  dotacion: 40,
  masa: {
    masa_mensual: '40000.00',
    dotacion_usada: 40,
    origen_dotacion: 'EMPRESA',
    salario_ref: '1000.00',
    periodo_ref: '2026-08',
    nivel_match: 'PROVINCIA_SECTOR_TRAMO',
    confianza: 'ALTA',
    referencia_id: 'ref-1',
    advertencias: [],
    origen: 'ESTIMADA',
    sin_referencia: false,
  },
  confianza_masa: 'ALTA',
  tarifa_actual: '3.500',
  origen_tarifa: 'PLANILLA',
  tarifa_actual_leyenda: 'a confirmar',
  art_actual: 'galeno',
  art_actual_display: 'Galeno ART',
  art_actual_origen: 'SRT',
  art_actual_fecha: '2026-09-01',
  riesgo_suscripcion: 'NORMAL',
  mejor_oferta: null,
  ahorro_potencial_max: '7800.00',
  advertencias: [],
  aseguradoras: [
    fila('plus', {
      alicuota_ref: '2.000', origen_alicuota: 'PROPIA_VIGENTE',
      delta_vs_actual: '-0.4286', lrtm: '800.00', lrta: '10400.00',
      ahorro_anual: '7800.00', comision_neta: '32.00',
    }),
    fila('galeno', { estado_efectivo: 'ACTUAL' }),
    fila('smg', {
      estado_efectivo: 'BLOQUEADA', estado_motivo: 'CUPO_TOMADO',
      estado_vence: '2026-10-15', alicuota_ref: '2.500',
      origen_alicuota: 'BENCHMARK',
      alicuota_benchmark: { valor: '2.500', nivel: 'SECCION', n_muestras: 7 },
    }),
  ],
  ranking: ['plus'],
};
GRILLA_COMPLETA.mejor_oferta = GRILLA_COMPLETA.aseguradoras[0];

// Lo que devuelve GET /art/propuestas/{id} después de armarla desde la
// grilla. Sólo los campos que la pantalla de detalle lee.
const PROPUESTA_CREADA = {
  id: 'prop-7',
  empresa_id: 'emp-1',
  version: 1,
  aseguradora: 'plus',
  aseguradora_display: 'Plus ART',
  alicuota_ofertada: '2.000',
  origen_alicuota: 'COTIZACION_REAL',
  masa_salarial: '40000.00',
  dotacion: 40,
  origen_masa: 'ESTIMADA',
  confianza_masa: 'ALTA',
  sujeta_a_f931: true,
  art_actual: 'galeno',
  art_actual_display: 'Galeno ART',
  tarifa_actual: '3.500',
  lrt_mensual: '800.00',
  lrt_anual: '10400.00',
  ahorro_anual: '7800.00',
  costo_x_trabajador_mensual: '20.00',
  comision_bruta: '40.00',
  comision_neta: '32.00',
  win: '24.00',
  w_x_trbj: '0.60',
  bajo_umbral: false,
  parametros_snapshot: { cuotas_anuales: '13' },
  estado: 'BORRADOR',
  estado_efectivo: 'BORRADOR',
  dias_restantes: 30,
  fecha_emision: '2026-09-10',
  valida_hasta: '2026-10-10',
  fecha_entrega: null,
  tiene_pdf: false,
  hash_sha256: null,
  vault_token: null,
  observaciones: null,
  creada_por: 'user-1',
  creada_en: '2026-09-10T12:00:00',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

const botonesArmar = () => screen.getAllByRole('button', { name: 'Armar propuesta' });

const renderGrilla = () => render(
  <ArtGrillaCotizacion token="tok" empresaId="emp-1" onVolver={() => {}} />,
);

describe('ArtGrillaCotizacion - GET /art/empresas/{id}/grilla', () => {
  it('pide la grilla por id de empresa, no por CUIT', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/art/empresas/emp-1/grilla');
  });

  it('respuesta completa: cabecera, matriz y mejor oferta, sin lanzar', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();

    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());
    expect(screen.getByText(/30500001234/)).toBeTruthy();
    expect(screen.getByText('Galeno ART')).toBeTruthy();
    expect(screen.getByText(/Riesgo NORMAL/)).toBeTruthy();
    // Los 19 códigos no están en el fixture, pero sí las 3 filas mandadas.
    expect(screen.getByText('Plus')).toBeTruthy();
    expect(screen.getByText('SMG')).toBeTruthy();
  });

  it('la tarifa actual sale siempre con la leyenda "a confirmar"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText('a confirmar')).toBeTruthy());
  });

  it('muestra el badge de confianza de la masa', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/Masa estimada · confianza alta/i)).toBeTruthy());
  });

  // El badge dice "MASA confirmada" y no "Confirmada" a secas: al lado hay
  // otro badge, el de la alícuota, y un "Confirmada (F.931)" suelto entre
  // los dos se lee como si toda la fila estuviera validada.
  it('el badge de la masa dice MASA confirmada (F.931) cuando fue declarada', async () => {
    const confirmada = {
      ...GRILLA_COMPLETA,
      confianza_masa: 'CONFIRMADA',
      masa: { ...GRILLA_COMPLETA.masa, confianza: 'CONFIRMADA', origen: 'F931' },
    };
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(confirmada));
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/Masa confirmada \(F\.931\)/)).toBeTruthy());
  });

  it('una fila no cotizable muestra su motivo y su vencimiento', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText('CUPO_TOMADO')).toBeTruthy());
    expect(screen.getByText(/hasta:/)).toBeTruthy();
  });

  it('el benchmark dice con cuánta evidencia habla', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/Referencia de mercado.*sector.*n=7/)).toBeTruthy());
  });
});

describe('ArtGrillaCotizacion - SIN_MASA no puede verse como cero', () => {
  const SIN_MASA = {
    ...GRILLA_COMPLETA,
    masa: {
      ...GRILLA_COMPLETA.masa,
      masa_mensual: null, salario_ref: null, periodo_ref: null,
      nivel_match: null, referencia_id: null, confianza: 'BAJA',
      sin_referencia: true,
      advertencias: ['No hay ninguna fila cargada en referencia_salarial.'],
    },
    confianza_masa: 'BAJA',
    ahorro_potencial_max: null,
    advertencias: ['SIN_MASA'],
    aseguradoras: [
      fila('plus', { alicuota_ref: '2.000', origen_alicuota: 'PROPIA_VIGENTE', delta_vs_actual: '-0.4286' }),
    ],
    mejor_oferta: null,
    ranking: ['plus'],
  };

  it('ningún importe se renderiza como $ 0', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(SIN_MASA));
    const { container } = renderGrilla();
    await waitFor(() => expect(screen.getByText('Plus')).toBeTruthy());
    expect(container.textContent).not.toContain('$ 0');
  });

  it('avisa por qué faltan los importes y deja ver la alícuota y el delta', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(SIN_MASA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/No se pudo estimar la masa salarial/)).toBeTruthy());
    // Lo que NO depende de la masa sigue en pantalla.
    expect(screen.getByText('2%')).toBeTruthy();
    expect(screen.getByText('-42,9%')).toBeTruthy();
  });
});

describe('ArtGrillaCotizacion - formas degradadas de la respuesta', () => {
  it('cuerpo con campos faltantes: no lanza', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      empresa_id: 'emp-1', confianza_masa: 'BAJA', riesgo_suscripcion: 'NORMAL',
    }));
    renderGrilla();
    await waitFor(() => expect(screen.getByText('Grilla de cotización')).toBeTruthy());
  });

  it('cuerpo null: cae al estado de error en vez de romper', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(null));
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/No se pudo cargar la grilla/)).toBeTruthy());
  });

  it('500: muestra el error con opción de reintentar', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse({ detail: 'Error interno' }, { ok: false, status: 500 }),
    );
    renderGrilla();
    await waitFor(() => expect(screen.getByText(/No se pudo cargar la grilla/)).toBeTruthy());
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});

describe('ArtGrillaCotizacion - carga de F.931', () => {
  it('el modal postea con dry_run=false en la query y recarga la grilla', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA))   // carga inicial
      .mockResolvedValueOnce(jsonResponse({ escritura: true }))  // POST f931
      .mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));  // recarga

    renderGrilla();
    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());

    fireEvent.click(screen.getByText('Cargar F.931'));
    fireEvent.change(screen.getByLabelText('Masa salarial mensual'), { target: { value: '5000000' } });
    fireEvent.change(screen.getByLabelText('Dotación declarada'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Período (AAAA-MM)'), { target: { value: '2026-07' } });
    fireEvent.click(screen.getByText('Guardar F.931'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));

    const [url, opciones] = globalThis.fetch.mock.calls[1];
    // dry_run SOLO por query string: mandarlo en el body es 422
    // (ESTANDAR-API-AYMA-v1.0). Y explícito en false, porque el default
    // del backend es la corrida en seco.
    expect(url).toContain('/art/empresas/emp-1/f931?dry_run=false');
    expect(opciones.method).toBe('POST');
    const body = JSON.parse(opciones.body);
    expect(body).toEqual({ masa_salarial: 5000000, dotacion: 40, periodo: '2026-07' });
    expect(body.dry_run).toBeUndefined();
    // La tercera llamada es la recarga de la grilla.
    expect(globalThis.fetch.mock.calls[2][0]).toContain('/art/empresas/emp-1/grilla');
  });

  it('un período mal escrito se frena en el cliente, sin postear', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();
    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());

    fireEvent.click(screen.getByText('Cargar F.931'));
    fireEvent.change(screen.getByLabelText('Masa salarial mensual'), { target: { value: '5000000' } });
    fireEvent.change(screen.getByLabelText('Dotación declarada'), { target: { value: '40' } });
    fireEvent.change(screen.getByLabelText('Período (AAAA-MM)'), { target: { value: 'julio 2026' } });
    fireEvent.click(screen.getByText('Guardar F.931'));

    await waitFor(() => expect(screen.getByText(/formato 'AAAA-MM'/)).toBeTruthy());
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
  // -------------------------------------------------------------------------
  // Armar propuesta (BLOQUE 1.3): el drill-down desde la fila cotizable.
  // -------------------------------------------------------------------------

  it('sólo las filas cotizables CON alícuota ofrecen "Armar propuesta"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();

    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());
    // El fixture tiene tres filas: plus (cotizable con alícuota), galeno
    // (ACTUAL, sin alícuota) y smg (BLOQUEADA, con alícuota). Sólo la
    // primera se puede proponer: sobre una bloqueada el botón prometería
    // una gestión que hoy no se puede hacer.
    expect(screen.getAllByText('Armar propuesta').length).toBe(1);
  });

  it('armar una propuesta abre su detalle sin salir de la grilla', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA))
      .mockResolvedValueOnce(jsonResponse({
        propuesta: { id: 'prop-7' }, advertencias: [],
      }))
      .mockResolvedValueOnce(jsonResponse(PROPUESTA_CREADA));

    renderGrilla();
    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());

    fireEvent.click(screen.getByText('Armar propuesta'));
    // El formulario viene prellenado con la fila: no hay que re-tipear el
    // precio que la grilla ya resolvió.
    expect(screen.getByLabelText('Alícuota ofertada (%)').value).toBe('2.000');
    // Y como esa alícuota es PROPIA_VIGENTE, el origen arranca en
    // cotización real.
    expect(screen.getByLabelText('Origen de la alícuota').value).toBe('COTIZACION_REAL');

    // Con el modal abierto hay dos botones "Armar propuesta": el de la
    // fila (que quedó atrás) y el submit del formulario. El del formulario
    // es el último en montarse.
    fireEvent.click(botonesArmar().at(-1));

    await waitFor(() => expect(screen.getByText(/Propuesta v1/)).toBeTruthy());
    expect(globalThis.fetch.mock.calls[1][0]).toContain('/art/empresas/emp-1/propuestas');
    expect(globalThis.fetch.mock.calls[2][0]).toContain('/art/propuestas/prop-7');
  });

  it('al volver de la propuesta se recarga la grilla', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA))
      .mockResolvedValueOnce(jsonResponse({ propuesta: { id: 'prop-7' }, advertencias: [] }))
      .mockResolvedValueOnce(jsonResponse(PROPUESTA_CREADA))
      .mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));

    renderGrilla();
    await waitFor(() => expect(screen.getByText('COMERCIAL SANTAFESINA SA')).toBeTruthy());
    fireEvent.click(screen.getByText('Armar propuesta'));
    // Con el modal abierto hay dos botones "Armar propuesta": el de la
    // fila (que quedó atrás) y el submit del formulario. El del formulario
    // es el último en montarse.
    fireEvent.click(botonesArmar().at(-1));
    await waitFor(() => expect(screen.getByText('Volver a la grilla')).toBeTruthy());

    fireEvent.click(screen.getByText('Volver a la grilla'));

    // Entregar una propuesta con origen COTIZACION_REAL asienta esa
    // alícuota como propia de la empresa: la grilla de atrás ya no dice lo
    // mismo, así que se vuelve a pedir.
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(4));
    expect(globalThis.fetch.mock.calls[3][0]).toContain('/art/empresas/emp-1/grilla');
  });
});

// ---------------------------------------------------------------------------
// Badge de confianza de la ALÍCUOTA
// ---------------------------------------------------------------------------
//
// Por qué es un badge y no letra chica: de dónde salió la alícuota decide
// si el número se puede ofrecer por teléfono o si primero hay que pedirle
// el precio a la aseguradora. Y por qué tiene forma distinta a la del badge
// de la masa: son dos ejes independientes. Con la misma forma se leían como
// una sola escala de "confianza de la fila", que no existe - se puede tener
// la masa declarada por F.931 y la alícuota sacada de una mediana.
describe('ArtGrillaCotizacion - confianza de la alícuota', () => {
  it('cada fila muestra el origen de su alícuota como badge', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(GRILLA_COMPLETA));
    renderGrilla();

    await waitFor(() => expect(screen.getAllByText(/Cotizada|Referencia de mercado/).length)
      .toBeGreaterThan(0));
    const badge = screen.getAllByText(/Cotizada|Referencia de mercado/)[0];
    expect(badge.className).toContain('rounded');
    // Contorno (border), no pastilla llena como el de la masa.
    expect(badge.className).toContain('border');
  });

  it('el badge de la alícuota y el de la masa se leen distinto', async () => {
    const confirmada = {
      ...GRILLA_COMPLETA,
      confianza_masa: 'CONFIRMADA',
      masa: { ...GRILLA_COMPLETA.masa, confianza: 'CONFIRMADA', origen: 'F931' },
    };
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(confirmada));
    renderGrilla();

    await waitFor(() => expect(screen.getByText(/Masa confirmada \(F\.931\)/)).toBeTruthy());
    // Masa confirmada Y alícuota de benchmark conviven: el F.931 no dice
    // nada sobre el origen del precio.
    const masa = screen.getByText(/Masa confirmada \(F\.931\)/);
    expect(masa.className).not.toContain('border');
  });
});
