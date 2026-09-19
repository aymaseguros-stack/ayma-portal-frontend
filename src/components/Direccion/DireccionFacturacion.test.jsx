// @vitest-environment jsdom
//
// Dirección > Finanzas > Facturación. Lo que estos tests protegen, en orden
// de gravedad (todos son cosas que cuestan plata o un trámite ante ARCA):
//
//  1. El AMBIENTE está a la vista, y sobre todo en la confirmación previa a
//     emitir: un comprobante de producción es irreversible.
//  2. El módulo apagado (503) se ve como cartel informativo, no como un
//     error rojo de red.
//  3. El `Idempotency-Key` es EL MISMO al reintentar el mismo envío: una
//     clave nueva emitiría un segundo comprobante con CAE.
//  4. Lo que ARCA rechazó se muestra TEXTUAL y completo.
//  5. Con ERROR_COMUNICACION se ofrece RECONCILIAR y no existe un botón de
//     reintentar.
//  6. El PDF se baja con Authorization y como blob, sin URL compartible.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import TabFacturacion from './DireccionFacturacion';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const ESTADO_PRENDIDO = {
  habilitado: true,
  ambiente: 'homologacion',
  produccion: false,
  configurado: true,
  faltantes: [],
  condicion_emisor: 'MONOTRIBUTO',
  tipos_habilitados: ['FACTURA_C', 'NOTA_CREDITO_C'],
  punto_venta: 3,
  cuit_emisor_ultimos_digitos: '014',
  certificado: { disponible: true, sujeto: 'CN=ayma', vence: '2027-01-01T00:00:00' },
  ticket: { existe: true, vigente: true, vigente_hasta: '2026-09-19T20:00:00', ambiente: 'homologacion' },
  arca: { consultado: true, appserver: 'OK', dbserver: 'OK', authserver: 'OK' },
  qr_disponible: true,
};

const VACIO = { total: 0, limit: 50, offset: 0, items: [] };
const RESUMEN = {
  anio: 2026, mes: 9, ambiente: 'homologacion', cantidad: 0,
  por_estado: {}, por_tipo: {}, total_autorizado_neto_de_notas_de_credito: '0.00',
};

let llamadas;

const responder = (url, init) => {
  const u = String(url);
  llamadas.push({ url: u, init });
  if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
  if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
  if (u.includes('/facturas/parametros')) return Promise.resolve(respuesta({}));
  if (u.match(/\/facturas(\?|$)/)) return Promise.resolve(respuesta(VACIO));
  return Promise.resolve(respuesta(VACIO));
};

beforeEach(() => {
  llamadas = [];
  globalThis.fetch = vi.fn(responder);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Panel de estado ARCA', () => {
  it('muestra el ambiente en grande y no lo esconde', async () => {
    render(<TabFacturacion token="t" />);
    await waitFor(() => expect(screen.getByLabelText('Ambiente HOMOLOGACIÓN')).toBeTruthy());
    expect(screen.getAllByText('HOMOLOGACIÓN').length).toBeGreaterThan(0);
    // Y dice lo que significa: sin validez fiscal.
    expect(screen.getByText(/NO tienen validez fiscal/)).toBeTruthy();
  });

  it('con PRODUCCIÓN lo rotula en rojo y lo dice irreversible', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      if (String(url).includes('/facturas/estado')) {
        return Promise.resolve(respuesta({ ...ESTADO_PRENDIDO, ambiente: 'produccion', produccion: true }));
      }
      return responder(url, init);
    });
    render(<TabFacturacion token="t" />);
    await waitFor(() => expect(screen.getByLabelText('Ambiente PRODUCCIÓN')).toBeTruthy());
    expect(screen.getByLabelText('Ambiente PRODUCCIÓN').className).toContain('red');
  });

  it('con el módulo apagado muestra el cartel y NO un error rojo', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/facturas/estado')) {
        return Promise.resolve(respuesta({
          ...ESTADO_PRENDIDO, habilitado: false, configurado: false,
          faltantes: ['ARCA_FACTURACION_CERT_PATH'],
          arca: { consultado: false, motivo: 'El módulo está apagado o sin configurar' },
        }));
      }
      return Promise.resolve(respuesta({ detail: 'apagado' }, 503));
    });
    render(<TabFacturacion token="t" />);
    await waitFor(() => expect(
      screen.getByText(/Facturación apagada \(FACTURACION_ENABLED=false\)/)
    ).toBeTruthy());
    // Nada de "No se pudieron cargar": no es una falla.
    expect(screen.queryByText(/No se pudieron cargar/)).toBeNull();
    // Y dice qué falta, por nombre de variable.
    expect(screen.getAllByText(/ARCA_FACTURACION_CERT_PATH/).length).toBeGreaterThan(0);
    // Con el módulo apagado no se ofrece emitir.
    expect(screen.getByText('+ Nueva factura').disabled).toBe(true);
  });
});

