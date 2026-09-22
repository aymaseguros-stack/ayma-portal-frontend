// @vitest-environment jsdom
//
// C-6q: el estado de la subida, visible donde se miran los archivos
// (backend: app/api/v1/crm_adjuntos.py, C-6n / b93fb11).
//
// QUÉ DEFIENDE CADA BLOQUE, y por qué "renderiza sin romper" no alcanza:
//
// 1. UN ARCHIVO FALLIDO NO SE OFRECE PARA DESCARGAR. `tamano_bytes` se
//    escribe EN LÍNEA dentro del pedido, así que un archivo que nunca llegó
//    a Drive se veía acá completo y con su botón: alguien lo tocaba y
//    recibía un error o nada. El que decide es `subida_estado`.
// 2. EN VUELO TAMPOCO. Ahí el archivo va a llegar, pero todavía no está:
//    ofrecer la descarga es un 409 asegurado.
// 3. UN SOLO POST POR CLIC (H-66). Cada reintento arranca una tanda de
//    hasta cuatro intentos contra Drive; dos clics son dos tandas sobre el
//    mismo archivo.
// 4. EL 409 SE MUESTRA TAL CUAL. Sin binario conservado -los adjuntos
//    anteriores a C-6n no lo tienen- el backend dice que hay que volver a
//    pedirle el archivo al cliente. `AdjuntoResponse` no declara
//    `binario_conservado`, así que esconder el botón "por las dudas"
//    dejaría sin salida a los que SÍ se pueden recuperar.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DocumentosTab from './DocumentosTab';
import { estaEnVuelo, fallo, sePuedeDescargar } from './subidaAdjunto';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data,
  blob: async () => new Blob(['x']),
  clone: () => ({ json: async () => data }),
});

const ADJUNTO = {
  id: 'a1', nombre_original: 'frente.jpg', mime: 'image/jpeg', tamano_bytes: 2900000,
  sha256: 'abc', categoria: 'FOTO_INSPECCION', creado_en: '2026-09-22T13:00:00',
  anulado_en: null, purgado_en: null, en_drive: true, subida_estado: 'OK',
  subida_error: null, subida_intentos: 0,
};

let pedidos;
beforeEach(() => { pedidos = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const servidor = (adjuntos, { postStatus = 200, postBody = {} } = {}) =>
  vi.fn((url, init) => {
    pedidos.push({ url: String(url), metodo: init?.method || 'GET' });
    if (init?.method === 'POST') return Promise.resolve(respuesta(postBody, postStatus));
    return Promise.resolve(respuesta(adjuntos));
  });

const montar = () => render(
  <DocumentosTab token="t" filtro={{ oportunidad_id: 'opp1' }} />,
);

const posts = () => pedidos.filter((p) => p.metodo === 'POST');

describe('el vocabulario de la subida', () => {
  it('una fila vieja sin la columna se da por subida', () => {
    const vieja = { id: 'x' };
    expect(estaEnVuelo(vieja)).toBe(false);
    expect(fallo(vieja)).toBe(false);
    expect(sePuedeDescargar(vieja)).toBe(true);
  });

  it('un purgado no se descarga aunque diga OK', () => {
    expect(sePuedeDescargar({ subida_estado: 'OK', purgado_en: '2026-09-22T10:00:00' })).toBe(false);
  });
});

describe('Documentos — el estado por archivo (C-6q punto 1)', () => {
  it('FALLIDA: sin "Descargar", con el aviso y con "Reintentar subida"', async () => {
    globalThis.fetch = servidor([{ ...ADJUNTO, en_drive: false, subida_estado: 'FALLIDA' }]);
    montar();

    await screen.findByText('frente.jpg');
    expect(screen.queryByRole('button', { name: /Descargar/i })).toBeNull();
    expect(screen.getByText(/La subida falló/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Reintentar subida/i })).toBeTruthy();
  });

  it('EN_CURSO: dice que está subiendo y tampoco ofrece la descarga', async () => {
    globalThis.fetch = servidor([{ ...ADJUNTO, en_drive: false, subida_estado: 'EN_CURSO' }]);
    montar();

    await screen.findByText('frente.jpg');
    expect(screen.getByText(/Todavía subiendo/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Descargar/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Reintentar subida/i })).toBeNull();
  });

  it('OK: se descarga, sin cartel ni botón de reintento', async () => {
    globalThis.fetch = servidor([ADJUNTO]);
    montar();

    await screen.findByText('frente.jpg');
    expect(screen.getByRole('button', { name: /Descargar/i })).toBeTruthy();
    expect(screen.queryByText(/La subida falló/i)).toBeNull();
  });
});

