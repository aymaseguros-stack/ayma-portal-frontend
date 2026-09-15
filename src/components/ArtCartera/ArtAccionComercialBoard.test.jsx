// @vitest-environment jsdom
//
// Tests de la sub-pestaña "Acción comercial" (BLOQUE 3, paso 3) contra GET
// /art/accion-comercial/lista (app/api/v1/art_accion_comercial.py del
// backend, PR #135 ART-73/ART-72/ART-69 + PR #136 ART-76).
//
// Cubren, en orden: que las diez columnas salgan en el orden pedido; que el
// pedido lleve SÓLO parámetros que el endpoint conoce (ART-47: uno que no
// conoce es 422, no un filtro ignorado) con el orden `ventana_asc`; que
// `solo_elegibles` viaje al backend y no se filtre en el cliente; que la
// empresa no elegible SE VEA -atenuada, con motivo y fecha de
// habilitación-; que la alícuota de planilla salga marcada como no
// verificada y la de ventanilla como verificada; que la dotación histórica
// salga estimada, que la confianza y la sospecha de la dotación (ART-74)
// salgan de la fila y no se recalculen en el cliente; que OTRO_PRODUCTOR avise
// que es media comisión; que los dos motivos de compañía sugerida nula se
// distingan; y que el CSV se pida con Authorization y formato=csv.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtAccionComercialBoard from './ArtAccionComercialBoard';

afterEach(cleanup);

const TOKEN = 'token-de-prueba';

const fila = (over = {}) => ({
  empresa_id: 'e1',
  cuit: '30-71000001-7',
  razon_social: 'ACME SA',
  provincia: 'SANTA FE',
  telefono_principal: '3416952259',
  aseguradora_actual: 'asociart',
  fecha_vencimiento: '2026-10-15',
  dias_a_vencimiento: 31,
  dias_a_ventana: -59,
  dotacion: 40,
  dotacion_fuente: 'SRT',
  alicuota_actual: 8.5,
  alicuota_actual_fuente: 'SRT_VENTANILLA',
  alicuota_actual_verificada: true,
  alicuota_mercado_tramo: 6.1,
  delta_pp: 2.4,
  comision_actual_estimada: 120000,
  motivo_sin_comision_actual: null,
  compania_sugerida: 'plus',
  compania_sugerida_origen: 'MEDIANA_HISTORICA',
  motivo_sin_compania_sugerida: null,
  companias_descartadas_no_colocables: [],
  via_colocacion: 'PROPIO',
  elegible_traspaso: true,
  habilitado_desde: null,
  motivo_no_elegible: null,
  ...over,
});

const respuesta = (items) => ({
  total: items.length,
  items,
  resumen: {
    cobertura_verificacion: 28.75,
    periodo_mercado: '2026-08',
  },
});

