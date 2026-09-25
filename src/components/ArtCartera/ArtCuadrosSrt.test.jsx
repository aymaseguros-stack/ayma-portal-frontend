// @vitest-environment jsdom
//
// OPERACIONES-0010 paso 3 (backend PR #221): carga versionada de los
// Cuadros SRT desde la bandeja de CERVI, `version_cuadro` en Bloque 3 y en
// la ficha, el renglón del techo con cantidad 0 y el rótulo nuevo del
// Dashboard. Cubren: modal con diff, que el dry_run no escriba (una sola
// llamada, dry_run=true), 409 con su motivo y sin reintento, Confirmar gris.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import ArtCuadrosSrtModal from './ArtCuadrosSrtModal';
import ArtDotacionPropuestas from './ArtDotacionPropuestas';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';
import ArtEmpresaFicha from './ArtEmpresaFicha';
import TechoNoSumado from './TechoNoSumado';
import ResumenDireccion from '../Admin/ResumenDireccion';
import { codigosDelDiff, signado, textoVersionCuadros } from './artCuadrosSrtConstants';
import { CLAVE_ROL } from '../../utils/sesion';

afterEach(cleanup);

const TOKEN = 't';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => (status < 400 ? data : { detail: data }),
  clone: () => ({ json: async () => data }),
});

// Lo que devuelve el backend para el fixture de #221 (junio vs. mayo 2026).
const CARGA = (over = {}) => ({
  dry_run: true,
  escritura: false,
  version: '2026-06/REV4',
  periodo: '2026-06',
  revision: 'REV4',
  revision_origen: 'DEFAULT',
  titulo: 'Cuadro 1 ... Junio 2026',
  periodo_dato: '2026-05',
  masa_periodicidad: 'mensual',
  relacion_con_vigente: 'NUEVA',
  bloquearia_409: null,
  version_vigente_antes: { vigente: true, version: '2026-05/REV4', cantidad_ciiu: 3 },
  cantidad_ciiu: 3,
  cuadro_1: { filas_leidas: 3, ciiu: 3, descartadas: 0 },
  cuadro_2: { filas_leidas: 3, ciiu: 3, celdas: 30, sin_dato: 0, descartadas: 0 },
  advertencias: [],
  diff: {
    contra_version: '2026-05/REV4',
    umbral_salario_pct: '15',
    umbral_alicuota_pp: '1',
    ciiu_nuevos: { cantidad: 1, ciiu: ['014410'] },
    ciiu_desaparecen: { cantidad: 1, ciiu: ['471100'] },
    salario_cambia: {
      cantidad: 1,
      items: [{ ciiu: '011111', salario_vigente: '328116.35', salario_nuevo: '393739.62', variacion_pct: '20.00' }],
    },
    alicuota_tramo_cambia: {
      cantidad: 1,
      items: [{ ciiu: '011111', tramo: '1', alicuota_vigente: '9.00', alicuota_nueva: '10.50', diferencia_pp: '1.50' }],
    },
  },
  escritas: null,
  ...over,
});

const ESCRITAS = {
  cuadro_1_insertadas: 1, cuadro_1_actualizadas: 2, cuadro_1_borradas: 0,
  cuadro_2_insertadas: 10, cuadro_2_actualizadas: 20, cuadro_2_borradas: 0,
};

const CATALOGO = { '011111': 'Cultivo de arroz', '014410': 'Cría de ganado ovino', '471100': 'Venta en minimercados' };

// `carga` decide la respuesta de POST /carga según dry_run.
const mockCarga = ({ seca = CARGA(), firme } = {}) => {
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.pathname === '/api/v1/art/ciiu') {
      const q = u.searchParams.get('q');
      const items = CATALOGO[q] ? [{ codigo: q, descripcion: CATALOGO[q], seccion: 'A' }] : [];
      return respuesta({ total: items.length, items, limit: 5, truncado: false });
    }
    if (u.pathname === '/api/v1/art/cuadros-srt/carga' && (opts.method || 'GET') === 'POST') {
      if (u.searchParams.get('dry_run') === 'true') return typeof seca === 'function' ? seca() : respuesta(seca);
      return typeof firme === 'function' ? firme() : respuesta(firme || CARGA({ dry_run: false, escritura: true, escritas: ESCRITAS }));
    }
    return respuesta({ detail: `sin mock ${u.pathname}` }, 404);
  });
};

