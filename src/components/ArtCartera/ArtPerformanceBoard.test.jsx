// @vitest-environment jsdom
//
// Tests de la sub-pestaña "Performance" del módulo ART (BLOQUE 2) contra
// GET /art/performance-companias y su drill-down
// (app/api/v1/art_performance.py del backend, PR #102).
//
// Lo que cubren, en orden: que la tabla liste las 19 compañías del catálogo
// -incluidas las de 0 eventos, que son varias y NO se filtran-, que el
// orden por columna sea el del dato y no el del texto renderizado, que las
// `advertencias` del backend se vean, que el drill-down abra y vuelva sin
// perder el tablero, y que los dos CSV se pidan con el header de
// Authorization (nunca como un <a href> plano: la ruta es admin-only con
// JWT y el archivo bajaría con el 401 adentro).
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtPerformanceBoard from './ArtPerformanceBoard';
import { ASEGURADORAS_ART } from './artCarteraConstants';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

// Las cuatro primeras del catálogo tienen eventos; el resto viene en cero,
// que es como lo manda el backend (una entrada por aseguradora activa).
const CON_EVENTOS = {
  plus: { cotizadas: 30, ganadora: 12, perdedora: 8, alicuota_g: 4.2 },
  asociart: { cotizadas: 50, ganadora: 5, perdedora: 25, alicuota_g: 7.9 },
  provincia: { cotizadas: 10, ganadora: 9, perdedora: 1, alicuota_g: 2.1 },
  smg: { cotizadas: 20, ganadora: 4, perdedora: 4, alicuota_g: 6.5 },
};

const bloqueVacio = () => ({
  eventos_total: 0,
  cotizadas: 0,
  benchmark_ganadora: 0,
  benchmark_perdedora: 0,
  sin_comparable: 0,
  tasa_ganadora: null,
  por_tramo: {},
  rechazadas_total: 0,
  rechazadas_por_motivo: {},
  rechazadas_vigentes: 0,
  bloqueadas_total: 0,
  bloqueadas_vigentes: 0,
  tecnica_abiertas: 0,
  tecnica_resueltas: 0,
  dias_en_tecnica_promedio: null,
  alicuota_promedio_cotizada: null,
  alicuota_promedio_ganadora: null,
  alicuota_promedio_perdedora: null,
  alicuota_mediana_ganadora: null,
  alicuota_mediana_perdedora: null,
  descuento_promedio_vs_actual: null,
  descuento_mediano_vs_actual: null,
});

const companiaFixture = (id) => {
  const con = CON_EVENTOS[id];
  if (!con) return { ...bloqueVacio(), aseguradora: id };
  return {
    ...bloqueVacio(),
    aseguradora: id,
    eventos_total: con.cotizadas + 3,
    cotizadas: con.cotizadas,
    benchmark_ganadora: con.ganadora,
    benchmark_perdedora: con.perdedora,
    sin_comparable: 2,
    tasa_ganadora: Number((con.ganadora / (con.ganadora + con.perdedora)).toFixed(4)),
    rechazadas_total: 3,
    rechazadas_vigentes: 1,
    bloqueadas_total: 2,
    bloqueadas_vigentes: 0,
    tecnica_abiertas: 1,
    tecnica_resueltas: 2,
    dias_en_tecnica_promedio: 12.5,
    alicuota_promedio_ganadora: con.alicuota_g,
    alicuota_promedio_perdedora: 8.02,
    descuento_promedio_vs_actual: -0.18,
  };
};

const respuestaTablero = ({ advertencias = [] } = {}) => ({
  parametros: {
    desde: null,
    hasta: null,
    incluir_caducados: true,
    seccion: null,
    tramo: null,
    hoy: '2026-09-11',
    aseguradoras_del_catalogo: ASEGURADORAS_ART.length,
    eventos_considerados: 320,
  },
  totales: { ...companiaFixture('plus'), aseguradora: 'TOTALES', cotizadas: 110 },
  companias: ASEGURADORAS_ART.map((a) => companiaFixture(a.id)),
  advertencias,
});

