// @vitest-environment jsdom
//
// Tests del "Modo Relevamiento" (BLOQUE 8) - carga rápida de alícuotas por
// teléfono: GET /art/cola-alicuotas trae la tanda, POST
// /art/alicuotas/carga-rapida registra el lote completo al terminar (ver
// app/schemas/art_consultas.py::ColaAlicuotasResponse/
// CargaRapidaAlicuotasResponse del backend). Mismo patrón que el resto de
// Cartera ART: fetch mockeado con la forma exacta del contrato.
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, waitFor, cleanup, fireEvent } from '@testing-library/react';
import ArtRelevamientoAlicuotas from './ArtRelevamientoAlicuotas';

afterEach(cleanup);

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

const empresa = (n, extra = {}) => ({
  empresa_id: `emp-${n}`,
  cuit: `3012345678${n}`,
  cuit_formateado: `30-1234567${n}-9`,
  razon_social: `Empresa ${n} SA`,
  art_actual: 'Asociart ART S.A.',
  ciiu: '3710',
  dotacion: 42,
  dotacion_confianza: 'ALTA',
  ultima_alicuota_conocida: null,
  ...extra,
});

beforeEach(() => {
  vi.restoreAllMocks();
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

describe('ArtRelevamientoAlicuotas', () => {
  it('carga la tanda al montar y muestra la primera empresa con el contador 1/2', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total: 2, items: [empresa(1), empresa(2)] }),
    );

    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);

    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));
    expect(container.textContent).toContain('1 / 2');
    expect(container.textContent).toContain('30-12345671-9');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/cola-alicuotas?limit=20');
  });

  it('Enter con una alícuota válida avanza a la siguiente empresa', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total: 2, items: [empresa(1), empresa(2)] }),
    );
    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = container.querySelector('input[type="text"]');
    fireEvent.change(input, { target: { value: '5,96' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(container.textContent).toContain('Empresa 2 SA'));
    expect(container.textContent).toContain('2 / 2');
    expect(input.value).toBe('');
  });

  it('Escape marca "sin dato" y avanza; al completar la tanda envía el lote automáticamente', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ total: 2, items: [empresa(1), empresa(2)] })) // GET
      .mockResolvedValueOnce(jsonResponse({ // POST carga-rapida
        total: 2, escritos: 1, sin_dato: 1, ya_registrados: 0, errores: 0,
        items: [
          { empresa_id: 'emp-1', escrito: true, ya_registrado_hoy: false, error: null },
          { empresa_id: 'emp-2', escrito: true, ya_registrado_hoy: false, error: null },
        ],
      }, true, 201));

    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = () => container.querySelector('input[type="text"]');
    fireEvent.keyDown(input(), { key: 'Escape' }); // empresa 1: sin dato

    await waitFor(() => expect(container.textContent).toContain('Empresa 2 SA'));
    fireEvent.change(input(), { target: { value: '4.5' } });
    fireEvent.keyDown(input(), { key: 'Enter' }); // empresa 2: 4.5

    await waitFor(() => expect(container.textContent).toContain('Tanda enviada'));

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    const [url, init] = globalThis.fetch.mock.calls[1];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/alicuotas/carga-rapida');
    expect(JSON.parse(init.body)).toEqual({
      items: [
        { empresa_id: 'emp-1', sin_dato: true },
        { empresa_id: 'emp-2', sin_dato: false, alicuota_pct: 4.5 },
      ],
    });
    expect(container.textContent).toContain('Escritos');
  });

  it('flecha arriba vuelve a la empresa anterior y precarga la alícuota ya tipeada', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total: 2, items: [empresa(1), empresa(2)] }),
    );
    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = () => container.querySelector('input[type="text"]');
    fireEvent.change(input(), { target: { value: '7.2' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(container.textContent).toContain('Empresa 2 SA'));

    fireEvent.keyDown(input(), { key: 'ArrowUp' });
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));
    expect(input().value).toBe('7.2');
  });

  it('el botón "Copiar CUIT" copia el CUIT sin guiones', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ total: 1, items: [empresa(1)] }),
    );
    const { container, getByText } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    fireEvent.click(getByText('Copiar CUIT'));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('30123456781'));
  });

  it('cola vacía muestra un estado explícito, no un error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({ total: 0, items: [] }));
    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('No hay empresas pendientes'));
  });

  it('propaga un error de la API sin romper el render', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse({ detail: 'Internal Server Error' }, false, 500),
    );
    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Error 500'));
    expect(container.textContent).toContain('Reintentar');
  });

  // --- Autoguardado incremental cada 5 CUITs (a prueba de interrupciones) ---

  const tandaDe = (n) => Array.from({ length: n }, (_, i) => empresa(i + 1));

  const responderCon = (input, valor) => {
    fireEvent.change(input(), { target: { value: valor } });
    fireEvent.keyDown(input(), { key: 'Enter' });
  };

  it('al completar el 5º CUIT se dispara el POST automático de autoguardado', async () => {
    const items = tandaDe(20);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ total: 20, items })) // GET cola-alicuotas
      .mockResolvedValueOnce(jsonResponse({ // POST autoguardado del sub-lote 1-5
        total: 5, escritos: 5, sin_dato: 0, ya_registrados: 0, errores: 0,
        items: items.slice(0, 5).map((it) => ({ empresa_id: it.empresa_id, escrito: true, ya_registrado_hoy: false, error: null })),
      }, true, 201));

    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = () => container.querySelector('input[type="text"]');
    for (let i = 1; i <= 5; i += 1) responderCon(input, String(i));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const [url, init] = globalThis.fetch.mock.calls[1];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/alicuotas/carga-rapida');
    const body = JSON.parse(init.body);
    expect(body.items.map((it) => it.empresa_id)).toEqual(['emp-1', 'emp-2', 'emp-3', 'emp-4', 'emp-5']);
    await waitFor(() => expect(container.textContent).toContain('5/20 confirmados'));
  });

  it('si el autoguardado del 5º falla, los datos se mantienen en estado y se reintentan en el 10º', async () => {
    const items = tandaDe(20);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ total: 20, items })) // GET cola-alicuotas
      .mockResolvedValueOnce(jsonResponse({ detail: 'Internal Server Error' }, false, 500)) // autoguardado del 5º falla
      .mockResolvedValueOnce(jsonResponse({ // reintento en el 10º: manda 1-10 completo
        total: 10, escritos: 10, sin_dato: 0, ya_registrados: 0, errores: 0,
        items: items.slice(0, 10).map((it) => ({ empresa_id: it.empresa_id, escrito: true, ya_registrado_hoy: false, error: null })),
      }, true, 201));

    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = () => container.querySelector('input[type="text"]');
    for (let i = 1; i <= 5; i += 1) responderCon(input, String(i));

    await waitFor(() => expect(container.textContent).toContain('No se pudo autoguardar'));
    expect(container.textContent).toContain('0/20 confirmados');

    for (let i = 6; i <= 10; i += 1) responderCon(input, String(i));

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));
    const [url, init] = globalThis.fetch.mock.calls[2];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/alicuotas/carga-rapida');
    const body = JSON.parse(init.body);
    expect(body.items.map((it) => it.empresa_id)).toEqual(
      ['emp-1', 'emp-2', 'emp-3', 'emp-4', 'emp-5', 'emp-6', 'emp-7', 'emp-8', 'emp-9', 'emp-10'],
    );
    await waitFor(() => expect(container.textContent).toContain('10/20 confirmados'));
  });

  it('un 401 en el autoguardado muestra el cartel de sesión vencida y no vacía el buffer', async () => {
    const items = tandaDe(20);
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ total: 20, items })) // GET cola-alicuotas
      .mockResolvedValueOnce(jsonResponse({ detail: 'Unauthorized' }, false, 401)); // autoguardado del 5º -> token vencido

    const { container } = render(<ArtRelevamientoAlicuotas token="tok" />);
    await waitFor(() => expect(container.textContent).toContain('Empresa 1 SA'));

    const input = () => container.querySelector('input[type="text"]');
    for (let i = 1; i <= 5; i += 1) responderCon(input, String(i));

    await waitFor(() => expect(container.textContent).toContain('Sesión vencida'));
    expect(container.textContent).toContain('Reintentar envío');
    // el buffer de las 5 respuestas ya tipeadas sigue intacto en estado, listo para reintentar
    expect(container.textContent).toContain('5 de 20');
  });
});
