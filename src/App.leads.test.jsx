// @vitest-environment jsdom
//
// C-13, segunda mitad: la lista de Leads se relee al VOLVER a la pestaña.
//
// EL BUG QUE CIERRA. Los leads se cargaban una sola vez, junto con el
// dashboard, al loguearse. Con el portal abierto toda la mañana, entrar a la
// pestaña Leads mostraba la foto del login: los leads que entraron en el medio
// sólo aparecían con F5. En una pantalla de captación eso es un lead que nadie
// atiende, y no hay ninguna señal de que falte algo - la lista se ve completa.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import App from './App';

const lead = (id, nombre) => ({
  id, nombre, telefono: '3416952259', tipo_seguro: 'auto', estado: 'nuevo',
  origen: 'FORMULARIO_WEB', created_at: '2026-09-19T14:35:00',
});

let leadsServidos;
let gets;

const json = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 'tok');
  localStorage.setItem('user', JSON.stringify({ email: 'admin@ayma.com.ar', role: 'ADMIN' }));
  // Arranca en el dashboard para poder navegar a Leads como lo hace una persona.
  localStorage.setItem('ayma_panel_principal', 'dashboard');

  leadsServidos = [lead('l-1', 'Juan Pérez')];
  gets = [];
  globalThis.fetch = vi.fn((url) => {
    const texto = String(url);
    gets.push(texto);
    if (texto.includes('/api/v1/leads/')) return json(leadsServidos);
    if (texto.includes('/api/v1/dashboard/')) return json({ role: 'ADMIN' });
    return json([]);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const irATab = (label) => {
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === label);
  if (!btn) throw new Error(`No encontré la pestaña "${label}"`);
  fireEvent.click(btn);
};
const getsDeLeads = () => gets.filter((u) => u.includes('/api/v1/leads/'));

describe('pestaña Leads', () => {
  it('al entrar a la pestaña relee la lista, y un lead nuevo aparece sin recargar el portal', async () => {
    render(<App />);
    await waitFor(() => expect(getsDeLeads().length).toBeGreaterThan(0));
    const alLoguearse = getsDeLeads().length;

    // Entró un lead mientras el portal estaba abierto en otra pantalla.
    leadsServidos = [lead('l-1', 'Juan Pérez'), lead('l-2', 'Ana Gómez')];

    irATab('CRM');
    irATab('Leads');

    await waitFor(() => expect(getsDeLeads().length).toBeGreaterThan(alLoguearse));
    await waitFor(() => expect(screen.getByText('Ana Gómez')).toBeTruthy());
  });

  it('la columna de fecha muestra la hora', async () => {
    render(<App />);
    await waitFor(() => expect(getsDeLeads().length).toBeGreaterThan(0));
    irATab('CRM');
    irATab('Leads');

    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());
    // Sin la hora, dos leads del mismo día se ven iguales y no se puede
    // priorizar a quién llamar primero.
    expect(document.body.textContent).toMatch(/\d{2}\/\d{2}\/\d{2},?\s+\d{1,2}:\d{2}/);
  });

  it('el botón abre la ficha del lead con la atribución, no sólo el timeline', async () => {
    leadsServidos = [{
      ...lead('l-1', 'Juan Pérez'),
      email: 'juan@example.com',
      utm_source: 'facebook',
      page_url: 'https://aymaseguros.com.ar/?utm_source=facebook',
      mensaje: 'Quiero cotizar la F100 del 76',
    }];
    render(<App />);
    await waitFor(() => expect(getsDeLeads().length).toBeGreaterThan(0));
    irATab('CRM');
    irATab('Leads');
    await waitFor(() => expect(screen.getByText('Juan Pérez')).toBeTruthy());

    irATab('Ver detalle');
    await waitFor(() => expect(screen.getByText('Lead · Juan Pérez', { selector: 'h3' })).toBeTruthy());
    expect(document.body.textContent).toContain('juan@example.com');
    expect(document.body.textContent).toContain('Quiero cotizar la F100 del 76');

    irATab('Atribución');
    expect(document.body.textContent).toContain('facebook');
    expect(document.body.textContent).toContain('https://aymaseguros.com.ar/?utm_source=facebook');
  });
});
