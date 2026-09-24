// @vitest-environment jsdom
//
// D-C33 · La etapa SAIDA se deriva en el backend, no se tipea.
//
// QUÉ DEFIENDE:
//   1. El alta NO tiene selector de etapa SAIDA y el POST no la manda (el
//      backend la ignora con WARNING; mandarla es prometer algo que no se
//      guarda).
//   2. La ficha la muestra como dato de sólo lectura, con el tooltip, y la
//      RELEE del backend después de cada acción: el valor que se ve es el
//      recalculado, no uno pintado por el front.
//   3. La tarjeta del pipeline la muestra con el mismo tooltip.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import NuevaOportunidadModal from './NuevaOportunidadModal';
import OportunidadFichaModal from './OportunidadFichaModal';
import { EtapaSaidaChip, TOOLTIP_ETAPA_SAIDA } from './EtapaSaida';
import { limpiarCacheEmpresas } from './empresasApi';

const TOOLTIP = 'Se calcula sola según el estado y los actos registrados';

const json = (data, ok = true, status = 200) => Promise.resolve({ ok, status, json: async () => data });

let llamadas;
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('alta de oportunidad', () => {
  beforeEach(() => {
    llamadas = [];
    limpiarCacheEmpresas();
    globalThis.fetch = vi.fn((url, opts = {}) => {
      const metodo = opts.method || 'GET';
      llamadas.push({ url, metodo, body: opts.body ? JSON.parse(opts.body) : null });
      if (url.includes('/crm/buscar')) {
        return json({ personas: [{ tipo: 'persona', id: 'p-1', nombre: 'Ana', apellido: 'Díaz' }], empresas: [], total: 1 });
      }
      if (url.includes('/crm/oportunidades') && metodo === 'POST') return json({ id: 'o-nueva' });
      return json({});
    });
  });

  it('no ofrece "Etapa SAIDA" y el POST no la manda', async () => {
    render(<NuevaOportunidadModal token="tok" onClose={() => {}} onCreated={() => {}} />);
    expect(screen.queryByText('Etapa SAIDA')).toBeNull();
    expect([...document.querySelectorAll('option')].some((o) => o.value === 'SONDEO')).toBe(false);

    const buscador = document.querySelector('input[placeholder="Buscar persona o empresa..."]');
    fireEvent.change(buscador, { target: { value: 'ana' } });
    await waitFor(() => expect(screen.getByText('Ana Díaz')).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(screen.getByText('Ana Díaz'));

    const modal = screen.getByText('Nueva oportunidad', { selector: 'h3' }).closest('div.fixed');
    const track = [...modal.querySelectorAll('label')].find((l) => l.textContent === 'Track *')
      .parentElement.querySelector('select');
    fireEvent.change(track, { target: { value: 'AUTO' } });
    fireEvent.click([...modal.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Crear oportunidad'));

    await waitFor(() => expect(llamadas.filter((l) => l.metodo === 'POST' && l.url.includes('/crm/oportunidades'))).toHaveLength(1));
    const post = llamadas.find((l) => l.metodo === 'POST' && l.url.includes('/crm/oportunidades'));
    expect(post.body).not.toHaveProperty('etapa_saida');
  });
});

describe('ficha de oportunidad', () => {
  const detalle = (extra = {}) => ({
    id: 'o-1', token: 'OPO-0001', track: 'AUTO', estado_crm: 'PROSPECTO',
    resultado: 'EN_CURSO', prima_estimada: null, nombre_vinculado: 'Juan Pérez',
    persona_id: 'p-1', empresa_id: null, tareas: [], adjuntos_count: 0,
    etapa_saida: 'ATENCION', origen: 'landing', notas: null,
    ...extra,
  });
  let detalleActual;

  beforeEach(() => {
    llamadas = [];
    detalleActual = detalle();
    globalThis.fetch = vi.fn((url, opts = {}) => {
      const metodo = opts.method || 'GET';
      const texto = String(url);
      llamadas.push({ url: texto, metodo });
      if (texto.includes('/cotizacion-entregada')) {
        // El backend recalcula: POTENCIAL con acto COTIZACION -> INTERES.
        detalleActual = detalle({ estado_crm: 'POTENCIAL', etapa_saida: 'INTERES' });
        return json({ estado_crm: 'POTENCIAL', estado_cambio: true, puntos: '13' }, true, 201);
      }
      if (texto.includes('/crm/oportunidades/o-1') && metodo === 'GET') return json(detalleActual);
      if (texto.includes('/crm/adjuntos')) return json({ adjuntos: [], duplicados: [] });
      return json({});
    });
  });

  it('la etapa es de sólo lectura, con tooltip, y se relee tras la cotización', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    const dato = await screen.findByTestId('etapa-saida-dato');
    expect(dato.textContent).toContain('ATENCION');
    expect(dato.querySelector(`[title="${TOOLTIP}"]`)).toBeTruthy();
    expect(dato.querySelector('select, input')).toBeNull();

    const gets = () => llamadas.filter((l) => l.metodo === 'GET' && l.url.endsWith('/crm/oportunidades/o-1')).length;
    const antes = gets();

    const boton = (t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t);
    fireEvent.click(boton('Registrar cotización entregada'));
    fireEvent.change(screen.getByLabelText('Compañía *'), { target: { value: 'San Cristóbal' } });
    fireEvent.change(screen.getByLabelText('Premio *'), { target: { value: '185000' } });
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(screen.getByTestId('etapa-saida-dato').textContent).toContain('INTERES'));
    expect(gets()).toBeGreaterThan(antes);
  });
});

describe('tarjeta del pipeline', () => {
  it('muestra la etapa con el mismo tooltip, y nada si no hay etapa', () => {
    expect(TOOLTIP_ETAPA_SAIDA).toBe(TOOLTIP);
    const { container, rerender } = render(<EtapaSaidaChip valor="DESEO" />);
    const chip = screen.getByText('DESEO');
    expect(chip.getAttribute('title')).toContain(TOOLTIP);
    rerender(<EtapaSaidaChip valor={null} />);
    expect(container.textContent).toBe('');
  });
});
