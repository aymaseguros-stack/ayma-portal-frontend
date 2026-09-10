// @vitest-environment jsdom
//
// Tests de render de la ficha de empresa (Pantalla B, /art/:cuit) para la
// sección de actividad + alícuota de referencia SRT (descripcion_actividad +
// alicuota_referencial) agregada a GET /art/empresas/{cuit} - ver
// app/api/v1/art_consultas.py::obtener_empresa_art del backend (PR #55), y
// para las secciones de "Contrato actual"/"Historial de contratos"
// (historial_contratos/contrato_actual, mismo endpoint) y el checklist de
// "Documentos" (GET /art/empresas/{cuit}/documentos, fetch propio de
// ArtDocumentosChecklist) y la lista de "Propuestas" (GET
// /art/empresas/{id}/propuestas, fetch propio de ArtPropuestasEmpresa) -
// por eso CADA test acá encadena TRES respuestas, aunque no le interesen
// esas secciones.
// Mismo patrón que ArtAnalisisBoard.test.jsx: fetch mockeado con la forma
// exacta del contrato.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtEmpresaFicha from './ArtEmpresaFicha';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const empresaBase = {
  cuit: '30-12345678-9',
  razon_social: 'Acme SA',
  nombre_fantasia: null,
  ciiu: '0114',
  provincia: 'Santa Fe',
  dotacion: 42,
  telefono: '3416952259',
  email: 'contacto@acme.com',
  riesgo_suscripcion: 'NORMAL',
  estrategia_art: null,
};

const detalleBase = {
  aseguradoras: [],
  historial: [],
  historial_contratos: [],
  contrato_actual: null,
  calculo: null,
  calculo_bloqueado_por: 'dotacion',
};

// Las tres respuestas que pide la ficha al montarse: GET
// /art/empresas/{cuit} (ArtEmpresaFicha), GET .../documentos
// (ArtDocumentosChecklist) y GET /art/empresas/{id}/propuestas
// (ArtPropuestasEmpresa). Documentos y propuestas van vacíos por default,
// salvo que el test pase los suyos.
//
// Se rutea por URL y no encadenando mockResolvedValueOnce: con tres
// componentes pidiendo en paralelo, el orden de las llamadas depende del
// orden de montaje en el árbol, así que mover una sección de lugar en la
// ficha le entregaba a un componente la respuesta de otro (y el error era
// un "documentos.find is not a function" a diez archivos de distancia).
const mockearFetchFicha = (detalle, documentos = [], propuestas = { total: 0, items: [] }) => {
  globalThis.fetch = vi.fn((url) => {
    if (String(url).includes('/documentos')) return Promise.resolve(jsonResponse(documentos));
    if (String(url).includes('/propuestas')) return Promise.resolve(jsonResponse(propuestas));
    return Promise.resolve(jsonResponse(detalle));
  });
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtEmpresaFicha - razón social según SRT (razon_social_srt)', () => {
  // Casos reales de empresas donde razon_social (nombre comercial cargado en
  // AYMA) difiere de razon_social_srt (nombre legal informado por la SRT,
  // GET /art/empresas/{cuit}) - la póliza se emite con el nombre de la SRT.
  it('South Convention Center SA (Hilton): razon_social_srt difiere de razon_social y se muestra en línea aparte', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        razon_social: 'Hilton Rosario',
        razon_social_srt: 'SOUTH CONVENTION CENTER SA',
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Razón social según SRT'));
    expect(container.textContent).toContain('SOUTH CONVENTION CENTER SA');
    expect(container.textContent).toContain('Es el nombre legal con el que se emite la póliza.');
  });

  it('Berca Hotelera (El Conquistador): también se muestra cuando difiere', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        razon_social: 'El Conquistador',
        razon_social_srt: 'BERCA HOTELERA',
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Razón social según SRT'));
    expect(container.textContent).toContain('BERCA HOTELERA');
  });

  it('Alpek Polyester (DAK Americas): también se muestra cuando difiere', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        razon_social: 'DAK Americas',
        razon_social_srt: 'ALPEK POLYESTER',
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Razón social según SRT'));
    expect(container.textContent).toContain('ALPEK POLYESTER');
  });

  it('razon_social_srt null: no renderiza la línea', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: { ...empresaBase, razon_social_srt: null },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Acme SA'));
    expect(container.textContent).not.toContain('Razón social según SRT');
  });

  it('razon_social_srt igual a razon_social: no renderiza la línea (no aporta información nueva)', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: { ...empresaBase, razon_social_srt: empresaBase.razon_social },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Acme SA'));
    expect(container.textContent).not.toContain('Razón social según SRT');
  });
});

