// @vitest-environment jsdom
//
// D-NAV-1, punto 1: la pantalla de login dice "AYMA" (antes "Portal AYMA").
// El header interno no se toca.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('pantalla de login', () => {
  it('muestra "AYMA" y no "Portal AYMA"', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'AYMA' })).toBeTruthy();
    expect(screen.queryByText('Portal AYMA')).toBeNull();
    expect(screen.getByText('Gestión de Seguros')).toBeTruthy();
  });
});
