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

  it('el 409 "cargar F.931 primero" se muestra tal cual, dentro del modal', async () => {
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
    fireEvent.change(screen.getByPlaceholderText('Por qué la aceptó'), {
      target: { value: 'Firmó la propuesta' },
    });
    fireEvent.click(screen.getByText('Marcar aceptada'));

    await waitFor(() => expect(screen.getByText(/cargar F\.931 primero/)).toBeTruthy());
    // El 409 hace rollback: el movimiento NO pasó, así que el modal sigue
    // abierto con el motivo escrito para reintentar sin volver a tipearlo.
    expect(screen.getByPlaceholderText('Por qué la aceptó').value).toBe('Firmó la propuesta');
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

// ---------------------------------------------------------------------------
// Anulación (con motivo obligatorio)
// ---------------------------------------------------------------------------
//
// Lo que protegen: que no se pueda anular sin decir por qué. El motivo es
// lo único que después distingue "se cargó mal la alícuota" de "la
// aseguradora dio de baja la cotización"; sin él, una propuesta anulada es
// indistinguible de un dato perdido. La regla la vuelve a aplicar el
// backend (422), pero el botón deshabilitado ahorra el viaje y, sobre
// todo, explica la exigencia ANTES de escribir.
describe('ArtPropuestaDetalle - anular', () => {
  const abrirModal = async () => {
    await waitFor(() => expect(screen.getByText('Anular')).toBeTruthy());
    fireEvent.click(screen.getByText('Anular'));
  };

  it('el botón de confirmar arranca deshabilitado y se habilita con motivo', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta()));
    renderDetalle();
    await abrirModal();

    const confirmar = screen.getByText('Anular propuesta');
    expect(confirmar.disabled).toBe(true);

    // Espacios NO alcanzan: un motivo en blanco es lo mismo que ninguno.
    fireEvent.change(screen.getByPlaceholderText('Por qué se anula'), {
      target: { value: '   ' },
    });
    expect(screen.getByText('Anular propuesta').disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Por qué se anula'), {
      target: { value: 'Alícuota mal cargada' },
    });
    expect(screen.getByText('Anular propuesta').disabled).toBe(false);
  });

  it('anula por el endpoint propio y manda el motivo', async () => {
    const anulada = propuesta({
      estado: 'ANULADA',
      estado_efectivo: 'ANULADA',
      motivo_anulacion: 'Alícuota mal cargada',
      fecha_anulacion: '2026-09-12',
    });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce(jsonResponse(anulada));
    renderDetalle();
    await abrirModal();

    fireEvent.change(screen.getByPlaceholderText('Por qué se anula'), {
      target: { value: 'Alícuota mal cargada' },
    });
    fireEvent.click(screen.getByText('Anular propuesta'));

    await waitFor(() => expect(globalThis.fetch.mock.calls.length).toBe(2));
    const [url, opciones] = globalThis.fetch.mock.calls[1];
    // Endpoint propio, NO POST /estado: aquel no recibe motivo.
    expect(url).toContain('/art/propuestas/prop-1/anular');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ motivo: 'Alícuota mal cargada' });

    // La pantalla queda mostrando el desenlace, con el motivo a la vista.
    await waitFor(() => expect(screen.getByText('Anulada')).toBeTruthy());
    expect(screen.getByText(/Alícuota mal cargada/)).toBeTruthy();
  });

  it('un error del backend se muestra DENTRO del modal, sin perder el motivo', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce(errorResponse('No se puede anular una propuesta en estado ACEPTADA.'));
    renderDetalle();
    await abrirModal();

    fireEvent.change(screen.getByPlaceholderText('Por qué se anula'), {
      target: { value: 'se emitió mal' },
    });
    fireEvent.click(screen.getByText('Anular propuesta'));

    await waitFor(() => expect(screen.getByText(/en estado ACEPTADA/)).toBeTruthy());
    // El modal sigue abierto y el motivo escrito: si se cerrara habría que
    // volver a tipearlo.
    expect(screen.getByPlaceholderText('Por qué se anula').value).toBe('se emitió mal');
  });

  it('no ofrece anular una ACEPTADA ni una ya ANULADA', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(propuesta({ estado: 'ACEPTADA', estado_efectivo: 'ACEPTADA' })),
    );
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Aceptada')).toBeTruthy());
    expect(screen.queryByText('Anular')).toBeNull();

    cleanup();
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(propuesta({
        estado: 'ANULADA', estado_efectivo: 'ANULADA', motivo_anulacion: 'duplicada',
      })),
    );
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Anulada')).toBeTruthy());
    expect(screen.queryByText('Anular')).toBeNull();
  });

  it('una anulada no muestra la validez: ya tuvo su desenlace', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({
      estado: 'ANULADA',
      estado_efectivo: 'ANULADA',
      motivo_anulacion: 'duplicada',
      dias_restantes: -4,
    })));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Anulada')).toBeTruthy());
    expect(screen.queryByText(/venció hace 4 días/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Badge de confianza de la ALÍCUOTA (distinto del de la masa)
// ---------------------------------------------------------------------------
describe('ArtPropuestaDetalle - confianza de la alícuota', () => {
  it('el origen de la alícuota se muestra como badge propio', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(propuesta({ origen_alicuota: 'COTIZACION_REAL' })),
    );
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Cotización real')).toBeTruthy());
    // Contorno, no pastilla llena: es el rasgo que lo separa del badge de
    // la masa, que está en la misma grilla de datos.
    expect(screen.getByText('Cotización real').className).toContain('border');
  });

  it('los dos badges son distinguibles: la masa dice "Masa"', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(propuesta({ origen_alicuota: 'BENCHMARK', confianza_masa: 'CONFIRMADA' })),
    );
    renderDetalle();

    // Una masa confirmada por F.931 no dice NADA sobre de dónde salió la
    // alícuota: se puede tener la masa declarada y el precio sacado de una
    // mediana de mercado. Los dos badges tienen que poder decir cosas
    // distintas al mismo tiempo.
    await waitFor(() => expect(screen.getByText('Masa confirmada (F.931)')).toBeTruthy());
    expect(screen.getByText('Referencia de mercado')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T17 - Motivo obligatorio en los dos desenlaces + bitácora visible
// ---------------------------------------------------------------------------
//
// LO QUE PROTEGEN:
//
// 1. Que no se pueda marcar ACEPTADA ni RECHAZADA sin decir por qué. Un
//    desenlace sin motivo no se puede trabajar: "rechazada", tres meses
//    después, no dice si se fue por precio, por servicio o porque nunca
//    contestó - y eso es justo lo que hay que saber para volver a llamar.
// 2. Que el motivo viaje como `nota` a POST /estado (BLOQUE 1.5 del
//    backend) y no se pierda en el camino: el backend lo asienta en la
//    bitácora con el estado NUEVO y sólo si la transición se acepta.
// 3. Que "Marcar entregada" NO pida motivo: entregar es un trámite, y
//    pedir una explicación para un paso obligatorio del circuito sólo
//    entrena a escribir "ok" para sacarse el modal de encima.
// 4. Que la bitácora se vea en el detalle, con el estado de CADA entrada al
//    momento de escribirla. Los números de una propuesta entregada no se
//    tocan nunca: la bitácora es lo único que cuenta qué pasó después.
describe('ArtPropuestaDetalle - motivo obligatorio en el desenlace (T17)', () => {
  const entregada = (extra = {}) => propuesta({
    estado: 'ENTREGADA', estado_efectivo: 'ENTREGADA', fecha_entrega: '2026-09-11',
    confianza_masa: 'CONFIRMADA', sujeta_a_f931: false, ...extra,
  });

  it('"Aceptada" abre el modal en vez de mandar el movimiento', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(entregada()));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Aceptada')).toBeTruthy());
    fireEvent.click(screen.getByText('Aceptada'));

    expect(screen.getByText('Marcar como aceptada · v2')).toBeTruthy();
    // Un solo fetch: el de la carga. Nada salió hacia el backend todavía.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('el confirmar arranca deshabilitado y los espacios no alcanzan', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(entregada()));
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Rechazada')).toBeTruthy());
    fireEvent.click(screen.getByText('Rechazada'));

    expect(screen.getByText('Marcar rechazada').disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Por qué la rechazó'), {
      target: { value: '   ' },
    });
    expect(screen.getByText('Marcar rechazada').disabled).toBe(true);

    fireEvent.change(screen.getByPlaceholderText('Por qué la rechazó'), {
      target: { value: 'Se fue con Galeno por precio' },
    });
    expect(screen.getByText('Marcar rechazada').disabled).toBe(false);
  });

  it('confirmar manda {estado, nota} y deja la nota asentada a la vista', async () => {
    const rechazada = entregada({
      estado: 'RECHAZADA',
      estado_efectivo: 'RECHAZADA',
      notas: [{
        fecha: '2026-09-12',
        estado: 'RECHAZADA',
        nota: 'Se fue con Galeno por precio',
        usuario: 'user-1',
      }],
    });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(entregada()))
      .mockResolvedValueOnce(jsonResponse({ propuesta: rechazada, advertencias: [] }));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Rechazada')).toBeTruthy());
    fireEvent.click(screen.getByText('Rechazada'));
    fireEvent.change(screen.getByPlaceholderText('Por qué la rechazó'), {
      target: { value: 'Se fue con Galeno por precio' },
    });
    fireEvent.click(screen.getByText('Marcar rechazada'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, opciones] = globalThis.fetch.mock.calls[1];
    expect(url).toContain('/art/propuestas/prop-1/estado');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({
      estado: 'RECHAZADA', nota: 'Se fue con Galeno por precio',
    });

    // El modal se cierra y la nota queda en la bitácora de la pantalla.
    await waitFor(() => expect(screen.queryByPlaceholderText('Por qué la rechazó')).toBeNull());
    expect(screen.getByText('Se fue con Galeno por precio')).toBeTruthy();
  });

  it('cancelar el modal no manda nada', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(entregada()));
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Aceptada')).toBeTruthy());
    fireEvent.click(screen.getByText('Aceptada'));
    fireEvent.change(screen.getByPlaceholderText('Por qué la aceptó'), {
      target: { value: 'Firmó' },
    });
    fireEvent.click(screen.getByText('Cancelar'));

    expect(screen.queryByPlaceholderText('Por qué la aceptó')).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('"Marcar entregada" NO pide motivo: entregar es un trámite', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta()))
      .mockResolvedValueOnce(jsonResponse({
        propuesta: propuesta({ estado: 'ENTREGADA', estado_efectivo: 'ENTREGADA' }),
        advertencias: [],
      }));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Marcar entregada')).toBeTruthy());
    fireEvent.click(screen.getByText('Marcar entregada'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(globalThis.fetch.mock.calls[1][1].body)).toEqual({ estado: 'ENTREGADA' });
  });
});