describe('ArtEmpresaFicha - actividad y alícuota de referencia SRT', () => {
  it('con match vigente: muestra la actividad, suma fija + cuota variable parseadas y la leyenda de resolución', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        descripcion_actividad: 'Cultivo de arroz',
        alicuota_referencial: {
          suma_fija: '0.14',
          cuota_variable: '7.089',
          anio_calendario: 2025,
          resolucion: '23/2026',
        },
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Alícuota de referencia SRT'));
    expect(container.textContent).toContain('Cultivo de arroz');
    // Vienen como string desde el backend (Decimal serializado) - deben
    // parsearse a float antes de formatear, no concatenarse ni truncarse.
    expect(container.textContent).toContain('0,14');
    expect(container.textContent).toContain('7,089');
    expect(container.textContent).toContain('Res. 23/2026, año calendario 2025');
  });

  it('sin match vigente (alicuota_referencial null): no renderiza la sección aunque haya descripcion_actividad', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        descripcion_actividad: 'Cultivo de arroz',
        alicuota_referencial: null,
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Motor de cálculo'));
    expect(container.textContent).not.toContain('Alícuota de referencia SRT');
  });

  it('empresa sin CIIU cargado (descripcion_actividad y alicuota_referencial null): no renderiza la sección', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: {
        ...empresaBase,
        ciiu: null,
        descripcion_actividad: null,
        alicuota_referencial: null,
      },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Motor de cálculo'));
    expect(container.textContent).not.toContain('Alícuota de referencia SRT');
  });
});

describe('ArtEmpresaFicha - contrato actual e historial de contratos (historial_contratos/contrato_actual)', () => {
  it('contrato_actual presente: muestra aseguradora y fecha de inicio', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: empresaBase,
      contrato_actual: { aseguradora: 'BERKLEY ART', fecha_inicio: '2024-03-01' },
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Contrato actual'));
    expect(container.textContent).toContain('BERKLEY ART');
    expect(container.textContent).toContain('1/3/2024');
    expect(container.textContent).not.toContain('Sin cobertura vigente');
  });

  it('contrato_actual null: muestra "Sin cobertura vigente"', async () => {
    mockearFetchFicha({ ...detalleBase, empresa: empresaBase, contrato_actual: null });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Contrato actual'));
    expect(container.textContent).toContain('Sin cobertura vigente');
  });

  it('sin historial_contratos: la tabla muestra el estado vacío', async () => {
    mockearFetchFicha({ ...detalleBase, empresa: empresaBase, historial_contratos: [] });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Historial de contratos'));
    expect(container.textContent).toContain('Sin contratos registrados');
  });

  it('con historial_contratos: renderiza cada fila, prioriza aseguradora_normalizada y respeta el orden del backend', async () => {
    mockearFetchFicha({
      ...detalleBase,
      empresa: empresaBase,
      historial_contratos: [
        {
          aseguradora: 'BERKLEY INTERNATIONAL ART S.A.', aseguradora_normalizada: 'berkley',
          fecha_inicio: '2024-03-01', fecha_fin: null, motivo_baja: null,
        },
        {
          aseguradora: 'LIBERTY ART', aseguradora_normalizada: null,
          fecha_inicio: '2022-01-01', fecha_fin: '2024-02-28', motivo_baja: 'FALTA_DE_PAGO',
        },
      ],
    });

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Historial de contratos'));
    // aseguradora_normalizada matchea una de las 13 de AYMA -> etiqueta linda,
    // no el texto crudo de la SRT.
    expect(container.textContent).toContain('Berkley');
    expect(container.textContent).not.toContain('BERKLEY INTERNATIONAL ART S.A.');
    // Externa (sin match) -> se muestra el texto crudo tal cual, no se pierde.
    expect(container.textContent).toContain('LIBERTY ART');
    expect(container.textContent).toContain('FALTA_DE_PAGO');
    expect(container.textContent).not.toContain('Mostrar todos');
  });

  it('con más de 5 contratos: colapsa a los primeros 5 y expande al click', async () => {
    const contratos = Array.from({ length: 7 }, (_, i) => ({
      aseguradora: `ART ${i}`, aseguradora_normalizada: null,
      fecha_inicio: `2020-0${(i % 9) + 1}-01`, fecha_fin: null, motivo_baja: null,
    }));
    mockearFetchFicha({ ...detalleBase, empresa: empresaBase, historial_contratos: contratos });

    const { container, getByText } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Mostrar todos (7)'));
    expect(container.textContent).toContain('ART 4');
    expect(container.textContent).not.toContain('ART 5');

    fireEvent.click(getByText('Mostrar todos (7)'));

    expect(container.textContent).toContain('ART 5');
    expect(container.textContent).toContain('ART 6');
    expect(container.textContent).toContain('Mostrar menos');
  });
});

