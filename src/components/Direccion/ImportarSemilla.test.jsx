// @vitest-environment jsdom
//
// Importador de la semilla de Dirección. Dos invariantes, y las dos existen
// para que nadie escriba en la base sin haber visto antes qué escribe:
//
//  1. El PRIMER POST siempre va con dry_run=true. No hay forma de confirmar
//     sin haber simulado.
//  2. "Confirmar importación" está DESHABILITADO si hay filas rechazadas
//     (importar a medias deja la base en un estado que nadie puede auditar)
//     o si lo que se está mirando ya fue una escritura.
//
// Y un 4xx se muestra textual: es el archivo, no la red, y reintentarlo da
// el mismo error.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import ModalImportarSemilla from './ModalImportarSemilla';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const SEMILLA = { frentes: [{ codigo: 'F-01' }], proveedores: [] };

const DRY_LIMPIO = {
  escritura: false, dry_run: true,
  tablas: { frentes: { a_crear: ['F-01'], ya_existen: ['F-00'] } },
  rechazados: [],
};

const DRY_CON_RECHAZOS = {
  escritura: false, dry_run: true,
  tablas: { frentes: { a_crear: [], ya_existen: [] } },
  rechazados: [{ tabla: 'frentes', clave: 'F-99', motivo: 'gerencia inexistente: XX' }],
};

let llamadas;

const archivo = (contenido) => ({
  name: 'semilla.json',
  text: async () => JSON.stringify(contenido),
});

const elegirArchivo = async (contenido = SEMILLA) => {
  const input = document.querySelector('input[type="file"]');
  Object.defineProperty(input, 'files', { value: [archivo(contenido)], configurable: true });
  fireEvent.change(input);
  await screen.findByText('Simular importación (dry run)');
};

beforeEach(() => { llamadas = []; });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const montar = () => render(
  <ModalImportarSemilla token="t" onCerrar={() => {}} onImportado={() => {}} />,
);

describe('El dry run es obligatorio', () => {
  it('no hay botón de confirmar hasta que se simuló', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(DRY_LIMPIO)));
    montar();
    expect(screen.queryByText('Confirmar importación')).toBeNull();
    await elegirArchivo();
    // Con el archivo cargado pero sin simular, sigue sin existir.
    expect(screen.queryByText('Confirmar importación')).toBeNull();
  });

  it('la primera llamada va con dry_run=true y la confirmación con false', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      llamadas.push({ url: String(url), init });
      return Promise.resolve(respuesta(
        String(url).includes('dry_run=false') ? { ...DRY_LIMPIO, escritura: true, dry_run: false } : DRY_LIMPIO,
      ));
    });
    montar();
    await elegirArchivo();
    fireEvent.click(screen.getByText('Simular importación (dry run)'));

    await waitFor(() => expect(screen.getByText(/NO se escribió nada todavía/)).toBeTruthy());
    expect(llamadas[0].url).toContain('dry_run=true');
    // El cuerpo es la semilla; dry_run NUNCA va en el body (el backend lo
    // rechaza con 422).
    expect(JSON.parse(llamadas[0].init.body)).toEqual(SEMILLA);
    expect(JSON.parse(llamadas[0].init.body).dry_run).toBeUndefined();
    // Se ven las tablas: a crear y ya existen.
    expect(screen.getByText('frentes')).toBeTruthy();
    expect(screen.getByText('F-01')).toBeTruthy();
    expect(screen.getByText('F-00')).toBeTruthy();

    fireEvent.click(screen.getByText('Confirmar importación'));
    await waitFor(() => expect(llamadas[1].url).toContain('dry_run=false'));
    await screen.findByText('Importación terminada.');
  });
});

describe('Rechazados', () => {
  it('deshabilita "Confirmar importación" y muestra el motivo de cada fila', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      llamadas.push({ url: String(url), init });
      return Promise.resolve(respuesta(DRY_CON_RECHAZOS));
    });
    montar();
    await elegirArchivo();
    fireEvent.click(screen.getByText('Simular importación (dry run)'));

    await waitFor(() => expect(screen.getByText(/1 fila\(s\) rechazada\(s\)/)).toBeTruthy());
    expect(screen.getByText('gerencia inexistente: XX')).toBeTruthy();
    expect(screen.getByText('Confirmar importación').disabled).toBe(true);

    // Y ni con un click forzado se escribe: sólo hubo un POST, el del dry run.
    fireEvent.click(screen.getByText('Confirmar importación'));
    expect(llamadas.length).toBe(1);
    expect(llamadas[0].url).toContain('dry_run=true');
  });
});

describe('Errores', () => {
  it('un 4xx se muestra textual y no se reintenta solo', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      llamadas.push({ url: String(url), init });
      return Promise.resolve(respuesta({ detail: 'dry_run no puede ir en el cuerpo' }, 422));
    });
    montar();
    await elegirArchivo();
    fireEvent.click(screen.getByText('Simular importación (dry run)'));

    await waitFor(() => expect(screen.getByText('dry_run no puede ir en el cuerpo')).toBeTruthy());
    expect(screen.getByText(/No se reintenta/)).toBeTruthy();
    expect(llamadas.length).toBe(1);
  });

  it('un archivo que no es JSON no llega a llamar al backend', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta(DRY_LIMPIO)));
    montar();
    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', {
      value: [{ name: 'x.json', text: async () => 'esto no es json' }], configurable: true,
    });
    fireEvent.change(input);
    await waitFor(() => expect(screen.getByText(/No se pudo leer el archivo/)).toBeTruthy());
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
