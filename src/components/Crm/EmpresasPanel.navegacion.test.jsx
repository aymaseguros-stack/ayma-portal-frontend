// @vitest-environment jsdom
//
// D-NAV-1: el módulo ART completo pasó a ser la sub-pestaña "Universo ART" de
// CRM > Empresas, y la sub-pestaña que antes se llamaba "Cartera ART" pasó a
// "Verificación Contrato SRT".
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import EmpresasPanel from './EmpresasPanel';

beforeEach(() => {
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => [] }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('sub-pestañas de Empresas', () => {
  it('son Empresas · Grupos empresariales · Universo ART · Verificación Contrato SRT', async () => {
    render(<EmpresasPanel token="t" />);
    await waitFor(() => expect(screen.getByText('Empresas', { selector: 'h2' })).toBeTruthy());
    ['Empresas', 'Grupos empresariales', 'Universo ART', 'Verificación Contrato SRT']
      .forEach(l => expect(screen.getAllByText(l).length).toBeGreaterThan(0));
    expect(screen.queryByText('Cartera ART')).toBeNull();
  });

  it('Universo ART abre el módulo ART con "Universo" y "Relevamiento Tarifa"', async () => {
    render(<EmpresasPanel token="t" />);
    await waitFor(() => expect(screen.getByText('Universo ART')).toBeTruthy());
    fireEvent.click(screen.getByText('Universo ART'));
    await waitFor(() => expect(screen.getByText('Universo')).toBeTruthy());
    expect(screen.getByText('Relevamiento Tarifa')).toBeTruthy();
    expect(screen.queryByText('Relevamiento', { exact: true })).toBeNull();
    // El módulo entero sigue entero: sus demás sub-pestañas no se tocaron.
    ['Acción comercial', 'Desbloqueos', 'Técnica vencida', 'Referencial de Tarifas',
      'Leads Calientes', 'Análisis', 'Mercado', 'Performance']
      .forEach(l => expect(screen.getByText(l)).toBeTruthy());
  });
});
