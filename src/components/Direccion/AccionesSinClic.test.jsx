// @vitest-environment jsdom
//
// H-66: LA PANTALLA NO MANDA UN PEDIDO QUE NADIE PIDIÓ.
//
// El incidente: después de ejecutar en firme `normalizar-listas-cerradas`,
// el panel de Diagnósticos terminó mostrando "Ejecutada en firme (dry_run:
// false) — Escribió 0 fila(s)" sin que nadie apretara el botón en esa carga
// de pantalla. "Escribió 0" es la huella de una SEGUNDA corrida en firme: la
// primera ya había escrito todo.
//
// Lo que blinda este archivo, y cada caso es una forma distinta de que un
// POST salga solo:
//
//  1. MONTAR NO PIDE NADA. Ni la tarjeta de migración, ni el diagnóstico de
//     Drive, ni los dos modales de finanzas -que hasta este PR mandaban el
//     `dry_run=true` desde un `useEffect`.
//  2. EJECUTAR EN FIRME → DESMONTAR → VOLVER A MONTAR no repite el POST, y
//     la tarjeta vuelve a "Todavía no se corrió": la simulación que habilita
//     el botón tiene que ser de ESTA carga de pantalla.
//  3. EL FOCO DE LA VENTANA NO PIDE NADA. Ni `focus` ni `visibilitychange`:
//     volver de otra pestaña no es una carga nueva.
//  4. VOLVER CON EL BOTÓN ATRÁS (bfcache, `pageshow` con `persisted: true`)
//     BORRA el resultado viejo. El back/forward cache restaura el heap
//     entero, así que sin esto la tarjeta reaparece con "Ejecutar en firme"
//     habilitado por una simulación de otra vida de la página.
//  5. UN GESTO ES UN SOLO PEDIDO. `disabled` llega un render tarde: dos
//     clicks en el mismo tick mandaban dos POST con `dry_run=false`.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react';
import MigracionDatosCard from './MigracionDatosCard';
import DireccionDiagnosticos from './DireccionDiagnosticos';

const RESULTADO = (dryRun, filas) => ({
  dry_run: dryRun, operacion: 'normalizar_listas_cerradas',
  filas_afectadas: filas, detalle: {}, verificacion: {},
});

const MIGRACION = { id: 'p', titulo: 'Migración de prueba', descripcion: 'x', ejecutar: vi.fn() };

beforeEach(() => { MIGRACION.ejecutar = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const simularYEjecutar = async () => {
  MIGRACION.ejecutar.mockResolvedValueOnce(RESULTADO(true, 7));
  fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
  await waitFor(() => expect(screen.getByText(/no se escribió nada/i)).toBeTruthy());
  fireEvent.change(screen.getByLabelText(/Escribí EJECUTAR/i), { target: { value: 'EJECUTAR' } });
  MIGRACION.ejecutar.mockResolvedValueOnce(RESULTADO(false, 7));
  fireEvent.click(screen.getByRole('button', { name: /Ejecutar en firme/i }));
  await waitFor(() => expect(screen.getByText(/Ejecutada en firme/i)).toBeTruthy());
};

describe('H-66 · ninguna acción sale sin un clic en esta carga de pantalla', () => {
  it('montar la tarjeta de migración no dispara NINGUNA llamada', async () => {
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    await act(async () => { await Promise.resolve(); });
    expect(MIGRACION.ejecutar).not.toHaveBeenCalled();
    expect(screen.getByText(/Todavía no se corrió/i)).toBeTruthy();
  });

  it('ejecutar en firme → desmontar → volver a montar: no se repite el POST', async () => {
    const { unmount } = render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    await simularYEjecutar();
    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(2);

    unmount();
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    await act(async () => { await Promise.resolve(); });

    // Ni un pedido más, y la tarjeta arranca en blanco: el "Ejecutar en
    // firme" de la vida anterior no sobrevive al remonte.
    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Todavía no se corrió/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Ejecutar en firme/i })).toBeNull();
  });

  it('el foco de la ventana no dispara nada', async () => {
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    await simularYEjecutar();
    const antes = MIGRACION.ejecutar.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(antes);
    // Y tampoco se borra lo que el operador está leyendo: mirar el mail y
    // volver no es una carga nueva de pantalla.
    expect(screen.getByText(/Ejecutada en firme/i)).toBeTruthy();
  });

  it('volver con el botón Atrás (bfcache) borra el resultado y no pide nada', async () => {
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    await simularYEjecutar();
    const antes = MIGRACION.ejecutar.mock.calls.length;

    await act(async () => {
      const ev = new Event('pageshow');
      Object.defineProperty(ev, 'persisted', { value: true });
      window.dispatchEvent(ev);
      await Promise.resolve();
    });

    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(antes);
    expect(screen.getByText(/Todavía no se corrió/i)).toBeTruthy();
  });

  it('doble clic en "Ejecutar en firme" manda UN solo POST', async () => {
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    MIGRACION.ejecutar.mockResolvedValueOnce(RESULTADO(true, 7));
    fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
    await waitFor(() => expect(screen.getByText(/no se escribió nada/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/Escribí EJECUTAR/i), { target: { value: 'EJECUTAR' } });

    MIGRACION.ejecutar.mockResolvedValue(RESULTADO(false, 7));
    const boton = screen.getByRole('button', { name: /Ejecutar en firme/i });
    // LOS DOS EVENTOS EN EL MISMO TICK, sin dejar que React repinte entre
    // uno y otro: es el doble clic real. `fireEvent.click` dos veces NO
    // sirve para esto -envuelve cada evento en su propio `act`, React
    // alcanza a pintar el `disabled` y el test pasaría igual con el bug
    // adentro-, así que se despachan los eventos nativos a mano.
    await act(async () => {
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText(/Ejecutada en firme/i)).toBeTruthy());

    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(2); // 1 simulación + 1 firme
    const enFirme = MIGRACION.ejecutar.mock.calls.filter(([, dry]) => dry === false);
    expect(enFirme).toHaveLength(1);
  });

  it('doble clic en "Simular" manda UN solo pedido', async () => {
    render(<MigracionDatosCard token="t" migracion={MIGRACION} />);
    MIGRACION.ejecutar.mockResolvedValue(RESULTADO(true, 3));
    const boton = screen.getByRole('button', { name: /^Simular$/i });
    await act(async () => {
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      boton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText(/no se escribió nada/i)).toBeTruthy());
    expect(MIGRACION.ejecutar).toHaveBeenCalledTimes(1);
  });

  it('montar el panel entero de Diagnósticos no dispara NINGÚN fetch', async () => {
    const fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
    globalThis.fetch = fetchSpy;
    render(<DireccionDiagnosticos token="t" />);
    await act(async () => { await Promise.resolve(); });
    expect(fetchSpy).not.toHaveBeenCalled();
    // Las tres migraciones del catálogo más el diagnóstico de Drive.
    expect(screen.getAllByText(/Todavía no se corrió/i).length).toBeGreaterThanOrEqual(4);
  });
});
