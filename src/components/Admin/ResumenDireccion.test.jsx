// @vitest-environment jsdom
//
// Las cuatro tarjetas del resumen de Dirección en el Dashboard.
//
// LA REGLA QUE ESTOS TESTS PROTEGEN: `disponible: false` NUNCA se renderiza
// como 0. Cada tarjeta se prueba en los dos estados, y el caso del 0 falso
// se prueba explícitamente: si alguien "simplifica" el render a
// `{bloque.abiertos ?? 0}`, esto tiene que ponerse rojo.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ResumenDireccion from './ResumenDireccion';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const montar = (resumen, props = {}) => {
  globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(resumen)));
  return render(<ResumenDireccion token="t" {...props} />);
};

const CON_DATOS = {
  fecha: '2026-09-19',
  siniestros: {
    disponible: true, abiertos: 3, cerrados_30d: 5, cerrados_anio: 22,
    dias_del_mas_antiguo_abierto: 41,
  },
  art: {
    disponible: true, en_ventana_90d: 12, relevadas: 7, pendientes_relevar: 5,
    pedidas: 4, cotizadas: 2, ganadas: 1, dias_ventana: 90,
    comision_estimada_en_juego: '1234567.89', comision_etiqueta: 'ESTIMADA',
    empresas_sin_comision_estimable: 2,
  },
  comisiones: {
    disponible: true, periodo: '2026-09',
    estimada_mes: { disponible: true, por_moneda: { ARS: '1234567.89' } },
    liquidada_mes: { disponible: true, por_moneda: { ARS: '500000.00', USD: '1200.00' } },
  },
  comercios: {
    disponible: true, track: 'INTEGRAL',
    oportunidades_por_estado: { disponible: true, por_estado: { NUEVA: 4, GANADA: 1 } },
    polizas: { disponible: true, polizas_vigentes: 9, por_vencer_60d: 2 },
    locales_activos: 9,
  },
};

