import { describe, it, expect } from 'vitest';
import {
  CRM_TAB_IDS,
  MAIL_TAB_IDS,
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

describe('submenús', () => {
  it('Seguros agrupa Pólizas y Siniestros', () => {
    expect(SEGUROS_TABS.map(t => t.label)).toEqual(['Pólizas', 'Siniestros']);
  });

  it('solo Mail, CRM y Seguros tienen submenú', () => {
    expect(Object.keys(SUB_TABS_POR_SECCION).sort()).toEqual(['crm', 'mail', 'seguros']);
    ['dashboard', 'clientes', 'denuncia', 'soporte'].forEach(s => {
      expect(SUB_TABS_POR_SECCION[s]).toBeUndefined();
    });
  });
});