const cargas = () => globalThis.fetch.mock.calls.filter(([u]) => new URL(String(u)).pathname === '/api/v1/art/cuadros-srt/carga');

const xlsx = () => new File(['PK'], 'cuadros.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
const elegirXlsx = () => fireEvent.change(screen.getByLabelText('Archivo xlsx'), { target: { files: [xlsx()] } });

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
});

describe('helpers', () => {
  it('signado, códigos únicos del diff y texto de versión dd/mm/aaaa', () => {
    expect(signado('20.00')).toBe('+20');
    expect(signado('-1.5')).toBe('-1,5');
    expect(codigosDelDiff(CARGA().diff)).toEqual(['014410', '471100', '011111']);
    expect(codigosDelDiff(null)).toEqual([]);
    expect(textoVersionCuadros('2026-05/REV4', '2026-09-05T10:00:00')).toBe('Cuadros SRT: 2026-05/REV4 · cargado 05/09/2026');
    expect(textoVersionCuadros('2026-05/REV4')).toBe('Cuadros SRT: 2026-05/REV4');
    expect(textoVersionCuadros(null)).toBeNull();
  });
});

describe('Modal "Cargar nueva versión"', () => {
  it('Confirmar deshabilitado se ve gris antes de elegir archivo', () => {
    globalThis.fetch = vi.fn();
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    const boton = screen.getByTestId('cuadros-confirmar');
    expect(boton.disabled).toBe(true);
    expect(boton.className).toContain('bg-slate-600');
    expect(boton.className).toContain('cursor-not-allowed');
    expect(boton.className).not.toMatch(/green/);
  });

  it('dry_run: versión, cantidad de CIIU y el diff con sector, sin escribir', async () => {
    mockCarga();
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    elegirXlsx();
    const detectada = await screen.findByTestId('cuadros-version-detectada');
    expect(detectada.textContent).toContain('2026-06/REV4');
    expect(detectada.textContent).toContain('más nueva que la vigente (2026-05/REV4)');
    expect(screen.getByTestId('cuadros-cantidad-ciiu').textContent).toBe('3');

    expect(within(screen.getByTestId('diff-nuevos')).getByText('014410')).toBeTruthy();
    expect(within(screen.getByTestId('diff-desaparecen')).getByText('471100')).toBeTruthy();
    const sal = screen.getByTestId('diff-salario');
    expect(sal.textContent).toContain('$ 328.116');
    expect(sal.textContent).toContain('$ 393.740');
    expect(sal.textContent).toContain('+20 %');
    const ali = screen.getByTestId('diff-alicuota');
    expect(ali.textContent).toContain('9 %');
    expect(ali.textContent).toContain('10,5 %');
    expect(ali.textContent).toContain('+1,5 pp');
    await waitFor(() => expect(sal.textContent).toContain('Cultivo de arroz'));
    expect(screen.getByTestId('diff-nuevos').textContent).toContain('Cría de ganado ovino');

    // El dry_run NO escribe: una sola llamada, con dry_run=true.
    expect(cargas()).toHaveLength(1);
    expect(new URL(cargas()[0][0]).searchParams.get('dry_run')).toBe('true');
    expect(screen.getByTestId('cuadros-estado').textContent).toContain('no se escribió nada');
    const boton = screen.getByTestId('cuadros-confirmar');
    expect(boton.disabled).toBe(false);
    expect(boton.className).toContain('bg-green-600');
  });

  it('Confirmar carga manda dry_run=false con el mismo archivo y avisa', async () => {
    mockCarga();
    const onCargado = vi.fn();
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} onCargado={onCargado} />);
    elegirXlsx();
    await screen.findByTestId('cuadros-version-detectada');
    fireEvent.click(screen.getByTestId('cuadros-confirmar'));
    await screen.findByTestId('cuadros-escritas');
    expect(cargas()).toHaveLength(2);
    expect(new URL(cargas()[1][0]).searchParams.get('dry_run')).toBe('false');
    expect(cargas()[1][1].body.get('archivo').name).toBe('cuadros.xlsx');
    expect(onCargado).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('cuadros-estado').textContent).toContain('2026-06/REV4 queda como vigente');
  });

  it('409 en firme: muestra el motivo y no reintenta', async () => {
    mockCarga({ firme: () => respuesta('La versión 2026-04/REV4 es anterior a la vigente 2026-05/REV4', 409) });
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    elegirXlsx();
    await screen.findByTestId('cuadros-version-detectada');
    fireEvent.click(screen.getByTestId('cuadros-confirmar'));
    const error = await screen.findByTestId('cuadros-error');
    expect(error.textContent).toBe('Error 409: La versión 2026-04/REV4 es anterior a la vigente 2026-05/REV4');
    expect(cargas()).toHaveLength(2);
    const boton = screen.getByTestId('cuadros-confirmar');
    expect(boton.disabled).toBe(true);
    expect(boton.className).toContain('bg-slate-600');
  });

  it('bloquearia_409 en seco: motivo visible y Confirmar gris', async () => {
    mockCarga({ seca: CARGA({ relacion_con_vigente: 'ANTERIOR', bloquearia_409: 'La versión 2026-04/REV4 es anterior a la vigente', diff: null }) });
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    elegirXlsx();
    expect((await screen.findByTestId('cuadros-bloquearia')).textContent).toContain('anterior a la vigente');
    const boton = screen.getByTestId('cuadros-confirmar');
    expect(boton.disabled).toBe(true);
    expect(boton.className).not.toMatch(/green/);
    fireEvent.click(boton);
    expect(cargas()).toHaveLength(1);
  });

  it('422 del dry_run: motivo visible, sin reintento', async () => {
    mockCarga({ seca: () => respuesta('Falta la hoja del Cuadro 2', 422) });
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    elegirXlsx();
    expect((await screen.findByTestId('cuadros-error')).textContent).toBe('Error 422: Falta la hoja del Cuadro 2');
    expect(cargas()).toHaveLength(1);
    expect(screen.getByTestId('cuadros-confirmar').disabled).toBe(true);
  });

  it('primera carga (diff null) lo dice', async () => {
    mockCarga({ seca: CARGA({ diff: null, relacion_con_vigente: 'PRIMERA', version_vigente_antes: null }) });
    render(<ArtCuadrosSrtModal token={TOKEN} onCerrar={() => {}} />);
    elegirXlsx();
    expect(await screen.findByTestId('cuadros-sin-diff')).toBeTruthy();
  });
});

