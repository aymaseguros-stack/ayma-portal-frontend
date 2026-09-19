// @vitest-environment jsdom
//
// Una gerencia sin frentes abiertos NI decisiones abiertas va en GRIS con
// "Sin frentes cargados", no en VERDE.
//
// POR QUÉ: el backend la marca VERDE porque su regla es "nada bloqueado", y
// "nada bloqueado" y "nada registrado" se ven igual en un punto verde. Un
// tablero que dice que todo está bien porque no hay nada cargado es peor que
// uno vacío: invita a dejar de mirarlo.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import DireccionTablero from './DireccionTablero';
import { semaforoDeGerencia, semaforoGlobalMostrado } from './direccionConstantes';

const respuesta = (data) => ({ ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }) });

const tablero = (gerencias, semaforoGlobal = 'VERDE') => ({
  semaforo_global: semaforoGlobal,
  gerencias,
  top_frentes: [], decisiones_abiertas: [], workers_por_estado: {},
  herramientas_pagas: [], costos: { por_rubro: {}, por_moneda: {} },
});

const montar = (datos) => {
  globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(datos)));
  return render(<DireccionTablero token="t" onAbrirGerencia={() => {}} />);
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('la regla, sin pasar por el DOM', () => {
  it('sin frentes ni decisiones abiertas -> GRIS, aunque el backend diga VERDE', () => {
    expect(semaforoDeGerencia({ semaforo: 'VERDE', frentes_abiertos: 0, decisiones_abiertas: 0 })).toBe('GRIS');
  });

  it('con un frente abierto se respeta el semáforo del backend', () => {
    expect(semaforoDeGerencia({ semaforo: 'VERDE', frentes_abiertos: 1, decisiones_abiertas: 0 })).toBe('VERDE');
    expect(semaforoDeGerencia({ semaforo: 'ROJO', frentes_abiertos: 2, decisiones_abiertas: 0 })).toBe('ROJO');
  });

  it('sólo una decisión abierta también alcanza para salir del gris', () => {
    expect(semaforoDeGerencia({ semaforo: 'AMARILLO', frentes_abiertos: 0, decisiones_abiertas: 1 })).toBe('AMARILLO');
  });

  it('el global es GRIS si TODAS están en gris, y el del backend si alguna no lo está', () => {
    const vacias = [{ frentes_abiertos: 0, decisiones_abiertas: 0 }, { frentes_abiertos: 0, decisiones_abiertas: 0 }];
    expect(semaforoGlobalMostrado('VERDE', vacias)).toBe('GRIS');
    expect(semaforoGlobalMostrado('VERDE', [...vacias, { frentes_abiertos: 1, decisiones_abiertas: 0 }])).toBe('VERDE');
    // Sin gerencias no se inventa nada: queda lo que dijo el backend.
    expect(semaforoGlobalMostrado('VERDE', [])).toBe('VERDE');
  });
});

describe('el tablero renderizado', () => {
  it('la gerencia vacía dice "Sin frentes cargados" y su punto no es verde', async () => {
    const { container } = montar(tablero([
      { codigo: 'G1', nombre: 'Comercial', semaforo: 'VERDE', frentes_abiertos: 0, frentes_bloqueados: 0, decisiones_abiertas: 0, motivos: ['Todo en orden'] },
    ]));
    expect(await screen.findByText('Sin frentes cargados')).toBeTruthy();
    // El motivo "Todo en orden" del backend no se muestra: no hay nada que mirar.
    expect(screen.queryByText(/Todo en orden/)).toBeNull();
    expect(container.querySelector('.bg-green-500')).toBeNull();
    expect(screen.getByLabelText('Semáforo GRIS')).toBeTruthy();
  });

  it('el semáforo global no dice VERDE si todas las gerencias están en gris', async () => {
    montar(tablero([
      { codigo: 'G1', nombre: 'Comercial', semaforo: 'VERDE', frentes_abiertos: 0, frentes_bloqueados: 0, decisiones_abiertas: 0 },
      { codigo: 'G2', nombre: 'Técnica', semaforo: 'VERDE', frentes_abiertos: 0, frentes_bloqueados: 0, decisiones_abiertas: 0 },
    ], 'VERDE'));
    await waitFor(() => expect(screen.getAllByText('Sin frentes cargados')).toHaveLength(2));
    expect(screen.queryByText('VERDE')).toBeNull();
    expect(screen.getByText('GRIS')).toBeTruthy();
  });

  it('una gerencia con frentes conserva su verde y su motivo', async () => {
    montar(tablero([
      { codigo: 'G1', nombre: 'Comercial', semaforo: 'VERDE', frentes_abiertos: 3, frentes_bloqueados: 0, decisiones_abiertas: 0, motivos: ['Sin bloqueos'] },
    ], 'VERDE'));
    expect(await screen.findByText(/Sin bloqueos/)).toBeTruthy();
    expect(screen.queryByText('Sin frentes cargados')).toBeNull();
    expect(screen.getByText('VERDE')).toBeTruthy();
  });
});