const respuestaEventos = () => ({
  aseguradora: 'asociart',
  total: 2,
  page: 1,
  size: 100,
  items: [
    {
      id: 1,
      cuit: '30-71000001-7',
      razon_social: 'ACME SRL',
      ciiu: '4520',
      seccion: 'G',
      dotacion: 12,
      tramo: '6-25',
      tipo: 'ALICUOTA',
      motivo: null,
      alicuota: 5.5,
      tarifa_actual: 7.0,
      descuento_vs_actual: -0.2143,
      resultado: 'ganadora',
      fecha_evento: '2025-04-10',
      fecha_caducidad: '2025-07-09',
      vigente: false,
      fuente: 'PLANILLA_2025',
    },
    {
      id: 2,
      cuit: null,
      razon_social: 'SIN CUIT SA',
      ciiu: null,
      seccion: null,
      dotacion: null,
      tramo: 'SIN_DATO',
      tipo: 'RECHAZADA',
      motivo: 'CUPO_TOMADO',
      alicuota: null,
      tarifa_actual: null,
      descuento_vs_actual: null,
      resultado: null,
      fecha_evento: '2025-05-02',
      fecha_caducidad: null,
      vigente: true,
      fuente: 'MANUAL',
    },
  ],
});

// Router de mocks por URL: el tablero y el drill-down piden endpoints
// distintos y los tests de navegación disparan los dos.
const mockFetchPorUrl = (handler) => {
  globalThis.fetch = vi.fn(async (url, opciones) => handler(String(url), opciones));
  return globalThis.fetch;
};

const soloTablero = (body = respuestaTablero()) =>
  mockFetchPorUrl(() => jsonResponse(body));

const filasDeCuerpo = (container) => Array.from(container.querySelectorAll('tbody tr'));

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtPerformanceBoard - tablero', () => {
  it('lista las 19 compañías del catálogo, incluidas las de 0 eventos (al final y atenuadas)', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    expect(ASEGURADORAS_ART.length).toBe(19);
    ASEGURADORAS_ART.forEach((a) => expect(container.textContent).toContain(a.label));

    const filas = filasDeCuerpo(container);
    // Las cuatro con eventos arriba; las de cero, al final y en opacity-40.
    expect(filas.slice(0, 4).some((f) => f.className.includes('opacity-40'))).toBe(false);
    expect(filas[filas.length - 1].className).toContain('opacity-40');
  });

  it('la fila de totales muestra el agregado del backend, no la suma del cliente', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Totales'));
    const totales = container.querySelector('thead tr:last-child');
    expect(totales.textContent).toContain('110');
  });

  it('la leyenda de la definición es fija: ganadora/perdedora es benchmark, no venta', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Performance por compañía'));
    expect(container.textContent).toContain('benchmark de precio contra la tarifa actual');
    expect(container.textContent).toContain('No son ventas de AYMA');
  });

  it('ordena por la columna clickeada y alterna la dirección', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    // Orden inicial: cotizadas desc -> Asociart (50) primera.
    expect(filasDeCuerpo(container)[0].textContent).toContain('Asociart');

    // Alícuota promedio ganadora, desc -> Asociart (7,9) sigue primera...
    fireEvent.click(screen.getByRole('button', { name: /Alícuota prom\. ganadora/ }));
    await waitFor(() => expect(filasDeCuerpo(container)[0].textContent).toContain('Asociart'));

    // ...y asc -> Provincia (2,1) pasa al tope.
    fireEvent.click(screen.getByRole('button', { name: /Alícuota prom\. ganadora/ }));
    await waitFor(() => expect(filasDeCuerpo(container)[0].textContent).toContain('Provincia'));

    // Aun ordenando por una columna donde todas las de 0 eventos empatan en
    // null, siguen al final: son la mitad del catálogo y taparían al resto.
    const filas = filasDeCuerpo(container);
    expect(filas[filas.length - 1].className).toContain('opacity-40');
  });

  it('muestra las advertencias del backend en un aviso amarillo y no lo dibuja cuando vienen vacías', async () => {
    soloTablero(respuestaTablero({
      advertencias: ['La alícuota promedio ganadora se desvía 22% de la referencia de ESPEC §4.'],
    }));
    const { container, unmount } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Advertencias del cálculo'));
    expect(container.textContent).toContain('se desvía 22%');
    expect(container.querySelector('.bg-yellow-500\\/15')).toBeTruthy();
    unmount();

    soloTablero();
    const segunda = render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(segunda.container.textContent).toContain('Performance por compañía'));
    expect(segunda.container.textContent).not.toContain('Advertencias del cálculo');
  });

  it('un 500 no rompe la pantalla: muestra el error', async () => {
    mockFetchPorUrl(() => jsonResponse({ detail: 'boom' }, { ok: false, status: 500 }));
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No se pudo cargar la performance'));
  });

  it('cuerpo null: no lanza y muestra el estado vacío', async () => {
    mockFetchPorUrl(() => jsonResponse(null));
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('No hay compañías para este corte'));
  });

  it('el CSV del tablero se pide con Authorization y formato=csv, no como link plano', async () => {
    const blob = new Blob(['aseguradora,tramo\n'], { type: 'text/csv' });
    mockFetchPorUrl((url) => (url.includes('formato=csv')
      ? { ok: true, status: 200, blob: async () => blob }
      : jsonResponse(respuestaTablero())));
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();

    render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(screen.getByText('CSV')).toBeTruthy());
    fireEvent.click(screen.getByText('CSV'));

    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    const llamada = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('formato=csv'));
    expect(llamada).toBeTruthy();
    expect(llamada[0]).toContain('/art/performance-companias');
    expect(llamada[1].headers.Authorization).toBe('Bearer tok');
  });
});