describe('Bandeja CERVI: encabezado de Cuadros SRT', () => {
  const mockBandeja = () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.pathname === '/api/v1/art/cuadros-srt/version') {
        return respuesta({ vigente: true, version: '2026-05/REV4', cargado_en: '2026-09-25T22:30:00', cantidad_ciiu: 948 });
      }
      if (u.pathname === '/api/v1/art/dotacion-propuestas') {
        return respuesta({ total: 0, items: [], por_revision: { lote: 0, individual: 0 }, version_cuadro_vigente: '2026-05/REV4' });
      }
      return respuesta({ total: 0, items: [] });
    });
  };

  it('ADMIN: versión con fecha de carga y botón que abre el modal', async () => {
    mockBandeja();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('cuadros-srt-version').textContent)
      .toBe('Cuadros SRT: 2026-05/REV4 · cargado 25/09/2026'));
    fireEvent.click(screen.getByRole('button', { name: 'Cargar nueva versión' }));
    expect(screen.getByLabelText('Archivo xlsx')).toBeTruthy();
  });

  it('no ADMIN: versión de la bandeja, sin botón y sin pedir /version', async () => {
    localStorage.setItem(CLAVE_ROL, 'EMPLEADO');
    mockBandeja();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('cuadros-srt-version').textContent).toBe('Cuadros SRT: 2026-05/REV4'));
    expect(screen.queryByRole('button', { name: 'Cargar nueva versión' })).toBeNull();
    const pedidos = globalThis.fetch.mock.calls.filter(([u]) => new URL(String(u)).pathname === '/api/v1/art/cuadros-srt/version');
    expect(pedidos).toHaveLength(0);
  });
});

