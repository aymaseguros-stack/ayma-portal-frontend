// @vitest-environment jsdom
//
// Dirección > Finanzas. Lo que estos tests protegen, en orden de gravedad:
//
//  1. ARS y USD NUNCA se suman: los totales van en filas separadas y el
//     convertido, si existe, va aparte y rotulado.
//  2. `pct_ejecutado: null` se rotula "Gastado sin presupuesto asignado" y
//     NO se muestra como 0%.
//  3. Los flujos con dry_run muestran la propuesta ANTES de escribir, y
//     recién con "Confirmar" mandan dry_run=false.
//  4. Anular no borra: la fila sigue visible, tachada y con su fecha.
//  5. El 409 de comisión duplicada se ve como un mensaje entendible.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionFinanzas from './DireccionFinanzas';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

let llamadas;
let rutas;

const RESUMEN = {
  periodo: '2026-09',
  por_rubro: [
    { rubro: 'IA', moneda: 'ARS', asignado: '100000.00', ejecutado: '80000.00', desvio: '-20000.00', pct_ejecutado: '80.0' },
    { rubro: 'IA', moneda: 'USD', asignado: '500.00', ejecutado: '600.00', desvio: '100.00', pct_ejecutado: '120.0' },
    // El caso importante: gastado SIN presupuesto asignado.
    { rubro: 'TELEFONIA', moneda: 'ARS', asignado: '0.00', ejecutado: '35000.00', desvio: '35000.00', pct_ejecutado: null },
  ],
  marketing_por_canal: [
    { canal: 'META_ADS', moneda: 'ARS', asignado: '50000.00', gastado: '52000.00', desvio: '2000.00', pct_ejecutado: '104.0' },
    { canal: null, moneda: 'ARS', asignado: '90000.00', gastado: '52000.00', desvio: '-38000.00', pct_ejecutado: '57.8' },
  ],
  totales_por_moneda: {
    ARS: { asignado: '190000.00', ejecutado: '167000.00', desvio: '-23000.00' },
    USD: { asignado: '500.00', ejecutado: '600.00', desvio: '100.00' },
  },
  total_convertido: {
    etiqueta: 'CONVERTIDO_CON_TIPO_DE_CAMBIO_DE_CADA_GASTO',
    moneda_destino: 'ARS', total_convertido: '767000.00',
    gastos_convertidos: 1, sin_tipo_cambio: 2, completo: false,
  },
};

const responder = (url, init) => {
  const u = String(url);
  llamadas.push({ url: u, init });
  rutas.push(`${init?.method || 'GET'} ${u}`);
  if (u.includes('/presupuesto/resumen')) return Promise.resolve(respuesta(RESUMEN));
  if (u.includes('/presupuesto/serie')) return Promise.resolve(respuesta({ desde: '2026-04', hasta: '2026-09', puntos: [] }));
  if (u.includes('/presupuesto/asignaciones/copiar')) {
    const dryRun = u.includes('dry_run=true');
    return Promise.resolve(respuesta({
      escritura: !dryRun, dry_run: dryRun, desde: '2026-08', hacia: '2026-09',
      a_copiar: 1, copiadas: dryRun ? 0 : 1, ya_existentes: 1,
      detalle: [
        { rubro: 'IA', canal: null, moneda: 'ARS', accion: 'COPIAR' },
        { rubro: 'MARKETING', canal: 'META_ADS', moneda: 'ARS', accion: 'YA_EXISTE' },
      ],
    }));
  }
  if (u.includes('/presupuesto/asignaciones')) return Promise.resolve(respuesta([]));
  if (u.includes('/gastos/generar-recurrentes')) {
    const dryRun = u.includes('dry_run=true');
    return Promise.resolve(respuesta({
      escritura: !dryRun, dry_run: dryRun, periodo: '2026-09',
      proveedores_evaluados: 2, gastos_a_crear: 1, gastos_creados: dryRun ? 0 : 1, ya_existentes: 1,
      propuestos: [
        { proveedor_id: 'p1', proveedor_nombre: 'Render', rubro: 'SERVICIOS_WEB', monto: '25000.00', moneda: 'ARS', omitido_porque: null },
        { proveedor_id: 'p2', proveedor_nombre: 'OpenAI', rubro: 'IA', monto: '30000.00', moneda: 'ARS', omitido_porque: 'ya existe el gasto recurrente g9 para 2026-09' },
      ],
    }));
  }
  if (u.includes('/presupuesto/gastos')) {
    return Promise.resolve(respuesta([
      { id: 'g1', fecha: '2026-09-01', periodo: '2026-09', rubro: 'IA', canal: null, concepto: 'OpenAI', monto: '30000.00', moneda: 'ARS', origen: 'MANUAL', anulado_en: null },
      { id: 'g2', fecha: '2026-09-03', periodo: '2026-09', rubro: 'TELEFONIA', canal: null, concepto: 'Línea vieja', monto: '9000.00', moneda: 'ARS', origen: 'MANUAL', anulado_en: '2026-09-10T12:00:00' },
    ]));
  }
  if (u.includes('/comisiones-liquidadas')) {
    if (init?.method === 'POST') {
      return Promise.resolve(respuesta({
        detail: 'Ya existe una comisión liquidada vigente (c1) para Galeno/ART/2026-09/ARS',
      }, 409));
    }
    return Promise.resolve(respuesta([
      { id: 'c1', compania: 'Galeno', ramo: 'ART', periodo: '2026-09', monto: '500000.00', moneda: 'ARS', fuente: 'LIQUIDACION_COMPANIA', anulado_en: null },
      { id: 'c2', compania: 'Swiss', ramo: 'ART', periodo: '2026-09', monto: '1200.00', moneda: 'USD', fuente: 'FACTURA', anulado_en: null },
      { id: 'c3', compania: 'Provincia', ramo: 'ART', periodo: '2026-09', monto: '80000.00', moneda: 'ARS', fuente: 'MANUAL', anulado_en: '2026-09-11T10:00:00' },
    ]));
  }
  if (u.includes('/direccion/proveedores')) {
    return Promise.resolve(respuesta([
      { id: 'p1', nombre: 'Render', estado: 'ACTIVO', costo_mensual: '25000.00', rubro_presupuesto: 'SERVICIOS_WEB' },
      { id: 'p3', nombre: 'Contador', estado: 'ACTIVO', costo_mensual: null, rubro_presupuesto: null },
      { id: 'p4', nombre: 'Estudio', estado: 'ACTIVO', costo_mensual: '5000.00', rubro_presupuesto: null },
    ]));
  }
  return Promise.resolve(respuesta([]));
};

