// @vitest-environment jsdom
//
// Oportunidad de empresa con contacto de referencia: la empresa es la
// titular y la persona la referencia, y se mandan los dos ids juntos.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import AltaEncadenada from './AltaEncadenada';
import { limpiarCacheEmpresas } from './empresasApi';

const EMPRESA = { tipo: 'empresa', id: 'e-1', token: 'tk', razon_social: 'ACME SRL' };
const PERSONA = { tipo: 'persona', id: 'p-1', token: 'tk', nombre: 'Ana', apellido: 'Díaz' };

let llamadas;
let respuestaBuscar;
let contactos;

const json = (data, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: async () => data });

beforeEach(() => {
  llamadas = [];
  contactos = [{ persona_id: 'p-vinculada', nombre: 'Juan', apellido: 'Pérez', rol: 'RRHH' }];
  respuestaBuscar = { personas: [PERSONA], empresas: [EMPRESA], total: 2 };
  limpiarCacheEmpresas();
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    llamadas.push({ url, metodo, body: opts.body ? JSON.parse(opts.body) : null });
    if (url.includes('/contactos')) return json(contactos);
    if (url.includes('/crm/buscar')) return json(respuestaBuscar);
    if (url.includes('/crm/personas') && metodo === 'POST') return json({ id: 'p-nueva', nombre: 'Nuevo', apellido: 'Contacto' });
    if (url.includes('/crm/empresas') && metodo === 'POST') return json({ id: 'e-nueva', razon_social: 'OTRA SRL' });
    if (url.includes('/crm/vinculos') && metodo === 'POST') return json({ id: 'v1' });
    if (url.includes('/crm/oportunidades') && metodo === 'POST') return json({ id: 'o-nueva' });
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const campo = (contenedor, etiqueta) => {
  const label = [...contenedor.querySelectorAll('label')].find((l) => l.textContent === etiqueta);
  if (!label) throw new Error(`No encontré el campo "${etiqueta}"`);
  return label.parentElement.querySelector('input, textarea, select');
};
const modal = (titulo) => screen.getByText(titulo, { selector: 'h3' }).closest('div.fixed');
const boton = (contenedor, texto) => {
  const b = [...contenedor.querySelectorAll('button')].find((x) => x.textContent.trim() === texto);
  if (!b) throw new Error(`No encontré el botón "${texto}"`);
  return b;
};
const posts = (fragmento) => llamadas.filter((l) => l.metodo === 'POST' && l.url.includes(fragmento));

const elegirEntidad = async (texto) => {
  const buscador = document.querySelector('input[placeholder="Buscar persona o empresa..."]');
  fireEvent.change(buscador, { target: { value: 'x' } });
  await waitFor(() => expect(screen.getByText(texto)).toBeTruthy(), { timeout: 2000 });
  fireEvent.click(screen.getByText(texto));
};

describe('oportunidad de empresa', () => {
  it('con empresa elegida aparece el contacto de referencia y se mandan los dos ids', async () => {
    render(<NuevaOportunidadModal token="tok" onClose={() => {}} onCreated={() => {}} />);
    await elegirEntidad('ACME SRL');

    await screen.findByText('Contacto de referencia');
    // Las personas ya vinculadas se sugieren primero, sin escribir nada.
    await screen.findByText('Personas vinculadas a esta empresa');
    fireEvent.click(screen.getByText((_, el) => el?.tagName === 'BUTTON' && el.textContent.includes('Juan')));

    fireEvent.change(campo(modal('Nueva oportunidad'), 'Track *'), { target: { value: 'ART' } });
    fireEvent.click(boton(modal('Nueva oportunidad'), 'Crear oportunidad'));

    await waitFor(() => expect(posts('/crm/oportunidades')).toHaveLength(1));
    expect(posts('/crm/oportunidades')[0].body).toMatchObject({
      empresa_id: 'e-1', persona_id: 'p-vinculada',
    });
  });

  it('con una persona (B2C) no hay segundo campo', async () => {
    render(<NuevaOportunidadModal token="tok" onClose={() => {}} onCreated={() => {}} />);
    await elegirEntidad('Ana Díaz');

    expect(screen.queryByText('Contacto de referencia')).toBeNull();
    fireEvent.change(campo(modal('Nueva oportunidad'), 'Track *'), { target: { value: 'ART' } });
    fireEvent.click(boton(modal('Nueva oportunidad'), 'Crear oportunidad'));

    await waitFor(() => expect(posts('/crm/oportunidades')).toHaveLength(1));
    expect(posts('/crm/oportunidades')[0].body).toMatchObject({ persona_id: 'p-1', empresa_id: null });
  });

  it('crear una persona desde una oportunidad con empresa: la empresa sigue siendo titular', async () => {
    render(<AltaEncadenada token="tok" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    await elegirEntidad('ACME SRL');
    await screen.findByText('Contacto de referencia');

    // "+ Nueva persona" del campo de referencia.
    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    const persona = modal('Nueva persona');
    fireEvent.change(campo(persona, 'Nombre *'), { target: { value: 'Nuevo' } });
    fireEvent.change(campo(persona, 'Rol del vínculo *'), { target: { value: 'GERENTE' } });
    fireEvent.click(boton(persona, 'Crear persona'));

    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());
    const oportunidad = modal('Nueva oportunidad');
    // La entidad titular sigue siendo la empresa; la persona bajó a referencia.
    expect(oportunidad.textContent).toContain('ACME SRL');
    fireEvent.change(campo(oportunidad, 'Track *'), { target: { value: 'ART' } });
    fireEvent.click(boton(oportunidad, 'Crear oportunidad'));

    await waitFor(() => expect(posts('/crm/oportunidades')).toHaveLength(1));
    expect(posts('/crm/oportunidades')[0].body).toMatchObject({
      empresa_id: 'e-1', persona_id: 'p-nueva',
    });
  });
});