describe('version_cuadro en Bloque 3 y en la ficha', () => {
  it('Bloque 3: el resumen muestra la versión de los Cuadros SRT', async () => {
    globalThis.fetch = vi.fn(async () => respuesta({
      total: 0, items: [], resumen: { cobertura_verificacion: 10, periodo_mercado: '2026-08', version_cuadro: '2026-05/REV4' },
    }));
    render(<ArtAccionComercialBoard token={TOKEN} />);
    expect(await screen.findByText(/Cuadros SRT 2026-05\/REV4/)).toBeTruthy();
  });

  it('ficha: junto a la masa efectiva', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.pathname.includes('/documentos')) return respuesta([]);
      if (u.pathname.includes('/propuestas')) return respuesta({ total: 0, items: [] });
      return respuesta({
        empresa: { id: 'emp-1', cuit: '30-71234567-9', razon_social: 'Acme SA', dotacion: 42 },
        aseguradoras: [], historial: [], historial_contratos: [], contrato_actual: null, calculo: null,
        f931_aplicado: null, masa_confianza: 'MEDIA', masa_efectiva_mensual: '5000000.00', masa_fuente: 'CUADRO1',
        masa_periodo: null, version_cuadro: '2026-05/REV4',
      });
    });
    render(<ArtEmpresaFicha token={TOKEN} cuit="30712345679" onVolver={() => {}} />);
    const bloque = await screen.findByTestId('ficha-masa-efectiva');
    expect(within(bloque).getByTestId('ficha-version-cuadro').textContent).toBe('Cuadros SRT 2026-05/REV4');
  });
});

describe('TechoNoSumado con cantidad 0', () => {
  it('con sin_comision > 0 se muestra, sin montos', () => {
    render(<TechoNoSumado techo={{ cantidad: 0, sin_comision: 68, suma_comision_actual: '0', suma_comision_oferta: '0' }} />);
    expect(screen.getByTestId('techo-no-sumado').textContent)
      .toBe('Techo no sumado (masa BAJA): 0 empresas · 68 sin dato (falta alícuota o masa)');
  });

  it('con cantidad 0 y sin_comision 0 no se muestra', () => {
    render(<TechoNoSumado techo={{ cantidad: 0, sin_comision: 0, suma_comision_actual: '0' }} />);
    expect(screen.queryByTestId('techo-no-sumado')).toBeNull();
  });
});

describe('Dashboard: rótulo de sin comisión estimable', () => {
  it('dice el universo y no el texto viejo', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({
      fecha: '2026-09-25',
      siniestros: { disponible: false, motivo: 'x' },
      art: {
        disponible: true, en_ventana_90d: 200, relevadas: 1, pendientes_relevar: 3,
        pedidas: 0, cotizadas: 0, ganadas: 0, dias_ventana: 90,
        comision_estimada_en_juego: '79450000', comision_etiqueta: 'ESTIMADA',
        empresas_sin_comision_estimable: 112,
      },
      comisiones: { disponible: false, motivo: 'x' },
      comercios: { disponible: false, motivo: 'x' },
    })));
    render(<ResumenDireccion token="t" />);
    const renglon = await screen.findByTestId('sin-comision-estimable');
    expect(renglon.textContent).toBe('112 empresas de la ventana sin comisión estimable (cualquier confianza, incluye sin CIIU)');
    expect(screen.queryByText(/no aportan comisión estimable/)).toBeNull();
  });
});
