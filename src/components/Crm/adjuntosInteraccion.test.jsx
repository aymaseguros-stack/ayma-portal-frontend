// @vitest-environment jsdom
//
// Adjuntos de "Registrar interacción" en la ficha de oportunidad: subida
// válida, interacción guardada con subida fallida + reintento, y la pestaña
// Documentos con su anulación.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import OportunidadFichaModal from './OportunidadFichaModal';

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const archivoPdf = (nombre) =>
  new File([new Uint8Array([...PDF, 0, 0, 0])], nombre, { type: 'application/pdf' });

const DETALLE = {
  id: 'o-1', token: 'OP-1', persona_id: 'p-1', empresa_id: null, grupo_id: null,
  track: 'ART', estado_crm: 'DATO', resultado: 'EN_CURSO', nombre_vinculado: 'Ana Díaz',
  prima_estimada: 1000, adjuntos_count: 1, interacciones: [], tareas: [],
};

let llamadas;
let subidaFalla;
let adjuntos;

const json = (data, status = 200) => Promise.resolve({
  ok: status < 400, status, json: async () => data, blob: async () => new Blob(['x']),
});

beforeEach(() => {
  llamadas = [];
  subidaFalla = false;
  adjuntos = [{
    id: 'ad-1', interaccion_id: 'i-1', nombre_original: 'f931.pdf', mime: 'application/pdf',
    tamano_bytes: 1024, categoria: 'F931', subido_por: 'u-1', creado_en: '2026-09-01T10:00:00',
    anulado_en: null,
  }];
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    llamadas.push({ url, metodo, body: opts.body });

    if (url.includes('/crm/adjuntos') && metodo === 'POST') {
      if (subidaFalla) return json({ detail: "'x.pdf': el archivo está vacío" }, 422);
      return json({ adjuntos: [{ id: 'ad-2' }], duplicados: [] }, 201);
    }
    if (url.includes('/crm/adjuntos') && metodo === 'DELETE') {
      adjuntos = adjuntos.map(a => ({ ...a, anulado_en: '2026-09-02T10:00:00' }));
      return json({ id: 'ad-1' });
    }
    if (url.includes('/crm/adjuntos')) return json(adjuntos.filter(a => !a.anulado_en));
    if (url.includes('/crm/interacciones') && metodo === 'POST') return json({ id: 'i-1', puntos_scoring: 5 }, 201);
    if (url.includes('/crm/interacciones/timeline')) return json([]);
    if (url.includes('/crm/oportunidades/o-1')) return json(DETALLE);
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const abrirInteraccion = async () => {
  render(<OportunidadFichaModal token="tok" oportunidadId="o-1" onClose={() => {}} />);
  await screen.findByText('Registrar interacción');
  fireEvent.click(screen.getByText('Registrar interacción'));
  return screen.getByLabelText('Elegir archivos');
};

const postsAdjuntos = () => llamadas.filter(l => l.metodo === 'POST' && l.url.includes('/crm/adjuntos'));

describe('adjuntos al registrar una interacción', () => {
  it('primero guarda la interacción y después sube los adjuntos con su id', async () => {
    const input = await abrirInteraccion();
    fireEvent.change(input, { target: { files: [archivoPdf('f931.pdf')] } });
    await screen.findByText('f931.pdf');

    fireEvent.change(screen.getByLabelText('Categoría de f931.pdf'), { target: { value: 'F931' } });
    fireEvent.click(screen.getByText('Guardar'));

    await waitFor(() => expect(postsAdjuntos()).toHaveLength(1));
    const interaccion = llamadas.findIndex(l => l.metodo === 'POST' && l.url.includes('/crm/interacciones'));
    const subida = llamadas.findIndex(l => l.metodo === 'POST' && l.url.includes('/crm/adjuntos'));
    expect(interaccion).toBeLessThan(subida);
    expect(postsAdjuntos()[0].body.get('interaccion_id')).toBe('i-1');
    expect(postsAdjuntos()[0].body.get('categoria')).toBe('F931');
  });

  it('rechaza el archivo inválido con el motivo exacto y no lo sube', async () => {
    const input = await abrirInteraccion();
    const falso = new File([new Uint8Array([0x4d, 0x5a])], 'virus.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [falso] } });

    await screen.findByText(/solo se aceptan PDF, JPG y PNG/);
    fireEvent.click(screen.getByText('Guardar'));
    await waitFor(() => expect(llamadas.some(l => l.url.includes('/crm/interacciones') && l.metodo === 'POST')).toBe(true));
    expect(postsAdjuntos()).toHaveLength(0);
  });

  it('si la subida falla, la interacción no se pierde y el lote se reintenta', async () => {
    subidaFalla = true;
    const input = await abrirInteraccion();
    fireEvent.change(input, { target: { files: [archivoPdf('f931.pdf')] } });
    await screen.findByText('f931.pdf');
    fireEvent.click(screen.getByText('Guardar'));

    await screen.findByText('Interacción guardada, adjuntos no subidos.');
    expect(screen.getByText(/atómica por lote/)).toBeTruthy();
    expect(llamadas.filter(l => l.metodo === 'POST' && l.url.includes('/crm/interacciones'))).toHaveLength(1);

    subidaFalla = false;
    fireEvent.click(screen.getByText('Reintentar'));
    await waitFor(() => expect(postsAdjuntos()).toHaveLength(2));
    await waitFor(() => expect(screen.queryByText('Interacción guardada, adjuntos no subidos.')).toBeNull());
    // El reintento no vuelve a crear la interacción.
    expect(llamadas.filter(l => l.metodo === 'POST' && l.url.includes('/crm/interacciones'))).toHaveLength(1);
  });
});

describe('pestaña Documentos', () => {
  const abrirDocumentos = async () => {
    render(<OportunidadFichaModal token="tok" oportunidadId="o-1" onClose={() => {}} />);
    await screen.findByText('Documentos');
    fireEvent.click(screen.getByText('Documentos'));
    return screen.findByText('f931.pdf');
  };

  it('lista los adjuntos de la oportunidad y los descarga con el token', async () => {
    await abrirDocumentos();
    fireEvent.click(screen.getByText('Descargar'));
    await waitFor(() => {
      const descarga = llamadas.find(l => l.url.includes('/crm/adjuntos/ad-1/descargar'));
      expect(descarga).toBeTruthy();
    });
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('anular pide confirmación y hace DELETE (no borra)', async () => {
    await abrirDocumentos();
    fireEvent.click(screen.getByText('Anular'));
    await screen.findByText(/El archivo no se borra/);

    const confirmar = screen.getAllByText('Anular')
      .map(el => el.closest('button'))
      .find(b => b && b.className.includes('flex-1'));
    fireEvent.click(confirmar);
    await waitFor(() => expect(llamadas.some(l => l.metodo === 'DELETE' && l.url.includes('/crm/adjuntos/ad-1'))).toBe(true));
  });

  it('permite adjuntar sin interacción, con la oportunidad como entidad', async () => {
    await abrirDocumentos();
    fireEvent.click(screen.getByText('Adjuntar'));
    fireEvent.change(await screen.findByLabelText('Elegir archivos'), { target: { files: [archivoPdf('poliza.pdf')] } });
    await screen.findByText('poliza.pdf');
    fireEvent.click(screen.getByText('Subir'));

    await waitFor(() => expect(postsAdjuntos()).toHaveLength(1));
    expect(postsAdjuntos()[0].body.get('oportunidad_id')).toBe('o-1');
    expect(postsAdjuntos()[0].body.get('interaccion_id')).toBeNull();
  });
});
