// @vitest-environment jsdom
// Reglas de los adjuntos del CRM: las mismas que valida el backend
// (app/services/crm_adjuntos.py), aplicadas antes de subir.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  validarArchivo, validarSeleccion, subirAdjuntos, descargarAdjunto,
  agruparPorInteraccion, formatBytes, MAX_ARCHIVOS,
} from './adjuntosApi';

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff];

const archivo = (nombre, firma, relleno = 10, type = 'application/pdf') =>
  new File([new Uint8Array([...firma, ...new Array(relleno).fill(0)])], nombre, { type });

describe('validación previa a la subida', () => {
  it('acepta PDF, PNG y JPG por firma de bytes', async () => {
    expect((await validarArchivo(archivo('a.pdf', PDF))).mime).toBe('application/pdf');
    expect((await validarArchivo(archivo('b.png', PNG))).mime).toBe('image/png');
    expect((await validarArchivo(archivo('c.jpg', JPG))).mime).toBe('image/jpeg');
  });

  it('rechaza por tipo, aunque la extensión y el content-type digan PDF', async () => {
    const falso = new File([new Uint8Array([0x4d, 0x5a, 0x90, 0x00])], 'virus.pdf', { type: 'application/pdf' });
    const r = await validarArchivo(falso);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('solo se aceptan PDF, JPG y PNG');
    expect(r.motivo).toContain('virus.pdf');
  });

  it('rechaza por tamaño con el motivo exacto', async () => {
    const grande = archivo('grande.pdf', PDF, 11 * 1024 * 1024);
    const r = await validarArchivo(grande);
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain('el máximo es 10 MB por archivo');
  });

  it('rechaza por cantidad: 5 archivos por interacción', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => archivo(`f${i}.pdf`, PDF));
    const { aceptados, errores } = await validarSeleccion(seis, []);
    expect(aceptados).toHaveLength(MAX_ARCHIVOS);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toContain('5 archivos como máximo');
  });

  it('cuenta los ya elegidos para el cupo', async () => {
    const yaElegidos = Array.from({ length: 4 }, (_, i) => ({ id: `x${i}` }));
    const { aceptados, errores } = await validarSeleccion([archivo('a.pdf', PDF), archivo('b.pdf', PDF)], yaElegidos);
    expect(aceptados).toHaveLength(1);
    expect(errores).toHaveLength(1);
  });

  it('los aceptados nacen en categoría OTRO', async () => {
    const { aceptados } = await validarSeleccion([archivo('a.pdf', PDF)], []);
    expect(aceptados[0].categoria).toBe('OTRO');
  });
});

describe('subida', () => {
  beforeEach(() => { globalThis.fetch = vi.fn(); });
  afterEach(() => vi.restoreAllMocks());

  it('manda interaccion_id y no duplica la herencia de entidades', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ adjuntos: [{ id: 'a1' }], duplicados: [] }) });
    const { aceptados } = await validarSeleccion([archivo('a.pdf', PDF)], []);
    await subirAdjuntos('tok', aceptados, { interaccion_id: 'i-1' });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/crm/adjuntos');
    expect(opts.headers.Authorization).toBe('Bearer tok');
    expect(opts.body.get('interaccion_id')).toBe('i-1');
    expect(opts.body.get('categorias')).toBe('OTRO');
    expect(opts.body.get('oportunidad_id')).toBeNull();
  });

  it('UN solo request con `categorias` paralela, en el mismo orden que los archivos', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ adjuntos: [], duplicados: [] }) });
    const { aceptados } = await validarSeleccion([archivo('a.pdf', PDF), archivo('b.png', PNG)], []);
    aceptados[0].categoria = 'F931';
    aceptados[1].categoria = 'POLIZA';
    await subirAdjuntos('tok', aceptados, { interaccion_id: 'i-1' });

    // Un request, no uno por categoría: el backend no persiste nada si un
    // archivo del lote falla, y esa garantía sólo vale dentro de un request.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, opts] = globalThis.fetch.mock.calls[0];
    // El orden importa: `categorias[i]` es la categoría de `archivos[i]`.
    expect(opts.body.getAll('archivos').map((f) => f.name)).toEqual(['a.pdf', 'b.png']);
    expect(opts.body.getAll('categorias')).toEqual(['F931', 'POLIZA']);
  });

  it('manda una categoría por archivo aunque todas sean la misma (longitud exacta o 422)', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 201, json: async () => ({ adjuntos: [], duplicados: [] }) });
    const { aceptados } = await validarSeleccion(
      [archivo('a.pdf', PDF), archivo('b.png', PNG), archivo('c.jpg', JPG)], []);
    await subirAdjuntos('tok', aceptados, { interaccion_id: 'i-1' });

    const [, opts] = globalThis.fetch.mock.calls[0];
    expect(opts.body.getAll('archivos')).toHaveLength(3);
    expect(opts.body.getAll('categorias')).toEqual(['OTRO', 'OTRO', 'OTRO']);
  });

  it('un error del backend en el lote no deja una subida a medias: es un solo request', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 422, json: async () => ({ detail: 'categorias[1] inválida' }) });
    const { aceptados } = await validarSeleccion([archivo('a.pdf', PDF), archivo('b.png', PNG)], []);
    await expect(subirAdjuntos('tok', aceptados, { interaccion_id: 'i-1' }))
      .rejects.toThrow(/categorias\[1\] inválida/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('propaga el aviso de duplicado del backend', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true, status: 201,
      json: async () => ({ adjuntos: [{ id: 'a1' }], duplicados: [{ adjunto_id: 'a1', nombre_original: 'a.pdf', duplicado_de: 'a0' }] }),
    });
    const { aceptados } = await validarSeleccion([archivo('a.pdf', PDF)], []);
    const { duplicados } = await subirAdjuntos('tok', aceptados, { interaccion_id: 'i-1' });
    expect(duplicados).toHaveLength(1);
  });
});

describe('descarga', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
    globalThis.URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('va con el token de sesión y no genera un enlace compartible', async () => {
    globalThis.fetch.mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['x']) });
    await descargarAdjunto('tok', { id: 'a1', nombre_original: 'a.pdf' });
    const [url, opts] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/crm/adjuntos/a1/descargar');
    expect(opts.headers.Authorization).toBe('Bearer tok');
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });

  it('410 es "adjunto anulado"', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 410, json: async () => ({ detail: 'El adjunto fue anulado' }) });
    await expect(descargarAdjunto('tok', { id: 'a1' })).rejects.toThrow('Adjunto anulado');
  });
});

describe('utilidades', () => {
  it('agrupa por interacción y descarta los sueltos', () => {
    const mapa = agruparPorInteraccion([
      { id: '1', interaccion_id: 'i1' }, { id: '2', interaccion_id: 'i1' },
      { id: '3', interaccion_id: null },
    ]);
    expect(mapa.i1).toHaveLength(2);
    expect(Object.keys(mapa)).toEqual(['i1']);
  });

  it('formatea tamaños', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});
