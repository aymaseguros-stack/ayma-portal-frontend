// @vitest-environment jsdom
//
// OPERACIONES-0010 · @VALENTINI (backend PR #216): subida del F.931 en PDF
// desde la ficha, solapa "F931" de la bandeja "Dotación propuesta" y la
// métrica del encabezado. Cubren: el dry_run muestra lo leído y las
// validaciones una por una; "Confirmar" llama con dry_run=false; el 422
// PDF_SIN_TEXTO y el 409 muestran su mensaje y NO se reintentan; la solapa
// lista y exige motivo; un 409 al aceptar deja el motivo y saca el botón;
// la métrica renderiza.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import ArtF931PdfModal from './ArtF931PdfModal';
import ArtF931Propuestas from './ArtF931Propuestas';
import ArtDotacionPropuestas from './ArtDotacionPropuestas';
import ArtEmpresaFicha from './ArtEmpresaFicha';
import { chequeosF931, mensajeErrorF931, motivosDeFila, periodoF931 } from './artF931Constants';
import { CLAVE_ROL } from '../../utils/sesion';

afterEach(cleanup);

const TOKEN = 't';
const CUIT = '30712345679';

const INGESTA = (over = {}) => ({
  escritura: false,
  dry_run: true,
  empresa_id: 'emp-demo',
  razon_social: 'METALURGICA DEMO S.A.',
  pdf_sha256: 'abc',
  f931_id: null,
  extraido: {
    cuit: CUIT, periodo: '2026-08-01', rectificativa: 0,
    dotacion_f931: 14, dotacion_etiqueta: 'cantidad de cuiles con art',
    masa_f931: '19600000.00', masa_etiqueta: 'remun. con art',
    lrt_fijo: '1050.00', lrt_variable: '411600.00', lrt_total: '412650.00',
    alicuota_variable_f931: '2.1000',
  },
  validacion: {
    valida: true, estado: 'APLICADO', motivos: [],
    evidencia: {
      meses_antiguedad: 1, version_cuadro: '2026-04/REV4', ciiu: '251100',
      salario_promedio_ciiu: '1250000.00', salario_f931: '1400000.00', ratio: '1.1200', aplicado_posterior: null,
    },
  },
  antes: { dotacion: 180, dotacion_fuente: 'PLANILLA_HISTORICA', dotacion_confianza_lectura: 'BAJA', masa_estimada_lectura: '225000000.00' },
  despues: { dotacion: 14, dotacion_fuente: 'F931', dotacion_confianza_lectura: 'ALTA', masa_estimada_lectura: '17500000.00', f931_periodo: '2026-08' },
  ...over,
});

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => (status < 400 ? data : { detail: data }),
});

const pdf = () => new File(['%PDF-1.4'], 'f931.pdf', { type: 'application/pdf' });

const elegirPdf = () => fireEvent.change(screen.getByLabelText('Archivo PDF'), { target: { files: [pdf()] } });

const llamadasPdf = () => globalThis.fetch.mock.calls.filter(([u]) => String(u).includes('/f931/pdf'));

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  localStorage.setItem(CLAVE_ROL, 'ADMIN');
});

describe('helpers', () => {
  it('chequeos: cada validación OK o con su motivo', () => {
    const c = chequeosF931(['PERIODO_VENCIDO', 'SALARIO_FUERA_DE_RANGO']);
    expect(c.find((x) => x.clave === 'cuit').ok).toBe(true);
    expect(c.find((x) => x.clave === 'periodo').fallados).toEqual(['PERIODO_VENCIDO']);
    expect(c.find((x) => x.clave === 'salario').ok).toBe(false);
  });
  it('periodo mm/aaaa y motivos de la fila', () => {
    expect(periodoF931('2026-08-01')).toBe('08/2026');
    expect(periodoF931('2026-08')).toBe('08/2026');
    expect(motivosDeFila({ motivo_validacion: 'PERIODO_VENCIDO · RECTIFICATIVA' })).toEqual(['PERIODO_VENCIDO', 'RECTIFICATIVA']);
  });
  it('mensajes de error: PDF_SIN_TEXTO y MISMO_PDF', () => {
    expect(mensajeErrorF931({ status: 422, detail: { motivo: 'PDF_SIN_TEXTO', mensaje: 'x' } }))
      .toBe('El PDF es una imagen/escaneo. Subí el F931 descargado de ARCA.');
    expect(mensajeErrorF931({ status: 409, detail: { causa: 'MISMO_PDF', mensaje: 'Este PDF ya está cargado (F.931 2026-08).' } }))
      .toContain('Este F931 ya está cargado.');
  });
});

