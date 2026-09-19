// @vitest-environment jsdom
//
// Módulo DIRECCIÓN: permisos y navegación. La entrada superior es ADMIN-only
// (el router del backend cuelga entero de require_admin), y estando en
// Dirección no puede quedar activa otra sección ni visible el submenú del CRM.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import Header from '../Header';
import { CRM_TABS, DIRECCION_TABS, SUB_TABS_POR_SECCION, seccionDeTab } from '../navTabs';

vi.mock('../ScoringIndicator', () => ({ default: () => null }));

const ITEMS_SUPERIORES = ['Dashboard', 'Mail', 'CRM', 'Clientes', 'Seguros', 'Dirección', 'Denuncia', 'Soporte'];
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

describe('entrada superior "Dirección"', () => {
  it('es visible para ADMIN, después de Seguros', () => {
    pintar('dashboard');
    const labels = screen.getAllByRole('button')
      .map(b => b.textContent)
      .filter(t => ITEMS_SUPERIORES.includes(t));
    expect(labels).toEqual(ITEMS_SUPERIORES);
    expect(labels.indexOf('Dirección')).toBe(labels.indexOf('Seguros') + 1);
  });

  // isAdmin=false cubre a EMPLEADO, CLIENTE y AGENTE por igual: el Header
  // recibe un booleano derivado de esRolAdmin(), no el rol crudo.
  it.each(['EMPLEADO', 'CLIENTE', 'AGENTE'])('no existe para %s', (rol) => {
    pintar('dashboard', { isAdmin: false, rol: rol.toLowerCase() });
    expect(screen.queryByText('Dirección')).toBeNull();
  });

  it('para un no-admin tampoco aparece el submenú de Dirección', () => {
    pintar('direccion-tablero', { isAdmin: false, rol: 'cliente' });
    DIRECCION_TABS.forEach((t) => expect(screen.queryByText(t.label)).toBeNull());
  });
});

describe('sección activa única', () => {
  it.each(DIRECCION_TABS.map(t => t.id))('en %s solo "Dirección" queda activo', (tab) => {
    pintar(tab);
    const activos = screen.getAllByRole('button')
      .filter(b => ITEMS_SUPERIORES.includes(b.textContent) && activo(b))
      .map(b => b.textContent);
    expect(activos).toEqual(['Dirección']);
  });

  it('seccionDeTab mapea cada tab de Dirección a la sección "direccion"', () => {
    DIRECCION_TABS.forEach((t) => expect(seccionDeTab(t.id)).toBe('direccion'));
  });

  it('los tabs de Dirección no se pisan con los de otras secciones', () => {
    const otros = Object.entries(SUB_TABS_POR_SECCION)
      .filter(([seccion]) => seccion !== 'direccion')
      .flatMap(([, tabs]) => tabs.map(t => t.id));
    DIRECCION_TABS.forEach((t) => expect(otros).not.toContain(t.id));
  });
});

describe('submenú', () => {
  it('en Dirección se muestran sus cuatro sub-pestañas', () => {
    pintar('direccion-tablero');
    ['Tablero', 'Gerencias', 'Proveedores', 'Seguridad'].forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
  });

  it('el submenú del CRM NO aparece estando en Dirección', () => {
    pintar('direccion-proveedores');
    // "Pipeline", "Oportunidades", "Agenda"... ninguno de los tabs del CRM
    // que no sea también un tab de Dirección.
    const idsDireccion = DIRECCION_TABS.map(t => t.label);
    CRM_TABS.filter(t => !idsDireccion.includes(t.label)).forEach((t) => {
      expect(screen.queryByText(t.label)).toBeNull();
    });
  });

  it('el submenú de Dirección NO aparece estando en el CRM', () => {
    pintar('crm');
    ['Tablero', 'Gerencias', 'Proveedores'].forEach((label) => {
      expect(screen.queryByText(label)).toBeNull();
    });
  });
});