describe('ArtPropuestaDetalle - bitácora (T17)', () => {
  it('muestra el historial con el estado de cada entrada, en orden', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({
      estado: 'RECHAZADA',
      estado_efectivo: 'RECHAZADA',
      confianza_masa: 'CONFIRMADA',
      sujeta_a_f931: false,
      notas: [
        { fecha: '2026-09-10', estado: 'BORRADOR', nota: 'Pidió sin GNC', usuario: 'user-1' },
        { fecha: '2026-09-14', estado: 'RECHAZADA', nota: 'Se fue por precio', usuario: 'user-1' },
      ],
    })));
    renderDetalle();

    await waitFor(() => expect(screen.getByText('Bitácora de seguimiento')).toBeTruthy());

    const entradas = screen.getAllByRole('listitem');
    expect(entradas).toHaveLength(2);
    // Orden en que se escribieron: es una línea de tiempo, y leída al
    // revés una conversación no se entiende.
    expect(entradas[0].textContent).toContain('Pidió sin GNC');
    expect(entradas[1].textContent).toContain('Se fue por precio');
    // El estado de CADA entrada es el que tenía la propuesta al escribirla,
    // no el de hoy: eso es lo que hace que la lista cuente algo.
    expect(entradas[0].textContent).toContain('Borrador');
    expect(entradas[1].textContent).toContain('Rechazada');
    // El id de usuario (un UUID) no se muestra: en pantalla no dice nada.
    expect(screen.queryByText(/user-1/)).toBeNull();
  });

  it('sin notas lo dice, en vez de mostrar una lista vacía', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({ notas: [] })));
    renderDetalle();
    await waitFor(() => expect(screen.getByText(/Todavía no hay notas/)).toBeTruthy());
  });

  it('agregar una nota va por PATCH /nota y limpia el campo', async () => {
    const conNota = propuesta({
      estado: 'ACEPTADA', estado_efectivo: 'ACEPTADA',
      confianza_masa: 'CONFIRMADA', sujeta_a_f931: false,
      notas: [{ fecha: '2026-09-20', estado: 'ACEPTADA', nota: 'Pasó el endoso', usuario: 'user-1' }],
    });
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta({
        estado: 'ACEPTADA', estado_efectivo: 'ACEPTADA',
        confianza_masa: 'CONFIRMADA', sujeta_a_f931: false, notas: [],
      })))
      .mockResolvedValueOnce(jsonResponse(conNota));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Agregar nota')).toBeTruthy());

    const campo = screen.getByPlaceholderText('Agregar una nota de seguimiento');
    fireEvent.change(campo, { target: { value: 'Pasó el endoso' } });
    fireEvent.click(screen.getByText('Agregar nota'));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, opciones] = globalThis.fetch.mock.calls[1];
    expect(url).toContain('/art/propuestas/prop-1/nota');
    expect(opciones.method).toBe('PATCH');
    expect(JSON.parse(opciones.body)).toEqual({ nota: 'Pasó el endoso' });

    // Aceptada y todo, la nota entra: es la única escritura que acepta una
    // propuesta que ya salió de la oficina.
    await waitFor(() => expect(
      screen.getByPlaceholderText('Agregar una nota de seguimiento').value,
    ).toBe(''));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('un error al agregar no borra lo escrito', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse(propuesta({ notas: [] })))
      .mockResolvedValueOnce(errorResponse('nota no puede ser sólo espacios', 422));

    renderDetalle();
    await waitFor(() => expect(screen.getByText('Agregar nota')).toBeTruthy());
    fireEvent.change(screen.getByPlaceholderText('Agregar una nota de seguimiento'), {
      target: { value: 'Llamar el lunes' },
    });
    fireEvent.click(screen.getByText('Agregar nota'));

    await waitFor(() => expect(screen.getByText(/sólo espacios/)).toBeTruthy());
    expect(screen.getByPlaceholderText('Agregar una nota de seguimiento').value)
      .toBe('Llamar el lunes');
  });

  it('el botón de agregar está deshabilitado sin texto', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(propuesta({ notas: [] })));
    renderDetalle();
    await waitFor(() => expect(screen.getByText('Agregar nota')).toBeTruthy());
    expect(screen.getByText('Agregar nota').disabled).toBe(true);
  });
});