const SIN_DATOS = {
  fecha: '2026-09-19',
  siniestros: { disponible: false, motivo: 'No hay siniestros cargados' },
  art: { disponible: false, motivo: 'Ninguna empresa tiene historial SRT ni vigencia cargada' },
  comisiones: { disponible: false, motivo: 'Sin estimada y sin liquidada' },
  comercios: { disponible: false, motivo: 'Faltan las tablas `locales_comercio` / `oportunidades`' },
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('resumen de Dirección: disponible=true', () => {
  it('siniestros muestra abiertos, cerrados 30 días, cerrados en el año y días del más antiguo', async () => {
    montar(CON_DATOS);
    expect(await screen.findByText('Siniestros')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('22')).toBeTruthy();
    expect(screen.getByText('41 d')).toBeTruthy();
    expect(screen.getByText('Cerrados 30 días')).toBeTruthy();
    expect(screen.getByText('Cerrados en el año')).toBeTruthy();
  });

  it('ART muestra la ventana, relevadas/pendientes y la comisión ETIQUETADA como estimada', async () => {
    montar(CON_DATOS);
    expect(await screen.findByText('ART')).toBeTruthy();
    expect(screen.getByText('En ventana 90 días')).toBeTruthy();
    expect(screen.getByText('7 / 5')).toBeTruthy();
    expect(screen.getByText('Pedidas')).toBeTruthy();
    expect(screen.getByText('Cotizadas')).toBeTruthy();
    expect(screen.getByText('Ganadas')).toBeTruthy();
    // La etiqueta ESTIMADA tiene que estar VISIBLE junto al monto.
    expect(screen.getByText('ESTIMADA')).toBeTruthy();
    // El mismo monto sale también en "Estimada del mes" de la tarjeta de Comisiones.
    expect(screen.getAllByText('ARS 1.234.567,89').length).toBeGreaterThan(0);
  });

  it('comisiones muestra DOS números rotulados y por moneda, nunca sumados', async () => {
    montar(CON_DATOS);
    expect(await screen.findByText('Estimada del mes')).toBeTruthy();
    expect(screen.getByText('Liquidada del mes')).toBeTruthy();
    expect(screen.getByText('ARS 500.000,00')).toBeTruthy();
    expect(screen.getByText('USD 1.200,00')).toBeTruthy();
    // La suma de estimada + liquidada (1.734.567,89) NO puede aparecer en
    // ninguna parte, ni la de ARS + USD dentro de la liquidada (501.200,00).
    expect(screen.queryByText(/1\.734\.567,89/)).toBeNull();
    expect(screen.queryByText(/501\.200,00/)).toBeNull();
  });

  it('comercios muestra oportunidades por estado, vigentes y por vencer 60 días', async () => {
    montar(CON_DATOS);
    expect(await screen.findByText('Comercios')).toBeTruthy();
    expect(screen.getByText('Oportunidades por estado')).toBeTruthy();
    expect(screen.getByText('NUEVA')).toBeTruthy();
    expect(screen.getByText('Pólizas vigentes')).toBeTruthy();
    expect(screen.getByText('Por vencer 60 días')).toBeTruthy();
    expect(screen.getByText('9')).toBeTruthy();
  });
});

describe('resumen de Dirección: disponible=false', () => {
  it('las cuatro tarjetas dicen "Sin dato todavía" con el motivo del backend', async () => {
    montar(SIN_DATOS);
    await waitFor(() => expect(screen.getAllByText('Sin dato todavía')).toHaveLength(4));
    expect(screen.getByText('No hay siniestros cargados')).toBeTruthy();
    expect(screen.getByText(/Ninguna empresa tiene historial SRT/)).toBeTruthy();
    expect(screen.getByText('Sin estimada y sin liquidada')).toBeTruthy();
    expect(screen.getByText(/Faltan las tablas/)).toBeTruthy();
  });

  it('NUNCA renderiza un 0: un bloque sin dato no es un bloque en cero', async () => {
    const { container } = montar(SIN_DATOS);
    await waitFor(() => expect(screen.getAllByText('Sin dato todavía')).toHaveLength(4));
    expect(container.textContent).not.toMatch(/\b0\b/);
  });

  it('un bloque en 0 REAL sí muestra 0: 0 con disponible=true es información', async () => {
    montar({
      ...SIN_DATOS,
      siniestros: {
        disponible: true, abiertos: 0, cerrados_30d: 0, cerrados_anio: 0,
        dias_del_mas_antiguo_abierto: null,
      },
    });
    await waitFor(() => expect(screen.getAllByText('0').length).toBeGreaterThan(0));
    expect(screen.getByText('Ninguno abierto')).toBeTruthy();
  });

  it('la comisión estimada en juego en null no se pinta como 0', async () => {
    montar({
      ...SIN_DATOS,
      art: {
        disponible: true, en_ventana_90d: 4, relevadas: 1, pendientes_relevar: 3,
        pedidas: 0, cotizadas: 0, ganadas: 0, dias_ventana: 90,
        comision_estimada_en_juego: null, comision_etiqueta: 'ESTIMADA',
        empresas_sin_comision_estimable: 4,
      },
    });
    expect(await screen.findByText(/Ninguna empresa de la ventana tiene masa salarial/)).toBeTruthy();
    expect(screen.queryByText('ARS 0,00')).toBeNull();
  });

  it('un lado de comisiones sin dato no arrastra al otro', async () => {
    montar({
      ...SIN_DATOS,
      comisiones: {
        disponible: true, periodo: '2026-09',
        estimada_mes: { disponible: false, motivo: 'No hay insumos para estimar comisión' },
        liquidada_mes: { disponible: true, por_moneda: { ARS: '500000.00' } },
      },
    });
    expect(await screen.findByText('ARS 500.000,00')).toBeTruthy();
    expect(screen.getByText('No hay insumos para estimar comisión')).toBeTruthy();
  });
});

describe('navegación y errores', () => {
  it('cada tarjeta lleva a su pantalla', async () => {
    const irSiniestros = vi.fn(); const irArt = vi.fn();
    const irComisiones = vi.fn(); const irComercios = vi.fn();
    montar(CON_DATOS, {
      onIrSiniestros: irSiniestros, onIrUniversoArt: irArt,
      onIrComisiones: irComisiones, onIrComercios: irComercios,
    });
    fireEvent.click(await screen.findByLabelText(/^Siniestros\. Ir a Seguros > Siniestros$/));
    fireEvent.click(screen.getByLabelText(/^ART\. Ir a CRM > Empresas > Universo ART$/));
    fireEvent.click(screen.getByLabelText(/^Comisiones\. Ir a Dirección > Finanzas > Comisiones liquidadas$/));
    fireEvent.click(screen.getByLabelText(/^Comercios\./));
    expect(irSiniestros).toHaveBeenCalled();
    expect(irArt).toHaveBeenCalled();
    expect(irComisiones).toHaveBeenCalled();
    expect(irComercios).toHaveBeenCalled();
  });

  it('si el endpoint falla NO se pintan cuatro tarjetas en cero', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({ detail: 'No autorizado' }, 403)));
    const { container } = render(<ResumenDireccion token="t" />);
    expect(await screen.findByText(/No autorizado/)).toBeTruthy();
    expect(screen.queryByText('Siniestros')).toBeNull();
    expect(container.textContent).not.toMatch(/\b0\b/);
  });
});