beforeEach(() => {
  llamadas = []; rutas = [];
  globalThis.fetch = vi.fn((url, init) => responder(url, init));
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Presupuesto', () => {
  it('los totales van POR MONEDA en filas separadas y no hay un total sumado', async () => {
    render(<DireccionFinanzas token="t" />);
    await screen.findByText('Totales por moneda');
    expect(screen.getAllByText('ARS 190.000,00').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USD 500,00').length).toBeGreaterThan(0);
    // 190000 + 500 = 190500: la suma entre monedas no puede existir.
    expect(screen.queryByText(/190\.500/)).toBeNull();
  });

  it('el total convertido va APARTE, rotulado, y avisa que es parcial', async () => {
    render(<DireccionFinanzas token="t" />);
    expect(await screen.findByText(/CONVERTIDO_CON_TIPO_DE_CAMBIO_DE_CADA_GASTO/)).toBeTruthy();
    expect(screen.getByText(/este convertido es parcial/)).toBeTruthy();
    expect(screen.getByText(/No reemplaza a los totales por moneda/)).toBeTruthy();
  });

  it('pct_ejecutado null se rotula, NO se muestra como 0%', async () => {
    render(<DireccionFinanzas token="t" />);
    expect(await screen.findByText('Gastado sin presupuesto asignado')).toBeTruthy();
    expect(screen.queryByText('0,0%')).toBeNull();
    expect(screen.queryByText('0%')).toBeNull();
  });

  it('MARKETING se abre por canal, con el canal vacío rotulado como techo del rubro', async () => {
    render(<DireccionFinanzas token="t" />);
    await screen.findByText('MARKETING por canal');
    expect(screen.getByText('META ADS')).toBeTruthy();
    expect(screen.getByText('Sin canal (techo del rubro)')).toBeTruthy();
  });

  it('copiar del mes anterior: dry_run primero, y recién "Confirmar" escribe', async () => {
    render(<DireccionFinanzas token="t" />);
    fireEvent.click(await screen.findByText('Copiar del mes anterior'));

    // ABRIR EL MODAL NO PIDE NADA (H-66). Hasta el PR de H-66 el dry_run
    // salía del montaje, así que abrir la pantalla -o volver a ella- mandaba
    // un POST que nadie pidió. Ahora el modal abre en blanco y la simulación
    // la pide un clic.
    expect(await screen.findByText(/Todavía no se corrió/)).toBeTruthy();
    expect(rutas.some((r) => r.includes('/copiar'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Simular la copia' }));

    // La previa llega con dry_run=true y se muestra la tabla propuesta.
    await waitFor(() => expect(screen.getByText(/Simulación: todavía no se escribió nada/)).toBeTruthy());
    expect(rutas.some((r) => r.startsWith('POST') && r.includes('/copiar') && r.includes('dry_run=true'))).toBe(true);
    expect(rutas.some((r) => r.includes('/copiar') && r.includes('dry_run=false'))).toBe(false);
    expect(screen.getByText('Se copia')).toBeTruthy();
    expect(screen.getByText('Ya existe: no se toca')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(rutas.some((r) => r.includes('/copiar') && r.includes('dry_run=false'))).toBe(true));
  });
});

describe('Gastos', () => {
  const abrirGastos = async () => {
    render(<DireccionFinanzas token="t" />);
    fireEvent.click(await screen.findByText('Gastos'));
    await screen.findByText(/Gastos de/);
  };

  it('el gasto anulado sigue visible, tachado y con su fecha de anulación', async () => {
    await abrirGastos();
    const fila = await screen.findByText('Línea vieja');
    expect(fila.className).toContain('line-through');
    expect(screen.getByText(/Anulado el 10\/09\/2026/)).toBeTruthy();
    // Y el vigente NO está tachado.
    expect(screen.getByText('OpenAI').className).not.toContain('line-through');
  });

  it('pide los anulados al backend: si no, desaparecerían de la lista', async () => {
    await abrirGastos();
    expect(rutas.some((r) => r.includes('/presupuesto/gastos?') && r.includes('incluir_anulados=true'))).toBe(true);
  });

  it('anular pide confirmación y manda DELETE (no borra: anula)', async () => {
    await abrirGastos();
    fireEvent.click(screen.getAllByText('Anular')[0]);
    expect(await screen.findByText(/queda listado tachado/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Anular').at(-1));
    await waitFor(() =>
      expect(rutas.some((r) => r.startsWith('DELETE') && r.includes('/presupuesto/gastos/g1'))).toBe(true));
  });

  it('generar recurrentes: dry_run, tabla propuesta, aviso de los ACTIVOS que quedan afuera, y confirmar', async () => {
    await abrirGastos();
    fireEvent.click(screen.getByText('Generar recurrentes del mes'));

    // Mismo criterio que "Copiar del mes anterior": abrir no pide nada.
    expect(await screen.findByText(/Todavía no se corrió/)).toBeTruthy();
    expect(rutas.some((r) => r.includes('generar-recurrentes'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Simular los recurrentes' }));

    await waitFor(() => expect(screen.getByText(/Simulación: todavía no se escribió nada/)).toBeTruthy());
    expect(rutas.some((r) => r.includes('generar-recurrentes') && r.includes('dry_run=true'))).toBe(true);
    expect(rutas.some((r) => r.includes('generar-recurrentes') && r.includes('dry_run=false'))).toBe(false);
    expect(screen.getAllByText('Render').length).toBeGreaterThan(0);
    expect(screen.getByText(/ya existe el gasto recurrente/)).toBeTruthy();

    // Dos proveedores ACTIVOS sin costo_mensual o sin rubro_presupuesto.
    expect(screen.getByText(/2 proveedor\(es\) ACTIVO\(s\) quedaron afuera/)).toBeTruthy();
    expect(screen.getByText(/Dirección > Proveedores/)).toBeTruthy();

    fireEvent.click(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(rutas.some((r) => r.includes('generar-recurrentes') && r.includes('dry_run=false'))).toBe(true));
  });

  it('los filtros viajan al backend como query', async () => {
    await abrirGastos();
    fireEvent.change(screen.getByLabelText('Origen') || screen.getAllByRole('combobox')[3], { target: { value: 'PROVEEDOR_RECURRENTE' } });
    await waitFor(() =>
      expect(rutas.some((r) => r.includes('origen=PROVEEDOR_RECURRENTE'))).toBe(true));
  });
});

describe('Comisiones liquidadas', () => {
  const abrirComisiones = async () => {
    render(<DireccionFinanzas token="t" />);
    fireEvent.click(await screen.findByText('Comisiones liquidadas'));
    await screen.findByText(/Comisiones liquidadas de/);
  };

  it('los totales van por moneda y la anulada no suma', async () => {
    await abrirComisiones();
    // Sólo la vigente en ARS (500.000), no la anulada de 80.000.
    expect(await screen.findByText('Liquidado ARS (vigente)')).toBeTruthy();
    expect(screen.getByText('Liquidado USD (vigente)')).toBeTruthy();
    expect(screen.getAllByText('ARS 500.000,00').length).toBeGreaterThan(0);
    expect(screen.queryByText('ARS 580.000,00')).toBeNull();
    // ARS + USD tampoco.
    expect(screen.queryByText(/501\.200/)).toBeNull();
  });

  it('la comisión anulada sigue visible, tachada y con su fecha', async () => {
    await abrirComisiones();
    const fila = await screen.findByText('Provincia');
    expect(fila.className).toContain('line-through');
    expect(screen.getByText(/Anulada el 11\/09\/2026/)).toBeTruthy();
  });

  it('el 409 por duplicado se muestra como mensaje claro, no como error crudo', async () => {
    await abrirComisiones();
    fireEvent.click(screen.getByText('Nueva comisión liquidada'));
    const form = screen.getByText('Cargar comisión').closest('form');
    fireEvent.change(form.querySelectorAll('input')[0], { target: { value: 'Galeno' } });
    fireEvent.change(form.querySelectorAll('input')[1], { target: { value: 'ART' } });
    fireEvent.submit(form);

    expect(await screen.findByText('Esa liquidación ya está cargada')).toBeTruthy();
    expect(screen.getByText(/Ya existe una comisión liquidada vigente \(c1\)/)).toBeTruthy();
    expect(screen.getByText(/anulá la que está cargada y volvé a cargarla/)).toBeTruthy();
    // Nada de "Error 409" crudo.
    expect(screen.queryByText(/^Error 409/)).toBeNull();
  });
});
