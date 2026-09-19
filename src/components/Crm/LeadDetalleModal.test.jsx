// @vitest-environment jsdom
//
// C-13 - el CRM guardaba datos del lead que no mostraba.
//
// El PR #175 del backend dejó de perder la atribución en el ALTA. Este test
// cubre la otra mitad: que lo que se guarda SE VEA. Un dato guardado que
// ninguna pantalla muestra es, para quien tiene que llamar al lead, un dato que
// no existe - y el modo de falla es silencioso, porque la pantalla se ve bien.
//
// Se asevera campo por campo, con el VALOR: un assert sobre la etiqueta
// ("utm_source") pasa igual si al lado dice "-".
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import LeadDetalleModal from './LeadDetalleModal';

const LEAD = {
  id: 'l-1',
  nombre: 'Juan Pérez',
  telefono: '3416952259',
  email: 'juan@example.com',
  codigo_postal: '2000',
  tipo_seguro: 'auto',
  cobertura: 'terceros_completo',
  estado: 'nuevo',
  origen: 'META_ADS',
  canal: 'hero_auto',
  utm_source: 'facebook',
  utm_medium: 'cpc',
  utm_campaign: 'auto-rosario-set26',
  utm_content: 'creativo-3',
  utm_term: 'seguro auto rosario',
  fbclid: 'fb.1.abc',
  gclid: 'gcl.xyz',
  page_url: 'https://aymaseguros.com.ar/?utm_source=facebook',
  mensaje: 'Quiero cotizar la F100 del 76',
  session_token: 'sess-123',
  created_at: '2026-09-19T14:35:00',
  vehiculo_marca: 'Ford',
  vehiculo_modelo: 'F100',
  vehiculo_anio: '1976',
};

beforeEach(() => {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const tab = (texto) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);

describe('LeadDetalleModal', () => {
  it('muestra los datos de contacto, el mensaje y el vehículo', () => {
    render(<LeadDetalleModal token="t" lead={LEAD} onClose={() => {}} />);

    for (const valor of [
      'juan@example.com', '2000', 'auto', 'terceros_completo',
      'Quiero cotizar la F100 del 76', 'Ford', 'F100', '1976',
    ]) {
      expect(document.body.textContent).toContain(valor);
    }
  });

  it('muestra la HORA y no sólo la fecha', () => {
    render(<LeadDetalleModal token="t" lead={LEAD} onClose={() => {}} />);
    // 19/09/2026 CON hora: sin la hora no se puede priorizar a quién llamar.
    // El formato exacto lo decide el ICU del runtime (12 h o 24 h), así que se
    // asevera que hay hh:mm, no un texto literal.
    expect(document.body.textContent).toMatch(/19\/9\/2026/);
    expect(document.body.textContent).toMatch(/\d{1,2}:\d{2}/);
  });

  it('la pestaña Atribución muestra los campos que el PR #175 persiste', () => {
    render(<LeadDetalleModal token="t" lead={LEAD} onClose={() => {}} />);
    fireEvent.click(tab('Atribución'));

    for (const valor of [
      'META_ADS', 'hero_auto', 'facebook', 'cpc', 'auto-rosario-set26',
      'creativo-3', 'seguro auto rosario', 'fb.1.abc', 'gcl.xyz', 'sess-123',
      'https://aymaseguros.com.ar/?utm_source=facebook',
    ]) {
      expect(document.body.textContent).toContain(valor);
    }
  });

  it('un lead sin datos de vehículo no muestra esos campos vacíos', () => {
    const sinVehiculo = { ...LEAD };
    delete sinVehiculo.vehiculo_marca;
    delete sinVehiculo.vehiculo_modelo;
    delete sinVehiculo.vehiculo_anio;
    render(<LeadDetalleModal token="t" lead={sinVehiculo} onClose={() => {}} />);
    expect(screen.queryByText('MARCA')).toBeNull();
    expect(screen.queryByText('MODELO')).toBeNull();
  });

  it('un lead sin atribución no rompe y no imprime undefined', () => {
    render(<LeadDetalleModal token="t" lead={{ id: 'l-2', nombre: 'Ana', telefono: '1', estado: 'nuevo', origen: 'landing', tipo_seguro: 'hogar', created_at: '2026-09-19T09:00:00' }} onClose={() => {}} />);
    fireEvent.click(tab('Atribución'));
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('null');
  });

  it('la pestaña Actividad sigue mostrando el timeline del lead', () => {
    render(<LeadDetalleModal token="t" lead={LEAD} onClose={() => {}} />);
    fireEvent.click(tab('Actividad'));
    expect(globalThis.fetch).toHaveBeenCalled();
    const urls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('l-1'))).toBe(true);
  });
});