describe('ArtEmpresaFicha - checklist de documentos (ArtDocumentosChecklist)', () => {
  it('sin documentos subidos: ambos tipos figuran como pendientes', async () => {
    mockearFetchFicha({ ...detalleBase, empresa: empresaBase }, []);

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('Documentos'));
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));
    expect(container.textContent).toContain('Formulario 931');
    expect(container.textContent).toContain('Póliza actual');
    expect(container.textContent.match(/Pendiente/g)).toHaveLength(2);
  });

  it('con documentos: distingue "conseguido sin archivo" de "archivo subido"', async () => {
    mockearFetchFicha({ ...detalleBase, empresa: empresaBase }, [
      {
        id: 'doc-1', empresa_id: 'emp-1', tipo: 'FORM_931', archivo_drive_id: null,
        nombre_archivo: null, mime_type: null, conseguido: true, fecha_carga: null,
        subido_por: 'user-1', created_at: '2026-01-02T00:00:00', updated_at: '2026-01-02T00:00:00',
      },
      {
        id: 'doc-2', empresa_id: 'emp-1', tipo: 'POLIZA_ACTUAL', archivo_drive_id: 'drive-1',
        nombre_archivo: 'poliza.pdf', mime_type: 'application/pdf', conseguido: true,
        fecha_carga: '2026-01-01T00:00:00', subido_por: 'user-1',
        created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
      },
    ]);

    const { container } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" onVolver={() => {}} />);

    await waitFor(() => expect(container.textContent).toContain('poliza.pdf'));
    expect(container.textContent).toContain('Conseguido (sin archivo adjunto)');
    expect(container.textContent).not.toContain('Pendiente');
  });
});

