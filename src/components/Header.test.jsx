// @vitest-environment jsdom
//
// D-NAV-1: barra superior reorganizada. Se verifica (a) un solo ítem superior
// activo a la vez, (b) el submenú del CRM no aparece fuera de CRM, (c) que
// todas las pantallas del menú nuevo siguen siendo alcanzables y (d) el
// reparto de la fila 1 en dos bloques (izquierda pegada al logo, derecha
// contra el borde). El reparto se mide por estructura del DOM, no por píxeles:
// jsdom no hace layout.
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

describe('reparto de la fila 1 en dos bloques', () => {
  const bloques = () => ({
    izquierda: screen.getByTestId('header-izquierda'),
    derecha: screen.getByTestId('header-derecha'),
  });
  const enBloque = (bloque, label) =>
    Array.from(bloque.querySelectorAll('button')).some((b) => b.textContent === label);

  it('Clientes y Seguros viven en el bloque izquierdo, junto al logo', () => {
    pintar('dashboard');
    const { izquierda, derecha } = bloques();
    expect(izquierda.querySelector('h1').textContent).toBe('AYMA');
    ['Dashboard', 'Mail', 'CRM', 'Clientes', 'Seguros'].forEach((label) => {
      expect(enBloque(izquierda, label)).toBe(true);
      expect(enBloque(derecha, label)).toBe(false);
    });
  });

  it('Denuncia y Soporte viven en el bloque derecho, con Salir', () => {
    pintar('dashboard');
    const { izquierda, derecha } = bloques();
    ['Denuncia', 'Soporte', 'Salir'].forEach((label) => {
      expect(enBloque(derecha, label)).toBe(true);
      expect(enBloque(izquierda, label)).toBe(false);
    });
  });

  it('el único espacio elástico está entre los dos bloques', () => {
    pintar('dashboard');
    const { izquierda, derecha } = bloques();
    // El ml-auto del bloque derecho es el que empuja: la fila no usa
    // justify-between, que repartiría el hueco dentro del nav izquierdo.
    expect(derecha.className).toContain('ml-auto');
    expect(izquierda.parentElement.className).not.toContain('justify-between');
  });

  it('un CLIENTE mantiene el reparto con menos ítems y sin divisor colgando', () => {
    pintar('polizas', { isAdmin: false, rol: 'cliente' });
    const { izquierda, derecha } = bloques();
    ['Dashboard', 'Seguros'].forEach((l) => expect(enBloque(izquierda, l)).toBe(true));
    ['Mail', 'CRM', 'Clientes'].forEach((l) => expect(enBloque(izquierda, l)).toBe(false));
    ['Denuncia', 'Soporte'].forEach((l) => expect(enBloque(derecha, l)).toBe(true));

    // Ningún divisor al borde del nav ni pegado a otro divisor.
    const nav = izquierda.querySelector('nav');
    const hijos = Array.from(nav.children);
    const esDivisor = (el) => el.tagName !== 'BUTTON';
    expect(esDivisor(hijos[0])).toBe(false);
    expect(esDivisor(hijos[hijos.length - 1])).toBe(false);
    hijos.forEach((el, i) => {
      if (esDivisor(el)) expect(esDivisor(hijos[i + 1])).toBe(false);
    });
  });
});