describe('Documentos — reintentar la subida (C-6q punto 1 / backend C-6n)', () => {
  it('un doble clic manda UN solo POST', async () => {
    globalThis.fetch = servidor([{ ...ADJUNTO, en_drive: false, subida_estado: 'FALLIDA' }]);
    montar();

    const boton = await screen.findByRole('button', { name: /Reintentar subida/i });
    fireEvent.click(boton);
    fireEvent.click(boton);

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url).toContain('/crm/adjuntos/a1/reintentar-subida');
  });

  it('sin copia del archivo muestra el 409 del backend, que es el que sabe', async () => {
    globalThis.fetch = servidor(
      [{ ...ADJUNTO, en_drive: false, subida_estado: 'FALLIDA' }],
      { postStatus: 409, postBody: { detail: 'No quedó una copia del archivo en el portal, así que no hay nada con qué reintentar la subida.' } },
    );
    montar();

    fireEvent.click(await screen.findByRole('button', { name: /Reintentar subida/i }));
    await screen.findByText(/No quedó una copia del archivo en el portal/i);
  });
});

// ---------------------------------------------------------------------------
// C-6q punto 3: el encabezado del detalle tiene que decir el estado NUEVO
// ---------------------------------------------------------------------------
// El modal pinta la fila del listado, y al observar con link nuevo se queda
// abierto (el token en claro sale una sola vez). Sin recargar el listado
// seguía diciendo "Pendiente de revisión" sobre una solicitud ya observada.
// Los datos en claro NO se vuelven a pedir: cada lectura se audita.
const SOLICITUD = {
  id: 's1', oportunidad_id: 'opp1', estado: 'PENDIENTE_REVISION',
  vence_en: '2026-09-25T10:00:00', enviada_en: '2026-09-22T13:00:00',
  consentimiento_version: 'v1', consentimiento_fecha: '2026-09-22T13:00:00',
  vencida: false, archivos: 1, archivos_en_vuelo: 0, archivos_fallidos: 0,
  oportunidad_referencia: 'AYMA-OPP-1', cliente_nombre: 'Juan Pérez',
  purgada_en: null, observacion: null,
};

describe('el encabezado refleja el estado nuevo sin recargar (C-6q punto 3)', () => {
  it('tras observar con link nuevo dice "Observada" y no reabre los datos', async () => {
    const { default: SolicitudesEmisionPanel } = await import('./SolicitudesEmisionPanel');
    let observada = false;
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      pedidos.push({ url: u, metodo: init?.method || 'GET' });
      if (u.includes('/observar')) {
        observada = true;
        return Promise.resolve(respuesta({
          detalle: 'Se generó un link nuevo y el anterior quedó revocado.',
          link: {
            url: 'https://aymaseguros.com.ar/emision/xyz', qr_png_base64: 'aGVsbG8=',
            solicitud: { ...SOLICITUD, estado: 'OBSERVADA' },
          },
        }));
      }
      if (/\/solicitudes-emision\/s1$/.test(u)) return Promise.resolve(respuesta({ ...SOLICITUD, datos: {}, adjuntos: [] }));
      return Promise.resolve(respuesta([
        observada ? { ...SOLICITUD, estado: 'OBSERVADA', observacion: 'Falta el frente del DNI' } : SOLICITUD,
      ]));
    });

    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    fireEvent.click(await screen.findByRole('button', { name: 'Observar' }));
    fireEvent.change(screen.getByLabelText(/Qué hay que corregir/i), {
      target: { value: 'Falta el frente del DNI' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar observación/i }));

    // El modal sigue abierto con el link nuevo Y el encabezado ya dice el
    // estado nuevo.
    await screen.findByText('https://aymaseguros.com.ar/emision/xyz');
    // La fila se releyó: el detalle la referencia POR ID, así que se
    // reemplaza sin cerrar el modal. Antes seguía diciendo "Pendiente de
    // revisión" y no mostraba la observación recién escrita.
    await screen.findByText(/Observación: Falta el frente del DNI/i);
    await waitFor(() => expect(
      screen.getAllByText('Observada').length,
    ).toBeGreaterThan(1));   // >1: uno es la opción del filtro de estado
    // Ni un GET al detalle en claro: ese endpoint audita cada lectura.
    expect(pedidos.filter((p) => /\/solicitudes-emision\/s1$/.test(p.url))).toHaveLength(0);
  });
});
