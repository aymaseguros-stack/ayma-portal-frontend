import { describe, it, expect } from 'vitest';
import {
  CRM_TAB_IDS,
  DIRECCION_TABS,
  DIRECCION_TAB_IDS,
  MAIL_TAB_IDS,
  MARKETING_TABS,
  MARKETING_TAB_IDS,
  SEGUROS_TABS,
  SEGUROS_TAB_IDS,
  SUB_TABS_POR_SECCION,
  seccionDeTab,
} from './navTabs';

// D-NAV-1: la sección superior activa se deriva del activeTab. Antes eran
// dos estados independientes (panelPrincipal + activeTab) y por eso, estando
// en Siniestros, CRM quedaba resaltado con su submenú abierto.
describe('seccionDeTab', () => {
  it('asigna una sola sección a cada tab de la barra superior', () => {
    expect(seccionDeTab('dashboard')).toBe('dashboard');
    expect(seccionDeTab('clientes')).toBe('clientes');
    expect(seccionDeTab('siniestro')).toBe('denuncia');
    expect(seccionDeTab('soporte')).toBe('soporte');
    MAIL_TAB_IDS.forEach(t => expect(seccionDeTab(t)).toBe('mail'));
    CRM_TAB_IDS.forEach(t => expect(seccionDeTab(t)).toBe('crm'));
    SEGUROS_TAB_IDS.forEach(t => expect(seccionDeTab(t)).toBe('seguros'));
  });

  it('Siniestros (y su sub-pestaña Resueltos) es Seguros, nunca CRM', () => {
    expect(seccionDeTab('admin-siniestros')).toBe('seguros');
    expect(seccionDeTab('siniestros-resueltos')).toBe('seguros');
  });

  it('las pantallas fuera de la barra no activan ninguna sección', () => {
    expect(seccionDeTab('seguridad')).toBeNull();
    expect(seccionDeTab('datos')).toBeNull();
  });
});

// C-12B: Puntos de contacto y Comisiones de referido entran como
// SUB-PESTAÑAS del CRM (decisión D-C12-1: sin ítem nuevo de menú), no como
// una entrada nueva de la barra superior. Si alguien las moviera de sección,
// el submenú del CRM dejaría de mostrarlas estando parado en ellas.
describe('puntos de contacto y comisiones de referido (C-12B)', () => {
  it('son tabs del CRM, no una sección nueva de la barra superior', () => {
    expect(seccionDeTab('puntos-contacto')).toBe('crm');
    expect(seccionDeTab('comisiones-referido')).toBe('crm');
  });

  // D-C24: Puntos de contacto pasó al desplegable "Marketing" y Comisiones de
  // referido quedó plana. Lo que se sigue exigiendo es lo de C-12B -que las
  // dos se ALCANCEN desde el submenú del CRM-, no en qué lugar de la fila
  // están: agrupar no puede ser una forma de esconder.
  it('se alcanzan desde el submenú del CRM', () => {
    const planas = SUB_TABS_POR_SECCION.crm.map(t => t.id);
    const alcanzables = [...planas, ...MARKETING_TAB_IDS];
    expect(alcanzables).toContain('puntos-contacto');
    expect(planas).toContain('comisiones-referido');
  });
});

// D-C24: el grupo "Marketing" agrupa cuatro pestañas que ya existían. Las
// RUTAS no cambian -sus ids son los de siempre- y por eso `seccionDeTab` las
// tiene que seguir devolviendo como CRM: si no, estando en Compliance el CRM
// dejaría de estar resaltado y su sub-menú desaparecería.
describe('grupo Marketing (D-C24)', () => {
  it('agrupa Marketing, Puntos de contacto, Compliance e Intelligence', () => {
    expect(MARKETING_TABS.map(t => t.id)).toEqual([
      'marketing', 'puntos-contacto', 'compliance', 'intelligence',
    ]);
  });

  it('las cuatro siguen siendo del CRM', () => {
    MARKETING_TAB_IDS.forEach(id => expect(seccionDeTab(id)).toBe('crm'));
  });

  it('el pseudo-id del grupo no es una ruta', () => {
    // 'grupo-marketing' existe sólo para dibujar el botón. Si se colara en
    // CRM_TAB_IDS, `seccionDeTab` lo trataría como una pantalla que no existe.
    expect(CRM_TAB_IDS).not.toContain('grupo-marketing');
  });

  it('Comisiones de referido queda FUERA del grupo', () => {
    // Es dinero, no marketing (pedido D-C24).
    expect(MARKETING_TAB_IDS).not.toContain('comisiones-referido');
    expect(SUB_TABS_POR_SECCION.crm.map(t => t.id)).toContain('comisiones-referido');
  });
});

describe('submenús', () => {
  it('Seguros agrupa Pólizas y Siniestros', () => {
    expect(SEGUROS_TABS.map(t => t.label)).toEqual(['Pólizas', 'Siniestros']);
  });

  it('solo Mail, CRM, Seguros y Dirección tienen submenú', () => {
    expect(Object.keys(SUB_TABS_POR_SECCION).sort()).toEqual(['crm', 'direccion', 'mail', 'seguros']);
    ['dashboard', 'clientes', 'denuncia', 'soporte'].forEach(s => {
      expect(SUB_TABS_POR_SECCION[s]).toBeUndefined();
    });
  });
});

// F-11: FINANZAS entra al submenú de Dirección. Es ADITIVO: las cuatro
// entradas que ya existían conservan su id y su orden relativo.
describe('submenú de Dirección', () => {
  it('es Tablero · Gerencias · Proveedores · Finanzas · Seguridad', () => {
    expect(DIRECCION_TABS.map(t => t.label)).toEqual([
      'Tablero', 'Gerencias', 'Proveedores', 'Finanzas', 'Seguridad',
    ]);
  });

  it('el tab de Finanzas pertenece a la sección Dirección', () => {
    expect(DIRECCION_TAB_IDS).toContain('direccion-finanzas');
    expect(seccionDeTab('direccion-finanzas')).toBe('direccion');
  });
});
