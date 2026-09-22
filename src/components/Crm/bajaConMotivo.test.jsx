// @vitest-environment jsdom
//
// C-6l: la baja con motivo, y disponible desde el Pipeline.
//
// QUÉ DEFIENDE CADA BLOQUE:
//
// 1. LA FICHA ABIERTA DESDE EL PIPELINE MUESTRA "ELIMINAR" A UN ADMIN. Era
//    el bug: PipelineKanban no pasaba `esAdmin`, así que el botón no se
//    dibujaba y no había ningún error a la vista - sólo un botón que
//    faltaba. El rol ahora sale de la sesión, así que ninguna pantalla lo
//    puede olvidar. Y a un EMPLEADO sigue sin aparecer, porque el DELETE es
//    `require_admin` y ofrecer un botón que rebota es hacer perder el viaje.
// 2. EL MOTIVO ES OBLIGATORIO, y sin default: el backend contesta 422 sin
//    él, y abrir con "Prueba" marcada haría que un duplicado se asiente
//    como prueba sin que nadie lo haya elegido. Con "Otro" hace falta el
//    detalle, también por contrato del backend.
// 3. UN PEDIDO POR CLIC (H-66). Dos DELETE es el segundo pegándole a una
//    oportunidad que la primera ya sacó de las pantallas.
// 4. EL 409 SE LEE. En la persona el 409 trae LA LISTA de oportunidades
//    vivas: es lo que hay que resolver, no un error de sistema, y mostrarlo
//    como "Error 409" perdería justo el dato útil.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PipelineKanban from './PipelineKanban';
import PersonasPanel from './PersonasPanel';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data, clone: () => ({ json: async () => data }),
});

let pedidos = [];
const registrar = (url, init) => pedidos.push({ url: String(url), metodo: init?.method || 'GET' });

const sesionComo = (rol) => localStorage.setItem('ayma_rol', rol);

beforeEach(() => { pedidos = []; localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const OPORTUNIDAD = {
  id: 'opp1', token: 'AYMA-OPP-1', track: 'AUTO', estado_crm: 'DATO',
  resultado: 'EN_CURSO', prima_estimada: 41000, origen: 'REFERIDO',
  interacciones: [], tareas: [], adjuntos_count: 0,
};

const PIPELINE = {
  columnas: [{
    estado_crm: 'DATO', cantidad: 1, prima_estimada_total: 41000,
    oportunidades: [{
      id: 'opp1', token: 'AYMA-OPP-1', nombre_vinculado: 'Juan Pérez', track: 'AUTO',
      prima_estimada: 41000, estado_crm: 'DATO', updated_at: '2026-09-21T10:00:00',
    }],
  }],
};

const servidorPipeline = (respuestaDelete = respuesta({ mensaje: 'ok' })) => vi.fn((url, init) => {
  registrar(url, init);
  const u = String(url);
  if (init?.method === 'DELETE') return Promise.resolve(respuestaDelete);
  if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta([]));
  if (/\/oportunidades\/opp1(\?|$)/.test(u)) return Promise.resolve(respuesta(OPORTUNIDAD));
  if (u.includes('/pipeline')) return Promise.resolve(respuesta(PIPELINE));
  return Promise.resolve(respuesta([]));
});

const abrirFichaDelPipeline = async () => {
  fireEvent.click(await screen.findByText(/Juan Pérez/));
  return screen.findByRole('button', { name: /Registrar interacción/i });
};

describe('la ficha abierta desde el Pipeline conoce el rol (C-6l punto 1)', () => {
  it('un ADMIN ve "Eliminar oportunidad"', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPipeline();
    render(<PipelineKanban token="t" />);
    await abrirFichaDelPipeline();
    expect(await screen.findByRole('button', { name: /Eliminar oportunidad/i })).toBeTruthy();
  });

  it('un EMPLEADO no lo ve', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorPipeline();
    render(<PipelineKanban token="t" />);
    await abrirFichaDelPipeline();
    expect(screen.queryByRole('button', { name: /Eliminar oportunidad/i })).toBeNull();
  });

  it('el rol guardado en `user` de una sesión vieja también alcanza', async () => {
    localStorage.setItem('user', JSON.stringify({ tipo_usuario: 'TipoUsuario.ADMIN' }));
    globalThis.fetch = servidorPipeline();
    render(<PipelineKanban token="t" />);
    await abrirFichaDelPipeline();
    expect(await screen.findByRole('button', { name: /Eliminar oportunidad/i })).toBeTruthy();
  });
});

