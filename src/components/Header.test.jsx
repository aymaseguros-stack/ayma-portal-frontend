// @vitest-environment jsdom
//
// D-NAV-1: barra superior reorganizada. Se verifica (a) un solo ítem superior
// activo a la vez, (b) el submenú del CRM no aparece fuera de CRM, y (c) que
// todas las pantallas del menú nuevo siguen siendo alcanzables.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Header from './Header';
import { CRM_TABS, MAIL_TABS, SEGUROS_TABS } from './navTabs';

// ScoringIndicator hace fetch al montar; lo neutralizamos.
vi.mock('./ScoringIndicator', () => ({ default: () => null }));

const ITEMS_SUPERIORES = ['Dashboard', 'Mail', 'CRM', 'Clientes', 'Seguros', 'Denuncia', 'Soporte'];

const activo = (boton) => boton.className.includes('bg-blue-600');

const pintar = (activeTab, props = {}) =>
  render(
    <Header
      displayName="Seba"
      rol="admin"
      activeTab={activeTab}
      setActiveTab={() => {}}
      isAdmin
      onLogout={() => {}}
      token="t"
      onSeccionChange={() => {}}
      {...props}
    />
  );

beforeEach(() => { globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('barra superior', () => {
  it('muestra los ítems en el orden acordado', () => {
    pintar('dashboard');
    const labels = screen.getAllByRole('button')
      .map(b => b.textContent)
      .filter(t => ITEMS_SUPERIORES.includes(t));
    expect(labels).toEqual(ITEMS_SUPERIORES);
  });

  it('no existe más el ítem superior "Cartera ART"', () => {
    pintar('dashboard');
    expect(screen.queryByText('Cartera ART')).toBeNull();
  });

  it('un solo ítem superior activo a la vez', () => {
    const casos = ['dashboard', 'mail-bandeja', 'crm', 'clientes', 'polizas', 'admin-siniestros', 'siniestros-resueltos', 'siniestro', 'soporte'];
    casos.forEach((tab) => {
      cleanup();
      pintar(tab);
      const activos = screen.getAllByRole('button')
        .filter(b => ITEMS_SUPERIORES.includes(b.textContent) && activo(b));
      expect(activos.map(b => b.textContent)).toHaveLength(1);
    });
  });

  it('estando en Siniestros el activo es Seguros, no CRM', () => {
    pintar('admin-siniestros');
    const porLabel = (l) => screen.getAllByRole('button').find(b => b.textContent === l);
    expect(activo(porLabel('Seguros'))).toBe(true);
    expect(activo(porLabel('CRM'))).toBe(false);
  });
});

describe('submenú', () => {
  it('el submenú del CRM se ve solo dentro de CRM', () => {
    pintar('crm');
    CRM_TABS.forEach(t => expect(screen.getAllByText(t.label).length).toBeGreaterThan(0));

    ['dashboard', 'mail-bandeja', 'clientes', 'polizas', 'admin-siniestros', 'siniestro', 'soporte'].forEach((tab) => {
      cleanup();
      pintar(tab);
      expect(screen.queryByText('Pipeline')).toBeNull();
      expect(screen.queryByText('Intelligence')).toBeNull();
    });
  });

  it('Seguros muestra Pólizas y Siniestros; Mail su propio submenú', () => {
    pintar('polizas');
    SEGUROS_TABS.forEach(t => expect(screen.getByText(t.label)).toBeTruthy());
    cleanup();
    pintar('mail-bandeja');
    MAIL_TABS.forEach(t => expect(screen.getByText(t.label)).toBeTruthy());
    expect(screen.queryByText('Pólizas')).toBeNull();
  });

  it('para un cliente (no admin) Seguros solo ofrece Pólizas', () => {
    pintar('polizas', { isAdmin: false });
    expect(screen.getByText('Pólizas')).toBeTruthy();
    expect(screen.queryByText('Siniestros')).toBeNull();
  });
});

describe('alcanzabilidad', () => {
  it('toda pantalla del menú nuevo se alcanza con un click de sección o submenú', () => {
    const secciones = [];
    const tabs = [];
    cleanup();
    render(
      <Header
        displayName="Seba" rol="admin" activeTab="crm" isAdmin token="t"
        onLogout={() => {}}
        setActiveTab={(t) => tabs.push(t)}
        onSeccionChange={(s) => secciones.push(s)}
      />
    );
    ITEMS_SUPERIORES.forEach((label) => {
      fireEvent.click(screen.getAllByRole('button').find(b => b.textContent === label));
    });
    expect(secciones).toEqual(['dashboard', 'mail', 'crm', 'clientes', 'seguros', 'denuncia', 'soporte']);

    CRM_TABS.forEach(t => fireEvent.click(screen.getAllByText(t.label)[0]));
    expect(tabs).toEqual(CRM_TABS.map(t => t.id));
  });
});