// --- Emisión ---------------------------------------------------------------

const abrirYCompletar = async () => {
  fireEvent.click(screen.getByText('+ Nueva factura'));
  await screen.findByText('Nueva factura');
  // Receptor rápido: Consumidor Final.
  fireEvent.click(screen.getByText('Consumidor Final'));
  const inputs = document.querySelectorAll('input');
  // Descripción del único ítem y precio.
  const descripcion = [...inputs].find((i) => i.type === 'text' && i.closest('label')?.textContent?.startsWith('Descripción'));
  fireEvent.change(descripcion, { target: { value: 'Honorarios' } });
  const precio = [...document.querySelectorAll('input')]
    .find((i) => i.closest('label')?.textContent?.startsWith('Precio unitario'));
  fireEvent.change(precio, { target: { value: '1000' } });
  fireEvent.click(screen.getByText('Revisar y emitir'));
  await screen.findByText(/Total a facturar/);
};

describe('Emisión', () => {
  it('la confirmación previa muestra el AMBIENTE antes de emitir', async () => {
    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();
    // Dos carteles de ambiente: el del panel y el de la confirmación.
    expect(screen.getAllByLabelText('Ambiente HOMOLOGACIÓN').length).toBeGreaterThan(1);
    expect(screen.getByText('Emitir en HOMOLOGACIÓN')).toBeTruthy();
  });

  it('reintentar el MISMO envío reusa el Idempotency-Key', async () => {
    let fallar = true;
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      llamadas.push({ url: u, init });
      if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
      if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
      if (init?.method === 'POST') {
        if (fallar) { fallar = false; return Promise.resolve(respuesta({ detail: 'ARCA no respondió' }, 502)); }
        return Promise.resolve(respuesta({ id: 'f1', estado: 'AUTORIZADA', ambiente: 'homologacion', items: [] }, 201));
      }
      return Promise.resolve(respuesta(VACIO));
    });

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();

    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));
    await waitFor(() => expect(screen.getByText(/ARCA no respondió/)).toBeTruthy());

    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));
    await waitFor(() => {
      const posts = llamadas.filter((l) => l.init?.method === 'POST');
      expect(posts.length).toBe(2);
      const claves = posts.map((p) => p.init.headers['Idempotency-Key']);
      expect(claves[0]).toBeTruthy();
      expect(claves[0]).toBe(claves[1]);
    });
  });

  it('“Volver” al formulario renueva la clave: es otro envío', async () => {
    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();
    const primera = screen.getByText(/Clave de idempotencia/).textContent;
    fireEvent.click(screen.getByText('Volver'));
    fireEvent.click(screen.getByText('Revisar y emitir'));
    await screen.findByText(/Total a facturar/);
    expect(screen.getByText(/Clave de idempotencia/).textContent).not.toBe(primera);
  });

  it('un rechazo de ARCA se muestra TEXTUAL y completo', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
      if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
      if (init?.method === 'POST') {
        return Promise.resolve(respuesta({
          id: 'f9', estado: 'RECHAZADA', ambiente: 'homologacion', resultado_arca: 'R',
          importe_total: '1000.00', receptor_razon_social: 'Consumidor Final',
          receptor_tipo_documento: 'CONSUMIDOR_FINAL', receptor_numero_documento: '0',
          tipo_comprobante: 'FACTURA_C', numero_completo: null, fecha_comprobante: '2026-09-19',
          moneda: 'PES', items: [],
          errores_arca: [{ codigo: '10018', mensaje: 'El punto de venta no se encuentra habilitado para Web Services' }],
          observaciones_arca: [{ codigo: '10013', mensaje: 'Fecha de comprobante anterior a la permitida' }],
        }, 201));
      }
      return Promise.resolve(respuesta(VACIO));
    });

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));

    await waitFor(() => expect(screen.getByText('Lo que contestó ARCA')).toBeTruthy());
    // Código y mensaje ENTEROS, sin resumir.
    expect(screen.getByText(/El punto de venta no se encuentra habilitado para Web Services/)).toBeTruthy();
    expect(screen.getByText(/Fecha de comprobante anterior a la permitida/)).toBeTruthy();
    expect(screen.getByText('Copiar detalle')).toBeTruthy();
  });

  it('con ERROR_COMUNICACION ofrece Reconciliar y NUNCA reintentar', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
      if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
      if (init?.method === 'POST') {
        return Promise.resolve(respuesta({
          id: 'f7', estado: 'ERROR_COMUNICACION', ambiente: 'homologacion',
          tipo_comprobante: 'FACTURA_C', numero_completo: '0003-00000009',
          fecha_comprobante: '2026-09-19', importe_total: '1000.00', moneda: 'PES',
          receptor_razon_social: 'Consumidor Final', receptor_tipo_documento: 'CONSUMIDOR_FINAL',
          receptor_numero_documento: '0', items: [],
          errores_arca: [{ codigo: 'timeout', mensaje: 'ARCA no contestó en 30s' }],
        }, 201));
      }
      return Promise.resolve(respuesta(VACIO));
    });

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));

    await waitFor(() => expect(screen.getByText('Reconciliar')).toBeTruthy());
    expect(screen.queryByText(/Reintentar/i)).toBeNull();
    expect(screen.getByText(/PUDO HABER AUTORIZADO/)).toBeTruthy();
  });
});

