// @vitest-environment jsdom
//
// Tests del checklist de documentos ART (FORM_931/POLIZA_ACTUAL) -
// GET/POST/PATCH .../art/empresas/{cuit}/documentos (empresa_documento en
// app/models/crm/empresa_documento.py del backend). Mismo patrón que el
// resto de Cartera ART: fetch mockeado con la forma exacta del contrato.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtDocumentosChecklist from './ArtDocumentosChecklist';

afterEach(cleanup);

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const documentoBase = {
  id: 'doc-1', empresa_id: 'emp-1', archivo_drive_id: null, nombre_archivo: null,
  mime_type: null, conseguido: false, fecha_carga: null, subido_por: null,
  created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('ArtDocumentosChecklist', () => {
  it('carga el listado al montar y muestra "Pendiente" cuando no hay filas para un tipo', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse([]));

    const { container } = render(<ArtDocumentosChecklist token="tok" cuit="30-12345678-9" />);

    await waitFor(() => expect(container.textContent).toContain('Formulario 931'));
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos');
    expect(container.textContent.match(/Pendiente/g)).toHaveLength(2);
    expect(container.textContent).toContain('Subir archivo');
    expect(container.textContent).toContain('Marcar conseguido');
  });

  it('subir archivo: hace POST multipart con el tipo correcto y recarga el listado', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([])) // GET inicial
      .mockResolvedValueOnce(jsonResponse({ // POST
        ...documentoBase, tipo: 'POLIZA_ACTUAL', archivo_drive_id: 'drive-1',
        nombre_archivo: 'poliza.pdf', mime_type: 'application/pdf', conseguido: true,
      }, true, 201))
      .mockResolvedValueOnce(jsonResponse([{ // GET de recarga
        ...documentoBase, tipo: 'POLIZA_ACTUAL', archivo_drive_id: 'drive-1',
        nombre_archivo: 'poliza.pdf', mime_type: 'application/pdf', conseguido: true,
      }]));

    const { container, getAllByText } = render(<ArtDocumentosChecklist token="tok" cuit="30-12345678-9" />);
    await waitFor(() => expect(container.textContent).toContain('Póliza actual'));

    // Dos botones "Subir archivo" (uno por tipo) - el segundo es el de Póliza actual.
    const botonesSubir = getAllByText('Subir archivo');
    fireEvent.click(botonesSubir[1]);

    const archivo = new File(['contenido'], 'poliza.pdf', { type: 'application/pdf' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() => expect(container.textContent).toContain('poliza.pdf'));

    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    const [url, init] = globalThis.fetch.mock.calls[1];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos');
    expect(init.method).toBe('POST');
    expect(init.body.get('tipo')).toBe('POLIZA_ACTUAL');
    expect(init.body.get('archivo')).toBe(archivo);
  });

  it('marcar conseguido: hace PATCH sin archivo, recarga, y oculta el botón una vez conseguido', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse([])) // GET inicial
      .mockResolvedValueOnce(jsonResponse({ ...documentoBase, tipo: 'FORM_931', conseguido: true })) // PATCH
      .mockResolvedValueOnce(jsonResponse([{ ...documentoBase, tipo: 'FORM_931', conseguido: true }])); // GET de recarga

    const { container, getAllByText } = render(<ArtDocumentosChecklist token="tok" cuit="30-12345678-9" />);
    await waitFor(() => expect(container.textContent).toContain('Formulario 931'));

    const botonesMarcar = getAllByText('Marcar conseguido');
    fireEvent.click(botonesMarcar[0]);

    await waitFor(() => expect(container.textContent).toContain('Conseguido (sin archivo adjunto)'));

    const [url, init] = globalThis.fetch.mock.calls[1];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos/FORM_931/conseguido');
    expect(init.method).toBe('PATCH');
    // Ya conseguido -> no tiene sentido seguir ofreciendo "Marcar conseguido" para ese tipo.
    expect(getAllByText('Marcar conseguido')).toHaveLength(1);
  });

  it('propaga un error de la API sin romper el render', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(
      { detail: 'No existe una empresa con CUIT 30-12345678-9' }, false, 404,
    ));

    const { container } = render(<ArtDocumentosChecklist token="tok" cuit="30-12345678-9" />);

    await waitFor(() => expect(container.textContent).toContain('404'));
    expect(container.textContent).toContain('No existe una empresa con CUIT');
  });
});
