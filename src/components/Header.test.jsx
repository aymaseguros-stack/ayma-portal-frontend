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
import { CRM_TABS, MAIL_TABS, MARKETING_TABS, SEGUROS_TABS } from './navTabs';

// ScoringIndicator hace fetch al montar; lo neutralizamos.
vi.mock('./ScoringIndicator', () => ({ default: () => null }));

// Orden de la fila 1 para un ADMIN (el único rol que ve Dirección):
// izquierda = Dashboard · Mail · CRM | Dirección | Clientes · Seguros,
// derecha = Denuncia · Soporte.
const ITEMS_IZQUIERDA = ['Dashboard', 'Mail', 'CRM', 'Dirección', 'Clientes', 'Seguros'];
const ITEMS_DERECHA = ['Denuncia', 'Soporte'];
const ITEMS_SUPERIORES = [...ITEMS_IZQUIERDA, ...ITEMS_DERECHA];

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
  it('muestra los ítems en el orden acordado (Dirección detrás del toggle)', () => {
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
    expect(secciones).toEqual(['dashboard', 'mail', 'crm', 'direccion', 'clientes', 'seguros', 'denuncia', 'soporte']);

    // D-C24: las pestañas planas siguen siendo un clic. El botón "Marketing"
    // no navega -abre el desplegable-, así que se lo excluye de esta vuelta y
    // se verifica aparte que sus cuatro ítems sí navegan.
    const planas = CRM_TABS.filter(t => !t.grupo);
    planas.forEach(t => fireEvent.click(screen.getAllByText(t.label)[0]));
    expect(tabs).toEqual(planas.map(t => t.id));

    // El grupo: un clic lo abre y cada ítem lleva a SU ruta de siempre.
    // Agrupar no puede dejar una pantalla sin forma de llegar.
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.replace('▾', '').trim() === 'Marketing'));
    MARKETING_TABS.forEach((t) => {
      fireEvent.click(screen.getAllByText(t.label).at(-1));
      fireEvent.click(screen.getAllByRole('button').find(b => b.textContent.replace('▾', '').trim() === 'Marketing'));
    });
    expect(tabs.slice(planas.length)).toEqual(MARKETING_TABS.map(t => t.id));
  });
});

// Ningún divisor al borde del nav ni pegado a otro divisor.
const divisoresSanos = (izquierda) => {
  const hijos = Array.from(izquierda.querySelector('nav').children);
  const esDivisor = (el) => el && el.tagName !== 'BUTTON';
  if (esDivisor(hijos[0]) || esDivisor(hijos[hijos.length - 1])) return false;
  return hijos.every((el, i) => !esDivisor(el) || !esDivisor(hijos[i + 1]));
};

// El orden nuevo: Dirección pasa de ir después de Seguros a ir inmediatamente
// después del toggle Dashboard/Mail/CRM, con un divisor a cada lado. Para un
// rol que no ve Dirección los dos divisores quedarían juntos: se colapsan.
describe('orden de la fila 1 por rol', () => {
  const nav = () => screen.getByTestId('header-izquierda').querySelector('nav');
  const secuencia = () =>
    Array.from(nav().children).map((el) => (el.tagName === 'BUTTON' ? el.textContent : '|'));

  it('ADMIN: Dashboard · Mail · CRM | Dirección | Clientes · Seguros', () => {
    pintar('dashboard');
    expect(secuencia()).toEqual(
      ['Dashboard', 'Mail', 'CRM', '|', 'Dirección', '|', 'Clientes', 'Seguros']
    );
    expect(divisoresSanos(screen.getByTestId('header-izquierda'))).toBe(true);
  });

  // EMPLEADO y CLIENTE llegan al Header con el mismo flag (isAdmin=false:
  // esRolAdmin() es estricto), así que ven la misma fila 1. Este ajuste es
  // de orden: no toca permisos, por eso no se separan acá.
  it.each([['empleado'], ['cliente']])('%s: Dashboard | Seguros, con un solo divisor', (rol) => {
    pintar('polizas', { isAdmin: false, rol });
    expect(secuencia()).toEqual(['Dashboard', '|', 'Seguros']);
    expect(divisoresSanos(screen.getByTestId('header-izquierda'))).toBe(true);
  });
});

describe('reparto de la fila 1 en dos bloques', () => {
  const bloques = () => ({
    izquierda: screen.getByTestId('header-izquierda'),
    derecha: screen.getByTestId('header-derecha'),
  });
  const enBloque = (bloque, label) =>
    Array.from(bloque.querySelectorAll('button')).some((b) => b.textContent === label);

  it('Dirección, Clientes y Seguros viven en el bloque izquierdo, junto al logo', () => {
    pintar('dashboard');
    const { izquierda, derecha } = bloques();
    expect(izquierda.querySelector('h1').textContent).toBe('AYMA');
    ITEMS_IZQUIERDA.forEach((label) => {
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
    ['Mail', 'CRM', 'Clientes', 'Dirección'].forEach((l) => expect(enBloque(izquierda, l)).toBe(false));
    ['Denuncia', 'Soporte'].forEach((l) => expect(enBloque(derecha, l)).toBe(true));
    expect(divisoresSanos(izquierda)).toBe(true);
  });
});