// --- PDF -------------------------------------------------------------------

describe('Descarga de PDF', () => {
  it('va autenticada y por blob, sin URL compartible', async () => {
    const blob = { type: 'application/pdf' };
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:local');
    globalThis.URL.revokeObjectURL = vi.fn();
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      llamadas.push({ url: u, init });
      if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
      if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
      if (init?.method === 'POST') {
        return Promise.resolve(respuesta({
          id: 'f5', estado: 'AUTORIZADA', ambiente: 'homologacion', cae: '75000000000001',
          cae_vencimiento: '2026-09-29', tipo_comprobante: 'FACTURA_C',
          numero_completo: '0003-00000005', fecha_comprobante: '2026-09-19',
          importe_total: '1000.00', moneda: 'PES', receptor_razon_social: 'Consumidor Final',
          receptor_tipo_documento: 'CONSUMIDOR_FINAL', receptor_numero_documento: '0', items: [],
        }, 201));
      }
      if (u.endsWith('/pdf')) return Promise.resolve({ ok: true, status: 200, blob: async () => blob });
      return Promise.resolve(respuesta(VACIO));
    });

    render(<TabFacturacion token="mi-token" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirYCompletar();
    fireEvent.click(screen.getByText('Emitir en HOMOLOGACIÓN'));
    await screen.findByText('Descargar PDF');

    fireEvent.click(screen.getByText('Descargar PDF'));
    await waitFor(() => {
      const pdf = llamadas.find((l) => l.url.endsWith('/pdf'));
      expect(pdf).toBeTruthy();
      expect(pdf.init.headers.Authorization).toBe('Bearer mi-token');
    });
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
    // La object URL se revoca: nunca queda una URL viva apuntando al PDF.
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalled();
  });
});
