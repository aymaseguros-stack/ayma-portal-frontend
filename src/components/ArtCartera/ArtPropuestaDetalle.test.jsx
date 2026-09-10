// @vitest-environment jsdom
//
// Tests de la pantalla "Propuesta" (BLOQUE 1.3) contra GET
// /art/propuestas/{id}, POST /art/propuestas/{id}/estado y
// GET /art/propuestas/{id}/pdf.
//
// LO QUE PROTEGEN, en orden de gravedad comercial:
//
// 1. Que la rentabilidad (comisión, win, win x trabajador) esté COLAPSADA
//    por default. No está escondida - quien arma la propuesta la necesita -
//    pero no puede estar abierta mientras alguien comparte pantalla con el
//    cliente. Es la misma frontera que el backend protege en el PDF
//    (tests/test_propuesta_art.py::test_pdf_no_expone_datos_internos).
// 2. Que se muestre `estado_efectivo` y no `estado`: una propuesta cuya
//    validez pasó se lee VENCIDA aunque la columna diga ENTREGADA. Verla
//    como "Entregada" manda a alguien a llamar prometiendo un precio que
//    ya no está vigente.
// 3. Que el 409 del backend se muestre TAL CUAL ("cargar F.931 primero"):
//    ese mensaje es la instrucción de qué hacer, no un error genérico.
// 4. Que sólo aparezcan los botones de las transiciones que el backend
//    acepta. Un botón que va a dar 409 parece que se puede.
// 5. Que un ahorro en `null` no se renderice como "$ 0" - misma regla que
//    la grilla: null es "no se sabe", no "no ahorra nada".
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtPropuestaDetalle from './ArtPropuestaDetalle';

afterEach(cleanup);

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  json: async () => body,
});

const errorResponse = (detail, status = 409) => ({
  ok: false,
  status,
  json: async () => ({ detail }),
  text: async () => JSON.stringify({ detail }),
});

// Los Decimal del backend llegan como STRING (FastAPI los serializa así
// para no perder precisión), nunca como number.
const propuesta = (extra = {}) => ({
  id: 'prop-1',
  empresa_id: 'emp-1',
  version: 2,
  aseguradora: 'plus',
  aseguradora_display: 'Plus ART',
  alicuota_ofertada: '2.500',
  origen_alicuota: 'BENCHMARK',
  masa_salarial: '48000000.00',
  dotacion: 40,
  origen_masa: 'ESTIMADA',
  confianza_masa: 'MEDIA',
  sujeta_a_f931: true,
  art_actual: 'galeno',
  art_actual_display: 'Galeno ART',
  tarifa_actual: '3.500',
  lrt_mensual: '1200000.00',
  lrt_anual: '15600000.00',
  ahorro_anual: '6240000.00',
  costo_x_trabajador_mensual: '30000.00',
  comision_bruta: '60000.00',
  comision_neta: '48000.00',
  win: '36000.00',
  w_x_trbj: '900.00',
  bajo_umbral: false,
  parametros_snapshot: { cuotas_anuales: '13' },
  estado: 'BORRADOR',
  estado_efectivo: 'BORRADOR',
  dias_restantes: 30,
  fecha_emision: '2026-09-10',
  valida_hasta: '2026-10-10',
  fecha_entrega: null,
  tiene_pdf: false,
  hash_sha256: null,
  vault_token: null,
  observaciones: null,
  creada_por: 'user-1',
  creada_en: '2026-09-10T12:00:00',
  ...extra,
});

beforeEach(() => {
  vi.restoreAllMocks();
});

const renderDetalle = () => render(
  <ArtPropuestaDetalle token="tok" propuestaId="prop-1" onVolver={() => {}} />,
);

