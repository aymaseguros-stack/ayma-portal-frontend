// @vitest-environment jsdom
//
// Tests de render de la ficha de empresa (Pantalla B, /art/:cuit) para la
// sección de actividad + alícuota de referencia SRT (descripcion_actividad +
// alicuota_referencial) agregada a GET /art/empresas/{cuit} - ver
// app/api/v1/art_consultas.py::obtener_empresa_art del backend (PR #55), y
// para las secciones de "Contrato actual"/"Historial de contratos"
// (historial_contratos/contrato_actual, mismo endpoint) y el checklist de
// "Documentos" (GET /art/empresas/{cuit}/documentos, fetch propio de
// ArtDocumentosChecklist - por eso CADA test acá encadena un segundo
// mockResolvedValueOnce, aunque no le interese esa sección).
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

// Encadena la respuesta de GET /art/empresas/{cuit} (1er fetch, disparado
// por ArtEmpresaFicha) con la de GET .../documentos (2do fetch, disparado
// por ArtDocumentosChecklist al montar) - por default una lista vacía,
// salvo que el test pase la suya.
const mockearFetchFicha = (detalle, documentos = []) => {
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce(jsonResponse(detalle))
    .mockResolvedValueOnce(jsonResponse(documentos));
};

beforeEach(() => {
  vi.restoreAllMocks();
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
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
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