describe('Subir F931 (PDF)', () => {
  it('elegir el archivo llama SÓLO al dry_run y muestra lo leído y las validaciones', async () => {
    globalThis.fetch = vi.fn(async () => respuesta(INGESTA()));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} razonSocial="DEMO" onClose={() => {}} />);
    elegirPdf();
    await screen.findByTestId('f931-estado-previo');

    expect(llamadasPdf()).toHaveLength(1);
    const [url, opts] = llamadasPdf()[0];
    expect(new URL(url).searchParams.get('dry_run')).toBe('true');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.get('archivo')).toBeTruthy();

    expect(screen.getByTestId('f931-cuit').textContent).toContain(CUIT);
    expect(screen.getByTestId('f931-periodo').textContent).toContain('08/2026');
    expect(screen.getByTestId('f931-dotacion').textContent).toContain('14');
    expect(screen.getByTestId('f931-masa').textContent).toContain('$ 19.600.000');
    expect(screen.getByTestId('f931-alicuota').textContent).toContain('2,10 %');
    expect(within(screen.getByTestId('f931-validaciones')).getAllByText('OK')).toHaveLength(6);
    expect(screen.getByTestId('f931-estado-previo').textContent).toContain('APLICADO');
  });

  it('un dry_run que no valida muestra el motivo de cada validación y PROPUESTO', async () => {
    globalThis.fetch = vi.fn(async () => respuesta(INGESTA({
      validacion: { valida: false, estado: 'PROPUESTO', motivos: ['PERIODO_VENCIDO'], evidencia: { meses_antiguedad: 9 } },
    })));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} onClose={() => {}} />);
    elegirPdf();
    await screen.findByTestId('f931-estado-previo');
    const periodo = screen.getByTestId('f931-chequeo-periodo');
    expect(periodo.textContent).toContain('NO');
    expect(periodo.textContent).toContain('Período de más de 6 meses');
    expect(screen.getByTestId('f931-estado-previo').textContent).toContain('PROPUESTO');
  });

  it('Confirmar llama con dry_run=false y muestra el estado final', async () => {
    const onGrabado = vi.fn();
    globalThis.fetch = vi.fn(async (u) => (
      new URL(u).searchParams.get('dry_run') === 'false'
        ? respuesta(INGESTA({ dry_run: false, escritura: true, f931_id: 7 }))
        : respuesta(INGESTA())
    ));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} onClose={() => {}} onGrabado={onGrabado} />);
    elegirPdf();
    await screen.findByTestId('f931-estado-previo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    const final = await screen.findByTestId('f931-estado-final');

    expect(llamadasPdf().map(([u]) => new URL(u).searchParams.get('dry_run'))).toEqual(['true', 'false']);
    expect(final.textContent).toContain('APLICADO');
    expect(final.textContent).toContain('#7');
    expect(onGrabado).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Confirmar' })).toBeNull();
  });

  it('422 PDF_SIN_TEXTO: mensaje claro, sin reintento y sin Confirmar habilitado', async () => {
    globalThis.fetch = vi.fn(async () => respuesta({ motivo: 'PDF_SIN_TEXTO', mensaje: 'sin capa de texto', campos_faltantes: [] }, 422));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} onClose={() => {}} />);
    elegirPdf();
    const alerta = await screen.findByTestId('f931-error');
    expect(alerta.textContent).toBe('El PDF es una imagen/escaneo. Subí el F931 descargado de ARCA.');
    await new Promise((r) => setTimeout(r, 20));
    expect(llamadasPdf()).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(true);
  });

  it('409 al confirmar: muestra el motivo del backend y no reintenta', async () => {
    globalThis.fetch = vi.fn(async (u) => (
      new URL(u).searchParams.get('dry_run') === 'false'
        ? respuesta({ causa: 'MISMO_PDF', mensaje: 'Este PDF ya está cargado (F.931 2026-08, rectificativa 0, estado APLICADO).' }, 409)
        : respuesta(INGESTA())
    ));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} onClose={() => {}} />);
    elegirPdf();
    await screen.findByTestId('f931-estado-previo');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    const alerta = await screen.findByTestId('f931-error');
    expect(alerta.textContent).toContain('Este F931 ya está cargado.');
    expect(alerta.textContent).toContain('estado APLICADO');
    await new Promise((r) => setTimeout(r, 20));
    expect(llamadasPdf()).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Confirmar' }).disabled).toBe(true);
  });

  it('409 RECTIFICATIVA_NO_POSTERIOR muestra el mensaje del backend', async () => {
    globalThis.fetch = vi.fn(async () => respuesta({ causa: 'RECTIFICATIVA_NO_POSTERIOR', mensaje: 'Sólo entra una rectificativa MAYOR.' }, 409));
    render(<ArtF931PdfModal token={TOKEN} cuit={CUIT} onClose={() => {}} />);
    elegirPdf();
    expect((await screen.findByTestId('f931-error')).textContent).toBe('Sólo entra una rectificativa MAYOR.');
  });
});