const mockLista = (items) => {
  globalThis.fetch = vi.fn(async (url) => {
    if (String(url).includes('formato=csv')) {
      return { ok: true, status: 200, blob: async () => new Blob(['csv']) };
    }
    return { ok: true, status: 200, json: async () => respuesta(items) };
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
});

const urlDeLaLista = () => String(
  globalThis.fetch.mock.calls.find(([u]) => !String(u).includes('formato=csv'))[0],
);

describe('ArtAccionComercialBoard', () => {
  it('muestra las diez columnas en el orden pedido', async () => {
    mockLista([fila()]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    const encabezados = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(encabezados).toEqual([
      'Razón social', 'Vencimiento', 'Dotación', 'Alícuota actual', 'Alícuota mercado',
      'Delta pp', 'Comisión actual', 'Compañía sugerida', 'Vía', 'Teléfono',
    ]);
  });

  it('pide la lista con orden ventana_asc y sin parámetros que el endpoint no conoce', async () => {
    mockLista([fila()]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    const url = new URL(urlDeLaLista());
    expect(url.pathname).toBe('/api/v1/art/accion-comercial/lista');
    expect(url.searchParams.get('orden')).toBe('ventana_asc');
    // ART-47: todo nombre que viaje tiene que ser uno de PARAMS_LISTA.
    const validos = [
      'dias_ventana', 'tramo', 'provincia', 'aseguradora_actual',
      'solo_accionables', 'solo_cotizadas', 'solo_elegibles',
      'limit', 'offset', 'orden', 'formato',
    ];
    [...url.searchParams.keys()].forEach((k) => expect(validos).toContain(k));
  });

  it('solo_elegibles viaja al endpoint, no filtra en el cliente', async () => {
    mockLista([fila()]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    fireEvent.click(screen.getByLabelText('Solo elegibles para traspaso'));

    await waitFor(() => {
      const urls = globalThis.fetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes('solo_elegibles=true'))).toBe(true);
    });
  });

  it('el filtro de vencimiento mueve dias_ventana', async () => {
    mockLista([fila()]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    fireEvent.change(screen.getByLabelText('Vencimiento'), { target: { value: '30' } });

    await waitFor(() => {
      const urls = globalThis.fetch.mock.calls.map(([u]) => String(u));
      expect(urls.some((u) => u.includes('dias_ventana=30'))).toBe(true);
    });
  });

  it('la empresa no elegible se ve atenuada, con motivo y fecha de habilitación', async () => {
    mockLista([fila({
      elegible_traspaso: false,
      motivo_no_elegible: 'PERMANENCIA_12M',
      habilitado_desde: '2027-02-01',
    })]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    const nombre = await screen.findByText('ACME SA');

    // NO se oculta: el usuario tiene que ver que existe y por qué no se toca.
    const badge = screen.getByText(/No elegible/);
    expect(badge.textContent).toContain('Permanencia mínima 12 meses');
    expect(badge.textContent).toMatch(/2027/);
    expect(nombre.closest('tr').className).toContain('opacity-50');
  });

  it('distingue la alícuota verificada de la de planilla', async () => {
    mockLista([
      fila(),
      fila({
        empresa_id: 'e2',
        razon_social: 'REFRIGERACION COMERCIAL',
        alicuota_actual: 10.95,
        alicuota_actual_fuente: 'PLANILLA',
        alicuota_actual_verificada: false,
      }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('REFRIGERACION COMERCIAL');

    expect(screen.getByText(/✓ verificada · SRT_VENTANILLA/)).toBeTruthy();
    expect(screen.getByText(/⚠ no verificada · PLANILLA/)).toBeTruthy();
  });

  it('marca la dotación histórica como estimada', async () => {
    mockLista([
      fila({ dotacion: 120, dotacion_fuente: 'PLANILLA_HISTORICA', dotacion_confianza: 'BAJA' }),
      fila({ empresa_id: 'e3', razon_social: 'MEDIDA SA', dotacion: 8000, dotacion_fuente: 'SRT' }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('MEDIDA SA');

    expect(screen.getAllByText('estimada')).toHaveLength(1);
    expect(screen.getByText('MEDIDA SA').closest('tr').textContent).not.toContain('estimada');
  });

  // ART-74: la confianza del origen la manda el backend. La pantalla la
  // muestra tal cual y, si viene null, no muestra NADA (no inventa un nivel).
  it('muestra la confianza de la dotación y no inventa señal cuando viene null', async () => {
    mockLista([
      fila({ dotacion_confianza: 'ALTA' }),
      fila({ empresa_id: 'e2', razon_social: 'MEDIA SA', dotacion_confianza: 'MEDIA' }),
      fila({ empresa_id: 'e3', razon_social: 'BAJA SA', dotacion_confianza: 'BAJA' }),
      fila({ empresa_id: 'e4', razon_social: 'SIN CONFIANZA SA', dotacion_confianza: null }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('SIN CONFIANZA SA');

    expect(screen.getByText('confianza ALTA')).toBeTruthy();
    expect(screen.getByText('confianza MEDIA')).toBeTruthy();
    expect(screen.getByText('confianza BAJA')).toBeTruthy();
    expect(screen.getByText('SIN CONFIANZA SA').closest('tr').textContent).not.toContain('confianza');
  });

  // ART-74: `dotacion_sospechosa` la decide el backend; la pantalla NO
  // vuelve a comparar contra 5.000 ni oculta la fila.
  it('marca la dotación sospechosa sólo cuando el backend lo dice', async () => {
    mockLista([
      fila({ empresa_id: 'e1', razon_social: 'EPE', dotacion: 32000, dotacion_sospechosa: true }),
      fila({ empresa_id: 'e2', razon_social: 'CHICA SA', dotacion: 9000, dotacion_sospechosa: false }),
      fila({ empresa_id: 'e3', razon_social: 'SIN DOTACION SA', dotacion: null, dotacion_sospechosa: true }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('EPE');

    expect(screen.getAllByTitle('Dotación >5.000 — verificar contra F931')).toHaveLength(1);
    expect(screen.getByText('CHICA SA').closest('tr').textContent).not.toContain('⚠');
    // Sin dotación no hay número que marcar, aunque la bandera venga true.
    expect(screen.getByText('SIN DOTACION SA').closest('tr').textContent).not.toContain('⚠');
  });

  it('avisa que OTRO_PRODUCTOR es media comisión', async () => {
    mockLista([fila({ via_colocacion: 'OTRO_PRODUCTOR' })]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    expect(screen.getByText(/OTRO PRODUCTOR · media comisión/)).toBeTruthy();
  });

  it('distingue SIN_COMPANIA_SUGERIDA de SIN_COMPANIA_COLOCABLE', async () => {
    mockLista([
      fila({ compania_sugerida: null, motivo_sin_compania_sugerida: 'SIN_COMPANIA_SUGERIDA' }),
      fila({
        empresa_id: 'e2',
        razon_social: 'BLOQUEADA SA',
        compania_sugerida: null,
        motivo_sin_compania_sugerida: 'SIN_COMPANIA_COLOCABLE',
      }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('BLOQUEADA SA');

    expect(screen.getByText('Sin evidencia')).toBeTruthy();
    expect(screen.getByText('Ninguna colocable')).toBeTruthy();
  });

  it('el filtro de fuente de alícuota y el de teléfono se aplican sobre las filas traídas', async () => {
    mockLista([
      fila(),
      fila({
        empresa_id: 'e2',
        razon_social: 'DE PLANILLA SA',
        alicuota_actual_fuente: 'PLANILLA',
        alicuota_actual_verificada: false,
        telefono_principal: null,
      }),
    ]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('DE PLANILLA SA');
    const pedidosIniciales = globalThis.fetch.mock.calls.length;

    fireEvent.change(screen.getByLabelText('Fuente de la alícuota actual'), {
      target: { value: 'SRT_VENTANILLA' },
    });

    expect(screen.queryByText('DE PLANILLA SA')).toBeNull();
    expect(screen.getByText('ACME SA')).toBeTruthy();
    // No hay parámetro para esto en el endpoint: no se vuelve a pedir.
    expect(globalThis.fetch.mock.calls.length).toBe(pedidosIniciales);

    fireEvent.change(screen.getByLabelText('Fuente de la alícuota actual'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: 'sin' } });
    expect(screen.getByText('DE PLANILLA SA')).toBeTruthy();
    expect(screen.queryByText('ACME SA')).toBeNull();
  });

  it('el CSV se pide con Authorization y formato=csv, no como link plano', async () => {
    mockLista([fila()]);
    render(<ArtAccionComercialBoard token={TOKEN} />);
    await screen.findByText('ACME SA');

    fireEvent.click(screen.getByRole('button', { name: /CSV/ }));

    await waitFor(() => {
      const llamada = globalThis.fetch.mock.calls.find(([u]) => String(u).includes('formato=csv'));
      expect(llamada).toBeTruthy();
      expect(llamada[1].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    });
  });
});
