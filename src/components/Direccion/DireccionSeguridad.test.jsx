// @vitest-environment jsdom
//
// Seguridad. Dos cosas que este test blinda:
//
// 1. El inventario de credenciales NO tiene NINGÚN input para el valor del
//    secreto. Es la regla del módulo (el backend contesta 422 si el cuerpo
//    trae valor/secret/password/token/key) y acá se verifica que el front
//    tampoco lo ofrezca: ni type="password", ni un campo con esos nombres.
// 2. Un fallo al medir los hallazgos críticos NO se muestra como 0.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DireccionSeguridad from './DireccionSeguridad';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const CREDENCIALES = [{
  id: 'c1', nombre: 'RENDER_API_KEY', ubicacion: 'Render env',
  ultima_rotacion: '2026-01-10', proxima_rotacion: '2026-07-10',
  lote: 'L1', expuesta_en_transcript: false, notas: null,
}];

const PALABRAS_PROHIBIDAS = ['valor', 'secret', 'password', 'token', 'key'];

beforeEach(() => {
  globalThis.fetch = vi.fn((url) => {
    const u = String(url);
    if (u.includes('/seguridad/credenciales')) return Promise.resolve(respuesta(CREDENCIALES));
    return Promise.resolve(respuesta([]));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const irACredenciales = async () => {
  render(<DireccionSeguridad token="t" />);
  fireEvent.click(await screen.findByText('Credenciales'));
  return screen.findByText('RENDER_API_KEY');
};

// Un input es "de secreto" si es type=password o si su name/id/placeholder
// o la etiqueta de su columna nombran el valor del secreto.
const inputsDeSecreto = () =>
  Array.from(document.querySelectorAll('input, textarea')).filter((el) => {
    if (el.getAttribute('type') === 'password') return true;
    const texto = `${el.name} ${el.id} ${el.placeholder || ''}`.toLowerCase();
    return PALABRAS_PROHIBIDAS.some((p) => new RegExp(`\\b${p}\\b`).test(texto));
  });

describe('inventario de credenciales', () => {
  it('lista nombre, ubicación y fechas de rotación', async () => {
    await irACredenciales();
    ['Nombre', 'Ubicación', 'Última rotación', 'Próxima rotación'].forEach((c) => {
      expect(screen.getAllByText(c).length).toBeGreaterThan(0);
    });
    expect(screen.getByText('Render env')).toBeTruthy();
  });

  it('la tabla no tiene una columna para el valor del secreto', async () => {
    await irACredenciales();
    const encabezados = Array.from(document.querySelectorAll('th')).map(th => th.textContent.toLowerCase());
    encabezados.forEach((h) => {
      PALABRAS_PROHIBIDAS.forEach((p) => expect(h.includes(p)).toBe(false));
    });
  });

  it('el alta NO ofrece ningún input para el valor del secreto', async () => {
    await irACredenciales();
    fireEvent.click(screen.getByText('Nueva credencial'));
    expect(screen.getByText('Nueva credencial (inventario)')).toBeTruthy();
    expect(inputsDeSecreto()).toHaveLength(0);
    // Y ningún input de tipo password en toda la pantalla.
    expect(document.querySelectorAll('input[type="password"]')).toHaveLength(0);
  });

  it('el POST de alta no manda ninguna clave prohibida', async () => {
    await irACredenciales();
    fireEvent.click(screen.getByText('Nueva credencial'));
    const form = screen.getByText('Registrar credencial').closest('form');
    fireEvent.change(form.querySelector('input'), { target: { value: 'NUEVA_KEY' } });
    fireEvent.submit(form);

    await screen.findByText('RENDER_API_KEY');
    const post = globalThis.fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post).toBeTruthy();
    const cuerpo = JSON.parse(post[1].body);
    Object.keys(cuerpo).forEach((k) => {
      expect(PALABRAS_PROHIBIDAS).not.toContain(k.toLowerCase());
    });
  });
});

describe('métrica de críticos abiertos', () => {
  it('si no se pudo medir dice "Sin medir", nunca 0', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(respuesta({ detail: 'boom' }, 500)));
    render(<DireccionSeguridad token="t" />);
    expect(await screen.findByText('Sin medir')).toBeTruthy();
    expect(screen.queryByText('0')).toBeNull();
  });

  it('cuenta solo los hallazgos CRITICO abiertos', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (String(url).includes('/seguridad/hallazgos')) {
        return Promise.resolve(respuesta([
          { id: '1', codigo: 'H-1', titulo: 'a', severidad: 'CRITICO', estado: 'ABIERTO', detectado_en: null },
          { id: '2', codigo: 'H-2', titulo: 'b', severidad: 'MEDIO', estado: 'ABIERTO', detectado_en: null },
        ]));
      }
      return Promise.resolve(respuesta([]));
    });
    render(<DireccionSeguridad token="t" />);
    expect(await screen.findByText('1')).toBeTruthy();
  });
});
