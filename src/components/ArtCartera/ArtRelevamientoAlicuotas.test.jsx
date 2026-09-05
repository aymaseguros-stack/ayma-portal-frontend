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
});