describe('el motivo es obligatorio (C-6l punto 2)', () => {
  const abrirBaja = async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPipeline();
    render(<PipelineKanban token="t" />);
    await abrirFichaDelPipeline();
    fireEvent.click(screen.getByRole('button', { name: /Eliminar oportunidad/i }));
    return screen.findByLabelText(/Escribí ELIMINAR/i);
  };

  it('ningún motivo viene marcado y sin motivo no se puede confirmar', async () => {
    const input = await abrirBaja();
    for (const label of ['Prueba', 'Duplicado', 'Error de carga', 'Otro']) {
      expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('false');
    }
    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    expect(screen.getByRole('button', { name: /^Confirmar baja$/ }).disabled).toBe(true);
    expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(0);
  });

  it('con motivo "Otro" el detalle también es obligatorio', async () => {
    const input = await abrirBaja();
    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    expect(screen.getByRole('button', { name: /^Confirmar baja$/ }).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Detalle/i), { target: { value: 'pedido del titular' } });
    expect(screen.getByRole('button', { name: /^Confirmar baja$/ }).disabled).toBe(false);
  });

  it('el motivo y el detalle viajan en el DELETE', async () => {
    const input = await abrirBaja();
    fireEvent.click(screen.getByRole('button', { name: 'Otro' }));
    fireEvent.change(screen.getByLabelText(/Detalle/i), { target: { value: 'carga cruzada' } });
    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar baja$/ }));

    await waitFor(() => expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(1));
    const { url } = pedidos.find((p) => p.metodo === 'DELETE');
    expect(url).toContain('motivo_baja=OTRO');
    expect(url).toContain('detalle=carga+cruzada');
  });

  it('el texto dice qué pasa y qué queda', async () => {
    await abrirBaja();
    expect(screen.getByText(/La oportunidad sale del Pipeline y de las métricas\. Queda la constancia\./)).toBeTruthy();
  });

  it('doble clic manda UN solo pedido (H-66)', async () => {
    const input = await abrirBaja();
    fireEvent.click(screen.getByRole('button', { name: 'Prueba' }));
    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    const confirmar = screen.getByRole('button', { name: /^Confirmar baja$/ });
    fireEvent.click(confirmar);
    fireEvent.click(confirmar);
    await waitFor(() => expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(1));
  });

  it('el 409 del backend se muestra tal cual', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPipeline(respuesta(
      { detail: 'Primero purgá los datos de la solicitud de emisión: s1' }, 409,
    ));
    render(<PipelineKanban token="t" />);
    await abrirFichaDelPipeline();
    fireEvent.click(screen.getByRole('button', { name: /Eliminar oportunidad/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Prueba' }));
    fireEvent.change(screen.getByLabelText(/Escribí ELIMINAR/i), { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar baja$/ }));

    expect(await screen.findByText(/Primero purgá los datos de la solicitud de emisión: s1/)).toBeTruthy();
  });
});

describe('baja de persona (C-6l punto 3)', () => {
  const PERSONA = { id: 'p1', nombre: 'Juan', apellido: 'Pérez', token: 'AYMA-PER-1' };
  const FICHA = {
    ...PERSONA, tipo_documento: 'DNI', numero_documento: '30111222',
    empresas: [], grupos: [], oportunidades: [], interacciones: [], adjuntos_count: 0,
  };

  const servidorPersonas = (respuestaDelete = respuesta({ mensaje: 'Persona dada de baja' })) =>
    vi.fn((url, init) => {
      registrar(url, init);
      const u = String(url);
      if (init?.method === 'DELETE') return Promise.resolve(respuestaDelete);
      if (u.includes('/personas/p1/ficha')) return Promise.resolve(respuesta(FICHA));
      if (u.includes('/personas')) return Promise.resolve(respuesta([PERSONA]));
      return Promise.resolve(respuesta([]));
    });

  const abrirFicha = async () => {
    fireEvent.click(await screen.findByText(/Pérez/));
    return screen.findByText('AYMA-PER-1');
  };

  it('sólo un ADMIN ve "Dar de baja persona"', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorPersonas();
    render(<PersonasPanel token="t" />);
    await abrirFicha();
    expect(screen.queryByRole('button', { name: /Dar de baja persona/i })).toBeNull();
  });

  it('el ADMIN da de baja con motivo y el DELETE lo lleva', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPersonas();
    render(<PersonasPanel token="t" />);
    await abrirFicha();
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja persona/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicado' }));
    fireEvent.change(screen.getByLabelText(/Escribí ELIMINAR/i), { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar baja$/ }));

    await waitFor(() => expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(1));
    const { url } = pedidos.find((p) => p.metodo === 'DELETE');
    expect(url).toContain('/api/v1/crm/personas/p1?');
    expect(url).toContain('motivo_baja=DUPLICADO');
  });

  it('el 409 por oportunidades vivas se lee entero', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPersonas(respuesta(
      { detail: 'La persona tiene oportunidades vivas: AYMA-OPP-1, AYMA-OPP-2' }, 409,
    ));
    render(<PersonasPanel token="t" />);
    await abrirFicha();
    fireEvent.click(screen.getByRole('button', { name: /Dar de baja persona/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Prueba' }));
    fireEvent.change(screen.getByLabelText(/Escribí ELIMINAR/i), { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar baja$/ }));

    expect(await screen.findByText(/oportunidades vivas: AYMA-OPP-1, AYMA-OPP-2/)).toBeTruthy();
    // La ficha NO se cierra: el 409 es una lista de cosas por resolver.
    expect(screen.getByRole('button', { name: /^Confirmar baja$/ })).toBeTruthy();
  });
});
