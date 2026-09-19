// @vitest-environment jsdom
//
// El acto escrito a mano como interacción (caso Cristian Peralta,
// AYMA-OPP-20260915-4FF380A64DDC): asunto "ENTREGA COTIZACION", +2 puntos y
// el estado sin moverse.
//
// LO QUE FIJA ESTE TEST:
//   1. La ficha AVISA cuando una interacción lleva el asunto de un acto.
//   2. El aviso NO convierte nada: no se dispara ningún POST. El usuario
//      decide; lo único que hace el link es llevarlo al botón.
//   3. El botón "Registrar cotización entregada" está en la barra de acciones
//      de ESTE modal - el que se abre desde el Pipeline - en DATO y PROSPECTO.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import OportunidadFichaModal from './OportunidadFichaModal';
import { actoInsinuadoPor, normalizarAsunto } from './actosAMano';

const detalle = (extra = {}) => ({
  id: 'o-1', token: 'OPO-0001', track: 'AUTO', estado_crm: 'PROSPECTO',
  resultado: 'EN_CURSO', prima_estimada: null, nombre_vinculado: 'Cristian Peralta',
  persona_id: 'p-1', empresa_id: null, tareas: [], interacciones: [], adjuntos_count: 0,
  etapa_saida: 'SONDEO', origen: 'meta ad', notas: null,
  ...extra,
});

const interaccion = (asunto) => ({
  id: 'i-' + asunto, canal: 'WHATSAPP', direccion: 'OUT', asunto,
  resumen: null, fecha: '2026-09-15T14:00:00',
});

let llamadas;
let detalleActual;

const json = (data) => Promise.resolve({ ok: true, status: 200, json: async () => data });

beforeEach(() => {
  llamadas = [];
  detalleActual = detalle();
  globalThis.fetch = vi.fn((url, opts = {}) => {
    llamadas.push({ url: String(url), metodo: opts.method || 'GET' });
    if (String(url).includes('/crm/oportunidades/o-1')) return json(detalleActual);
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const boton = (texto) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);
const esperarFicha = async () => waitFor(() => expect(screen.getByText('OPO-0001')).toBeTruthy());

describe('normalización del asunto', () => {
  it('ignora acentos, signos y mayúsculas', () => {
    expect(normalizarAsunto('Entrega  Cotización!')).toBe('ENTREGA COTIZACION');
    expect(actoInsinuadoPor('Entrega cotización Sancor')).toBe('COTIZACION');
    expect(actoInsinuadoPor('EMISION póliza')).toBe('EMISION');
    expect(actoInsinuadoPor('Lo llamé, no atendió')).toBe(null);
    expect(actoInsinuadoPor('')).toBe(null);
    expect(actoInsinuadoPor(null)).toBe(null);
  });
});

describe('ficha de oportunidad · acto escrito a mano', () => {
  it('avisa cuando una interacción lleva el asunto de un acto, y no convierte nada', async () => {
    detalleActual = detalle({ interacciones: [interaccion('ENTREGA COTIZACION')] });
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    expect(document.body.textContent).toContain('Registrar cotización entregada');
    expect(document.body.textContent).toContain('NO mueve el estado');
    expect(document.body.textContent).toContain('NO se convierte sola');
    // Mostrar el aviso no escribe nada en el backend.
    expect(llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0);
  });

  it('no avisa cuando ninguna interacción parece un acto', async () => {
    detalleActual = detalle({ interacciones: [interaccion('Lo llamé, no atendió')] });
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();
    expect(document.body.textContent).not.toContain('NO se convierte sola');
  });

  it('ofrece el botón en DATO y en PROSPECTO', async () => {
    for (const estado of ['DATO', 'PROSPECTO']) {
      detalleActual = detalle({ estado_crm: estado });
      render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
      await esperarFicha();
      expect(boton('Registrar cotización entregada')).toBeTruthy();
      cleanup();
    }
  });
});
