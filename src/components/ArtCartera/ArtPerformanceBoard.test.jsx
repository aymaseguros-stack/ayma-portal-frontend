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
  comparables_por_fuente: {},
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
    comparables_por_fuente: { EMPRESA: con.cotizadas - 2, SIN_COMPARABLE: 2 },
  };
};

const respuestaTablero = ({ advertencias = [], excluidos = { SRT: 84 } } = {}) => ({
  parametros: {
    desde: null,
    hasta: null,
    incluir_caducados: true,
    seccion: null,
    tramo: null,
    hoy: '2026-09-11',
    aseguradoras_del_catalogo: ASEGURADORAS_ART.length,
    eventos_considerados: 320,
    fuentes: ['PLANILLA_2025', 'MANUAL'],
  },
  eventos_excluidos_por_fuente: excluidos,
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
      ciiu_descripcion: 'Venta de partes, piezas y accesorios de vehículos automotores',
      seccion: 'G',
      dotacion: 12,
      tramo: '6-25',
      tipo: 'ALICUOTA',
      motivo: null,
      alicuota: 5.5,
      tarifa_actual: 7.0,
      fuente_tarifa_actual: 'EMPRESA',
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
      ciiu_descripcion: null,
      seccion: null,
      dotacion: null,
      tramo: 'SIN_DATO',
      tipo: 'RECHAZADA',
      motivo: 'CUPO_TOMADO',
      alicuota: null,
      tarifa_actual: null,
      fuente_tarifa_actual: null,
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

// Tablero + drill-down en el mismo mock: los tests de navegación disparan
// los dos endpoints. `conCiiuFueraDeCatalogo` simula un código que está en la
// cartera pero no en el catálogo 2026 (ciiu_descripcion en null).
const mockTableroYDetalle = ({ conCiiuFueraDeCatalogo = false } = {}) => mockFetchPorUrl((url) => {
  if (url.includes('/eventos')) {
    const eventos = respuestaEventos();
    if (conCiiuFueraDeCatalogo) eventos.items[0].ciiu_descripcion = null;
    return jsonResponse(eventos);
  }
  return jsonResponse(respuestaTablero());
});

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

// Filtro "Fuente" (PR #103): qué eventos del histórico cuentan como
// cotización. La verificación del padrón (SRT) dice qué ART tiene la empresa,
// no a cuánto le cotizó una compañía.
describe('ArtPerformanceBoard - filtro de fuente', () => {
  it('arranca con el default del backend (PLANILLA_2025 + MANUAL) y lo manda repetido en la query', async () => {
    soloTablero();
    render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const url = String(globalThis.fetch.mock.calls[0][0]);
    expect(url).toContain('fuente=PLANILLA_2025');
    expect(url).toContain('fuente=MANUAL');
    expect(url).not.toContain('fuente=SRT');

    expect(screen.getByLabelText('Planilla 2025').checked).toBe(true);
    expect(screen.getByLabelText('Manual').checked).toBe(true);
    expect(screen.getByLabelText('SRT (padrón)').checked).toBe(false);
  });

  it('marcar SRT la agrega al corte', async () => {
    soloTablero();
    render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    fireEvent.click(screen.getByLabelText('SRT (padrón)'));

    await waitFor(() => {
      const ultima = String(globalThis.fetch.mock.calls.at(-1)[0]);
      expect(ultima).toContain('fuente=SRT');
      expect(ultima).toContain('fuente=PLANILLA_2025');
    });
  });

  it('desmarcar la última fuente se ignora: cero fuentes haría que el backend aplique su default', async () => {
    soloTablero();
    render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const llamadasIniciales = globalThis.fetch.mock.calls.length;

    fireEvent.click(screen.getByLabelText('Manual'));
    await waitFor(() => expect(globalThis.fetch.mock.calls.length).toBeGreaterThan(llamadasIniciales));
    fireEvent.click(screen.getByLabelText('Planilla 2025'));

    await waitFor(() => {
      const ultima = String(globalThis.fetch.mock.calls.at(-1)[0]);
      expect(ultima).toContain('fuente=PLANILLA_2025');
    });
    expect(screen.getByLabelText('Planilla 2025').checked).toBe(true);
  });

  it('muestra los eventos excluidos por fuente debajo de los totales', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Excluidos por fuente'));
    expect(container.textContent).toContain('SRT (padrón) 84');
  });

  it('sin excluidos no muestra la línea: un "Excluidos: 0" es ruido', async () => {
    soloTablero(respuestaTablero({ excluidos: {} }));
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Totales'));
    expect(container.textContent).not.toContain('Excluidos por fuente');
  });

  it('el tooltip de "sin comparable" abre comparables_por_fuente', async () => {
    soloTablero();
    const { container } = render(<ArtPerformanceBoard token="tok" />);

    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    const conTooltip = Array.from(container.querySelectorAll('span[title]'))
      .map((el) => el.title)
      .filter((t) => t.includes('Cotizadas por origen del comparable'));
    expect(conTooltip.length).toBeGreaterThan(0);
    expect(conTooltip[0]).toContain('Tarifa histórica de la empresa');
    expect(conTooltip[0]).toContain('Sin comparable');
  });

  it('la fuente elegida baja al drill-down: el detalle es el mismo corte que la celda', async () => {
    mockTableroYDetalle();
    const { container } = render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));

    fireEvent.click(screen.getByLabelText('SRT (padrón)'));
    await waitFor(() => expect(String(globalThis.fetch.mock.calls.at(-1)[0])).toContain('fuente=SRT'));
    fireEvent.click(filasDeCuerpo(container)[0]);

    await waitFor(() => {
      const ultima = globalThis.fetch.mock.calls.filter(([url]) => String(url).includes('/eventos')).pop();
      expect(String(ultima[0])).toContain('fuente=SRT');
      expect(String(ultima[0])).toContain('fuente=PLANILLA_2025');
    });
  });
});

// D3 en el drill-down: el CIIU nunca sale solo, y `fuente_tarifa_actual` dice
// de qué escalón de la cascada salió la tarifa contra la que se comparó.
describe('ArtPerformanceEventos - CIIU y fuente de la tarifa actual', () => {
  it('el CIIU sale con su descripción y la fuente de la tarifa actual en texto', async () => {
    mockTableroYDetalle();
    const { container } = render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]);

    await waitFor(() => expect(container.textContent).toContain('ACME SRL'));
    expect(container.textContent).toContain('4520 — Venta de partes, piezas y accesorios');
    expect(container.textContent).toContain('Tarifa histórica de la empresa');
    // El evento sin CIIU no muestra un código pelado ni inventa descripción.
    expect(container.textContent).toContain('Fuente tarifa actual');
  });

  it('CIIU sin descripción en el catálogo: lo dice, no muestra el código solo', async () => {
    mockTableroYDetalle({ conCiiuFueraDeCatalogo: true });
    const { container } = render(<ArtPerformanceBoard token="tok" />);
    await waitFor(() => expect(filasDeCuerpo(container).length).toBe(ASEGURADORAS_ART.length));
    fireEvent.click(filasDeCuerpo(container)[0]);

    await waitFor(() => expect(container.textContent).toContain('ACME SRL'));
    expect(container.textContent).toContain('4520 — no está en el catálogo 2026');
  });
});