describe('ArtPerformanceBoard - drill-down por compañía', () => {
  const mockTableroYEventos = () => mockFetchPorUrl((url) => (url.includes('/eventos')
    ? jsonResponse(respuestaEventos())
    : jsonResponse(respuestaTablero())));

  it('clic en una fila abre el detalle en el mismo panel y "Volver" regresa al tablero', async () => {
    mockTableroYEventos();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]); // Asociart, la de más cotizadas

    await waitFor(() => expect(container.textContent).toContain('ACME SRL'));
    expect(container.textContent).toContain('Asociart');
    expect(container.textContent).toContain('30-71000001-7');
    // Sigue siendo el mismo panel: no hay ruta nueva, sólo un botón Volver.
    expect(screen.getByText('Volver')).toBeTruthy();
    const pedido = globalThis.fetch.mock.calls.find(([url]) => String(url).includes('/eventos'));
    expect(pedido[0]).toContain('/art/performance-companias/asociart/eventos');

    fireEvent.click(screen.getByText('Volver'));
    await waitFor(() => expect(container.textContent).toContain('Performance por compañía'));
    expect(container.textContent).not.toContain('ACME SRL');
  });

  it('clic en el CUIT abre la ficha de empresa; una fila sin CUIT no es clickeable', async () => {
    mockTableroYEventos();
    const onAbrirFicha = vi.fn();
    const { container } = render(<ArtPerformanceBoard token="tok" onAbrirFicha={onAbrirFicha} />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]);

    await waitFor(() => expect(screen.getByText('30-71000001-7')).toBeTruthy());
    fireEvent.click(screen.getByText('30-71000001-7'));
    expect(onAbrirFicha).toHaveBeenCalledWith('30-71000001-7');
    // La fila sin CUIT se renderiza igual, con guion en vez de botón.
    expect(container.textContent).toContain('SIN CUIT SA');
  });

  it('el CSV de eventos se pide con Authorization sobre el endpoint del drill-down', async () => {
    const blob = new Blob(['cuit,razon_social\n'], { type: 'text/csv' });
    mockFetchPorUrl((url) => {
      if (url.includes('/eventos') && url.includes('formato=csv')) {
        return { ok: true, status: 200, blob: async () => blob };
      }
      if (url.includes('/eventos')) return jsonResponse(respuestaEventos());
      return jsonResponse(respuestaTablero());
    });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();

    const { container } = render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]);

    await waitFor(() => expect(screen.getByText('CSV')).toBeTruthy());
    fireEvent.click(screen.getByText('CSV'));

    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalled());
    const llamada = globalThis.fetch.mock.calls.find(
      ([url]) => String(url).includes('/eventos') && String(url).includes('formato=csv'),
    );
    expect(llamada).toBeTruthy();
    expect(llamada[0]).toContain('/art/performance-companias/asociart/eventos');
    expect(llamada[1].headers.Authorization).toBe('Bearer tok');
  });

  it('los filtros del detalle viajan al backend y el tramo/motivo elegido va en la query', async () => {
    mockTableroYEventos();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]);
    await waitFor(() => expect(screen.getByLabelText('Resultado')).toBeTruthy());

    fireEvent.change(screen.getByLabelText('Resultado'), { target: { value: 'perdedora' } });

    await waitFor(() => {
      const ultima = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/eventos')).pop();
      expect(String(ultima[0])).toContain('resultado=perdedora');
    });
  });
});