describe('ArtPropuestaDetalle', () => {
  it('pide la propuesta por id y muestra el resumen del cliente', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta()));
    renderDetalle();

    await waitFor(() => expect(screen.getByText(/Propuesta v2/)).toBeTruthy());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/art/propuestas/prop-1');
    expect(screen.getByText('Lo que ve el cliente')).toBeTruthy();
    expect(screen.getByText('$ 6.240.000')).toBeTruthy();
    expect(screen.getByText('30 días restantes')).toBeTruthy();
  });

  it('la rentabilidad arranca COLAPSADA y se abre a pedido', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta()));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Rentabilidad (interno)')).toBeTruthy());
    // El encabezado del bloque se ve; los importes internos, no.
    expect(screen.queryByText('Comisión neta')).toBeNull();
    expect(screen.queryByText('Win')).toBeNull();

    fireEvent.click(screen.getByText('Rentabilidad (interno)'));

    expect(screen.getByText('Comisión neta')).toBeTruthy();
    expect(screen.getByText('Win')).toBeTruthy();
    expect(screen.getByText('Win × trabajador')).toBeTruthy();
  });

  it('muestra el badge "Sujeta a F.931" cuando la masa es estimada', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta()));
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Sujeta a F.931')).toBeTruthy());
  });

  it('sin sujeta_a_f931 no muestra el badge', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(propuesta({ sujeta_a_f931: false, confianza_masa: 'CONFIRMADA' })),
    );
    renderDetalle();
    await waitFor(() => expect(screen.getByText(/Propuesta v2/)).toBeTruthy());
    expect(screen.queryByText('Sujeta a F.931')).toBeNull();
  });

  it('muestra VENCIDA (estado efectivo) aunque la columna diga ENTREGADA', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({
      estado: 'ENTREGADA',
      estado_efectivo: 'VENCIDA',
      dias_restantes: -4,
      fecha_entrega: '2026-09-11',
    })));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Vencida')).toBeTruthy());
    expect(screen.getByText('venció hace 4 días')).toBeTruthy();
    expect(screen.queryByText('Entregada')).toBeNull();
    // Vencida o no, sigue siendo una ENTREGADA: el cliente puede contestar
    // tarde y esa respuesta hay que poder registrarla.
    expect(screen.getByText('Aceptada')).toBeTruthy();
    expect(screen.getByText('Rechazada')).toBeTruthy();
  });

  it('en BORRADOR sólo ofrece "Marcar entregada"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta()));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Marcar entregada')).toBeTruthy());
    expect(screen.queryByText('Aceptada')).toBeNull();
    expect(screen.queryByText('Rechazada')).toBeNull();
  });

  it('en ACEPTADA no ofrece ninguna transición más', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({
      estado: 'ACEPTADA', estado_efectivo: 'ACEPTADA', sujeta_a_f931: false,
      confianza_masa: 'CONFIRMADA',
    })));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Aceptada')).toBeTruthy());
    expect(screen.queryByText('Marcar entregada')).toBeNull();
    expect(screen.queryByText('Rechazada')).toBeNull();
  });

  it('entregar refresca la propuesta con lo que devuelve el backend', async () => {
    const entregada = propuesta({
      estado: 'ENTREGADA', estado_efectivo: 'ENTREGADA',
      fecha_entrega: '2026-09-10', tiene_pdf: true, hash_sha256: 'a'.repeat(64),
    });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce(jsonResponse({ propuesta: entregada, advertencias: [] }));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Marcar entregada')).toBeTruthy());
    fireEvent.click(screen.getByText('Marcar entregada'));

    await waitFor(() => expect(screen.getByText('Entregada')).toBeTruthy());
    const [url, opciones] = globalThis.fetch.mock.calls[1];
    expect(url).toContain('/art/propuestas/prop-1/estado');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ estado: 'ENTREGADA' });
  });

  it('el 409 "cargar F.931 primero" se muestra tal cual', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta({
        estado: 'ENTREGADA', estado_efectivo: 'ENTREGADA',
      })))
      .mockResolvedValueOnce(errorResponse(
        'No se puede aceptar una propuesta calculada sobre masa salarial estimada '
        + '(confianza MEDIA): cargar F.931 primero.',
      ));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Aceptada')).toBeTruthy());
    fireEvent.click(screen.getByText('Aceptada'));

    await waitFor(() => expect(screen.getByText(/cargar F\.931 primero/)).toBeTruthy());
  });

  it('la advertencia del vault caído se muestra sin romper la entrega', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce(jsonResponse({
        propuesta: propuesta({ estado: 'ENTREGADA', estado_efectivo: 'ENTREGADA' }),
        advertencias: ['El Token Vault no estaba disponible: la propuesta quedó entregada.'],
      }));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Marcar entregada')).toBeTruthy());
    fireEvent.click(screen.getByText('Marcar entregada'));

    await waitFor(() => expect(screen.getByText(/Token Vault no estaba disponible/)).toBeTruthy());
    expect(screen.getByText('Entregada')).toBeTruthy();
  });

  it('un ahorro en null no se muestra como "$ 0"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({
      ahorro_anual: null, tarifa_actual: null, art_actual: null,
    })));
    renderDetalle();

    await waitFor(() => expect(screen.getByText(/Propuesta v2/)).toBeTruthy());
    expect(screen.queryByText('$ 0')).toBeNull();
    expect(screen.getByText('falta confirmar qué paga hoy')).toBeTruthy();
  });

  it('el PDF se pide con el header de Authorization, no como link plano', async () => {
    const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce({ ok: true, status: 200, blob: async () => blob });
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:fake');
    globalThis.URL.revokeObjectURL = vi.fn();

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Descargar PDF')).toBeTruthy());
    fireEvent.click(screen.getByText('Descargar PDF'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, opciones] = globalThis.fetch.mock.calls[1];
    expect(url).toContain('/art/propuestas/prop-1/pdf');
    expect(opciones.headers.Authorization).toBe('Bearer tok');
  });

  it('un 500 al cargar no rompe la pantalla: muestra el error y deja reintentar', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(errorResponse('boom', 500));
    renderDetalle();
    await waitFor(() => expect(screen.getByText(/No se pudo cargar la propuesta/)).toBeTruthy());
    expect(screen.getByText('Reintentar')).toBeTruthy();
  });
});
