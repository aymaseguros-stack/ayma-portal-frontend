// @vitest-environment jsdom
//
// C-4a3 · La salud dice la verdad: tres valores, no dos.
//
// El global puede valer DEGRADADO (ámbar) y trae `senales_degradadas[]`,
// que se listan APARTE de las señales en alerta. La tarjeta de WhatsApp
// pinta el veredicto del backend (OK / DEGRADADO / ALERTA) sin
// recalcularlo: hasta acá todo lo que no era ALERTA salía verde.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import SaludSistemaCard from './SaludSistemaCard';
import WhatsappSaludCard from './WhatsappSaludCard';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data, clone: () => ({ json: async () => data }),
  headers: { get: () => 'application/json' },
});
const servir = (data, status) => { globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(data, status))); };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const senal = (estado, extra = {}) => ({ estado, ...extra });

describe('estado global del sistema', () => {
  it('DEGRADADO va en ámbar y lista las señales degradadas', async () => {
    servir({
      estado: 'DEGRADADO', evaluado_en: '2026-09-24T12:00:00',
      senales_en_alerta: [], senales_degradadas: ['whatsapp'],
      senales: { captacion_total: senal('OK'), whatsapp: senal('DEGRADADO', { alertas: ['WHATSAPP_ENABLED=false'] }) },
    });
    render(<SaludSistemaCard token="t" />);
    const cartel = await screen.findByRole('status');
    expect(cartel.dataset.estado).toBe('DEGRADADO');
    expect(cartel.className).toMatch(/amber/);
    expect(cartel.className).not.toMatch(/green|red/);
    const degradadas = screen.getByTestId('senales-degradadas');
    expect(within(degradadas).getByText('whatsapp')).toBeTruthy();
    expect(screen.queryByTestId('senales-en-alerta')).toBeNull();
    expect(screen.getByText('WHATSAPP_ENABLED=false')).toBeTruthy();
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/api\/v1\/admin\/salud$/);
  });

  it('ALERTA va en rojo y separa alerta de degradadas', async () => {
    servir({
      estado: 'ALERTA', senales_en_alerta: ['vault_outbox'], senales_degradadas: ['whatsapp'],
      senales: { vault_outbox: senal('ALERTA'), whatsapp: senal('DEGRADADO') },
    });
    render(<SaludSistemaCard token="t" />);
    const cartel = await screen.findByRole('status');
    expect(cartel.className).toMatch(/red/);
    expect(within(screen.getByTestId('senales-en-alerta')).getByText('vault outbox')).toBeTruthy();
    expect(within(screen.getByTestId('senales-degradadas')).getByText('whatsapp')).toBeTruthy();
  });

  it('OK va en verde, sin listas', async () => {
    servir({ estado: 'OK', senales_en_alerta: [], senales_degradadas: [], senales: {} });
    render(<SaludSistemaCard token="t" />);
    const cartel = await screen.findByRole('status');
    expect(cartel.className).toMatch(/green/);
    expect(screen.queryByTestId('senales-degradadas')).toBeNull();
  });

  it('un error se muestra, no se pinta OK', async () => {
    servir({ detail: 'Sólo admin' }, 403);
    render(<SaludSistemaCard token="t" />);
    expect(await screen.findByText(/Sólo admin/)).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });
});

describe('tarjeta de WhatsApp', () => {
  const base = {
    alertas: [], faltan: [],
    configuracion: {
      WHATSAPP_ENABLED: true, WHATSAPP_APP_SECRET: true, WHATSAPP_VERIFY_TOKEN: true,
      WHATSAPP_ACCESS_TOKEN: true, WHATSAPP_PHONE_NUMBER_ID: true,
    },
    ultimas_24h_por_origen: {}, texto_por_estado: {}, media_por_estado: {},
  };

  it.each([
    ['OK', /green/],
    ['DEGRADADO', /amber/],
    ['ALERTA', /red/],
  ])('%s se pinta con su color', async (estado, color) => {
    servir({ ...base, estado });
    render(<WhatsappSaludCard token="t" />);
    const cartel = await screen.findByRole('status');
    expect(cartel.dataset.estado).toBe(estado);
    expect(cartel.textContent).toContain(estado);
    expect(cartel.className).toMatch(color);
  });

  it('DEGRADADO con credenciales vacías NO sale verde', async () => {
    servir({
      ...base, estado: 'DEGRADADO',
      faltan: ['WHATSAPP_APP_SECRET'],
      alertas: ['Falta WHATSAPP_APP_SECRET: el webhook contesta 503'],
      configuracion: { ...base.configuracion, WHATSAPP_APP_SECRET: false },
    });
    render(<WhatsappSaludCard token="t" />);
    const cartel = await screen.findByRole('status');
    expect(cartel.className).not.toMatch(/green/);
    expect(screen.getByText(/webhook contesta 503/)).toBeTruthy();
  });
});