const FILA = (over = {}) => ({
  id: 5, empresa_id: 'e5', razon_social: 'BONPOINT SA', cuit: CUIT, periodo: '2026-01-01',
  dotacion_f931: 14, masa_f931: '19600000.00', rectificativa: 0,
  lrt_fijo: null, lrt_variable: '411600.00', lrt_total: null, alicuota_variable_f931: '2.1000',
  pdf_sha256: 'x', estado: 'PROPUESTO', motivo_validacion: 'PERIODO_VENCIDO', evidencia: {},
  registrado_por: 'admin@ayma.com.ar', created_at: '2026-09-25T10:00:00',
  ...over,
});

describe('Solapa F931', () => {
  it('lista con período, motivo y alícuota; aceptar exige motivo y lo manda', async () => {
    const onCambio = vi.fn();
    globalThis.fetch = vi.fn(async () => respuesta({ propuesta: FILA({ estado: 'APLICADO' }) }));
    render(<ArtF931Propuestas token={TOKEN} filas={[FILA()]} loading={false} esAdmin onCambio={onCambio} />);
    const fila = screen.getByTestId('f931-propuesta-5');
    expect(fila.textContent).toContain('01/2026');
    expect(fila.textContent).toContain('Período de más de 6 meses');
    expect(fila.textContent).toContain('2,10 %');
    expect(fila.textContent).toContain('$ 19.600.000');

    fireEvent.click(within(fila).getByRole('button', { name: 'Aceptar' }));
    const form = screen.getByRole('form', { name: 'Aceptar F931' });
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toContain('obligatorio');
    expect(globalThis.fetch).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Motivo (obligatorio)'), { target: { value: 'PDF revisado a mano' } });
    fireEvent.submit(form);
    await waitFor(() => expect(onCambio).toHaveBeenCalled());
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/v1/art/f931/propuestas/5/aceptar');
    expect(JSON.parse(opts.body)).toEqual({ motivo: 'PDF revisado a mano' });
  });

  it('rechazar también exige motivo', async () => {
    globalThis.fetch = vi.fn(async () => respuesta({ propuesta: FILA({ estado: 'RECHAZADO' }) }));
    render(<ArtF931Propuestas token={TOKEN} filas={[FILA()]} loading={false} esAdmin />);
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const form = screen.getByRole('form', { name: 'Rechazar F931' });
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toContain('obligatorio');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Motivo (obligatorio)'), { target: { value: 'Es de otra empresa' } });
    fireEvent.submit(form);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(1));
    expect(new URL(globalThis.fetch.mock.calls[0][0]).pathname).toBe('/api/v1/art/f931/propuestas/5/rechazar');
  });

  it('una no aceptable (CUIT distinto) muestra el motivo y no ofrece Aceptar', () => {
    render(<ArtF931Propuestas token={TOKEN} filas={[FILA({ motivo_validacion: 'CUIT_DISTINTO' })]} loading={false} esAdmin />);
    const fila = screen.getByTestId('f931-propuesta-5');
    expect(within(fila).queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(within(fila).getByTestId('f931-no-aceptable').textContent).toContain('El CUIT del PDF no es el de la empresa');
    expect(within(fila).getByRole('button', { name: 'Rechazar' })).toBeTruthy();
  });

  it('409 al aceptar: queda el motivo del backend, sale el botón y no reintenta', async () => {
    globalThis.fetch = vi.fn(async () => respuesta({ mensaje: 'Este F.931 no se puede aplicar: SUPERADO', motivos: ['SUPERADO'] }, 409));
    render(<ArtF931Propuestas token={TOKEN} filas={[FILA()]} loading={false} esAdmin />);
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar' }));
    fireEvent.change(screen.getByLabelText('Motivo (obligatorio)'), { target: { value: 'Revisado' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Aceptar F931' }));
    const conf = await screen.findByTestId('f931-conflicto');
    expect(conf.textContent).toContain('Este F.931 no se puede aplicar: SUPERADO');
    expect(screen.queryByRole('button', { name: 'Aceptar' })).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('Bandeja: solapa F931 y métrica', () => {
  const mockBandeja = () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.pathname === '/api/v1/art/workers/cervi/metrica') {
        return respuesta({
          ventana_40: { total: 40, medias_o_mas: 12 }, bloque3_pct_comision_sobre_media: '0.44',
          bloque3_comision_total: '1000', bloque3_comision_media_o_mas: '314.7', bloque3_empresas: 180,
          empresas_dotacion_alta: 23, f931_cargados: 1234, f931_por_estado: { APLICADO: 20, PROPUESTO: 1 },
        });
      }
      if (u.pathname === '/api/v1/art/f931/propuestas') return respuesta({ total: 1, limit: 500, offset: 0, items: [FILA()] });
      if (u.pathname === '/api/v1/art/dotacion-propuestas') return respuesta({ total: 0, items: [], limit: 100, offset: 0, por_revision: { lote: 0, individual: 0 } });
      if (u.pathname === '/api/v1/art/workers/cervi/ciiu-sin-cuadro') return respuesta({ origen: 'CORRIDA', total_ciius: 0, total_empresas: 0, items: [] });
      return respuesta({ detail: 'sin mock' }, 404);
    });
  };

  it('la métrica renderiza Dotación ALTA y F931 cargados', async () => {
    mockBandeja();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    await waitFor(() => expect(screen.getByTestId('metrica-f931').textContent).toBe('Dotación ALTA: 23 · F931 cargados: 1.234'));
  });

  it('la solapa F931 cuenta y lista las propuestas', async () => {
    mockBandeja();
    render(<ArtDotacionPropuestas token={TOKEN} />);
    const solapa = await screen.findByRole('button', { name: 'F931 (1)' });
    fireEvent.click(solapa);
    expect((await screen.findByTestId('f931-propuesta-5')).textContent).toContain('BONPOINT SA');
    const llamada = globalThis.fetch.mock.calls.find(([u]) => new URL(String(u)).pathname === '/api/v1/art/f931/propuestas');
    expect(new URL(llamada[0]).searchParams.get('estado')).toBe('PROPUESTO');
  });
});

describe('Ficha: F931 aplicado', () => {
  it('muestra ALTA · F931 con período, dotación, masa y alícuota variable; y el botón de subida', async () => {
    globalThis.fetch = vi.fn(async (url) => {
      const u = new URL(String(url));
      if (u.pathname === '/api/v1/art/f931/propuestas') {
        return respuesta({ total: 1, limit: 500, offset: 0, items: [FILA({ id: 9, empresa_id: 'emp-1', estado: 'APLICADO', motivo_validacion: null })] });
      }
      if (u.pathname.includes('/documentos')) return respuesta([]);
      if (u.pathname.includes('/propuestas')) return respuesta({ total: 0, items: [] });
      return respuesta({
        empresa: {
          id: 'emp-1', cuit: '30-71234567-9', razon_social: 'Acme SA', dotacion: 42,
          masa_salarial_f931: '19600000.00', dotacion_f931: 14, f931_periodo: '2026-08', f931_cargado_en: '2026-09-25T10:00:00',
        },
        aseguradoras: [], historial: [], historial_contratos: [], contrato_actual: null, calculo: null,
      });
    });
    render(<ArtEmpresaFicha token={TOKEN} cuit="30712345679" onVolver={() => {}} />);
    const bloque = await screen.findByTestId('ficha-f931');
    expect(screen.getByTestId('ficha-f931-alta').textContent).toBe('ALTA · F931 · 08/2026');
    expect(bloque.textContent).toContain('14');
    expect(bloque.textContent).toContain('$ 19.600.000');
    await waitFor(() => expect(bloque.textContent).toContain('2,10 %'));
    expect(screen.getByRole('button', { name: 'Subir F931 (PDF)' })).toBeTruthy();
  });
});