// ---------------------------------------------------------------------------
// F.931 declarado y su baja (DELETE /art/empresas/{id}/f931)
// ---------------------------------------------------------------------------
//
// Por qué se puede quitar: el F.931 se carga a mano desde la grilla y a
// mano se equivoca (período viejo, masa de otra empresa, un dígito de más).
// Un dato declarado equivocado es PEOR que ninguno - deja la masa en
// confianza CONFIRMADA y con eso el backend habilita a ACEPTAR propuestas
// sobre un número inventado.
//
// La confirmación no es ceremonia: es la única acción destructiva de la
// ficha y el dato no está en ninguna otra pantalla para recuperarlo.
describe('ArtEmpresaFicha - F.931', () => {
  const conF931 = {
    ...detalleBase,
    empresa: {
      ...empresaBase,
      id: 'emp-1',
      masa_salarial_f931: '52000000.00',
      dotacion_f931: 45,
      f931_periodo: '2026-08',
      f931_cargado_en: '2026-09-01T12:00:00',
    },
  };

  it('sin F.931 cargado no ofrece quitarlo', async () => {
    mockearFetchFicha({ ...detalleBase, empresa: { ...empresaBase, id: 'emp-1' } });
    const { queryByText, findByText } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" />);

    await findByText('F.931 declarado');
    expect(queryByText('Quitar F.931')).toBeNull();
    expect(queryByText(/Sin F.931 cargado/)).toBeTruthy();
  });

  it('muestra el F.931 declarado con su período', async () => {
    mockearFetchFicha(conF931);
    const { findByText, getByText } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" />);

    await findByText('F.931 declarado');
    expect(getByText('$ 52.000.000')).toBeTruthy();
    expect(getByText('2026-08')).toBeTruthy();
    expect(getByText('Quitar F.931')).toBeTruthy();
  });

  it('pide confirmación ANTES de borrar y no llama al backend si se cancela', async () => {
    mockearFetchFicha(conF931);
    const { findByText, getByText, queryByText } = render(
      <ArtEmpresaFicha token="tok" cuit="30-12345678-9" />,
    );

    await findByText('Quitar F.931');
    const llamadasAntes = globalThis.fetch.mock.calls.length;
    fireEvent.click(getByText('Quitar F.931'));

    expect(getByText('¿Quitar el F.931 de esta empresa?')).toBeTruthy();
    fireEvent.click(getByText('Cancelar'));

    expect(queryByText('¿Quitar el F.931 de esta empresa?')).toBeNull();
    expect(globalThis.fetch.mock.calls.length).toBe(llamadasAntes);
  });

  it('confirmar manda DELETE con dry_run=false y recarga la ficha', async () => {
    mockearFetchFicha(conF931);
    const { findByText, getByText } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" />);

    await findByText('Quitar F.931');
    fireEvent.click(getByText('Quitar F.931'));
    fireEvent.click(getByText('Sí, quitar F.931'));

    await waitFor(() => {
      const baja = globalThis.fetch.mock.calls.find(([, opciones]) => opciones?.method === 'DELETE');
      expect(baja).toBeTruthy();
      // Va por `id` de empresa (no por CUIT) y con dry_run explícito en
      // false: el default del backend es la corrida en seco, así que
      // omitirlo devolvería 200 sin haber borrado nada.
      expect(String(baja[0])).toContain('/art/empresas/emp-1/f931');
      expect(String(baja[0])).toContain('dry_run=false');
    });
  });

  it('un 409 del backend se muestra y NO cierra el modal', async () => {
    globalThis.fetch = vi.fn((url, opciones) => {
      if (opciones?.method === 'DELETE') {
        return Promise.resolve({
          ok: false,
          status: 409,
          json: async () => ({ detail: 'La empresa no tiene F.931 cargado' }),
          text: async () => JSON.stringify({ detail: 'La empresa no tiene F.931 cargado' }),
        });
      }
      if (String(url).includes('/documentos')) return Promise.resolve(jsonResponse([]));
      if (String(url).includes('/propuestas')) {
        return Promise.resolve(jsonResponse({ total: 0, items: [] }));
      }
      return Promise.resolve(jsonResponse(conF931));
    });

    const { findByText, getByText } = render(<ArtEmpresaFicha token="tok" cuit="30-12345678-9" />);
    await findByText('Quitar F.931');
    fireEvent.click(getByText('Quitar F.931'));
    fireEvent.click(getByText('Sí, quitar F.931'));

    await waitFor(() => expect(getByText(/no tiene F.931 cargado/)).toBeTruthy());
    expect(getByText('¿Quitar el F.931 de esta empresa?')).toBeTruthy();
  });
});
