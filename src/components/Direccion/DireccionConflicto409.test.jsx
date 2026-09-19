// @vitest-environment jsdom
//
// El 409 por código duplicado. El backend contesta
// {detail: {detail, codigo_en_uso, siguiente_codigo_libre}} justamente para
// que quien está cargando no tenga que adivinar el próximo código libre ni
// ir a listar la tabla. Acá se verifica que el front lo MUESTRE y que el
// botón "Usar este código" lo aplique al formulario, y que el segundo
// intento viaje con ese código.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DireccionGerencias from './DireccionGerencias';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const CUERPO_409 = {
  detail: {
    detail: 'Ya existe un registro con el código F-DT-01',
    codigo_en_uso: 'F-DT-01',
    siguiente_codigo_libre: 'F-DT-02',
  },
};

const FICHA = {
  gerencia: { id: 'g1', codigo: 'DT', nombre: 'Dirección Técnica', prefijo_ids: 'DT', orden: 1 },
  semaforo: 'VERDE', motivos: [], frentes: [], decisiones: [], workers: [], documentos: [],
};

let posts;

const montar = () => render(
  <DireccionGerencias token="t" codigoAbierto="DT" onAbrirGerencia={() => {}} onCerrarFicha={() => {}} />
);

const abrirAltaDeFrente = async () => {
  montar();
  fireEvent.click(await screen.findByText('Nuevo frente'));
  return screen.getByText('Crear frente').closest('form');
};

const completarYEnviar = (form, titulo = 'Migrar workers') => {
  const inputs = form.querySelectorAll('input');
  fireEvent.change(inputs[1], { target: { value: titulo } }); // [0] = código, [1] = título
  fireEvent.submit(form);
};

beforeEach(() => {
  posts = 0;
  globalThis.fetch = vi.fn((url, init) => {
    const u = String(url);
    if (init?.method === 'POST' && u.includes('/frentes')) {
      posts += 1;
      // El primer alta choca; con el código sugerido, pasa.
      if (posts === 1) return Promise.resolve(respuesta(CUERPO_409, 409));
      return Promise.resolve(respuesta({ codigo: 'F-DT-02' }, 201));
    }
    if (u.includes('/gerencias/DT')) return Promise.resolve(respuesta(FICHA));
    return Promise.resolve(respuesta([]));
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const cuerpoDelUltimoPost = () => {
  const llamadas = globalThis.fetch.mock.calls.filter(([, init]) => init?.method === 'POST');
  return JSON.parse(llamadas[llamadas.length - 1][1].body);
};

describe('alta con código en conflicto (409)', () => {
  it('muestra el mensaje del backend y el código libre sugerido', async () => {
    const form = await abrirAltaDeFrente();
    completarYEnviar(form);

    expect(await screen.findByText(/Ya existe un registro con el código F-DT-01/)).toBeTruthy();
    expect(screen.getByText('F-DT-02')).toBeTruthy();
    expect(screen.getByText('Usar este código')).toBeTruthy();
  });

  it('un click en "Usar este código" lo carga en el campo y el reintento lo manda', async () => {
    const form = await abrirAltaDeFrente();
    completarYEnviar(form);
    fireEvent.click(await screen.findByText('Usar este código'));

    const campoCodigo = form.querySelectorAll('input')[0];
    expect(campoCodigo.value).toBe('F-DT-02');
    // Aceptado el código sugerido, el aviso se va.
    expect(screen.queryByText('Usar este código')).toBeNull();

    fireEvent.submit(form);
    await waitFor(() => expect(posts).toBe(2));
    expect(cuerpoDelUltimoPost().codigo).toBe('F-DT-02');
  });

  it('sin código tipeado el POST no manda "codigo": lo asigna el backend', async () => {
    const form = await abrirAltaDeFrente();
    completarYEnviar(form);
    await waitFor(() => expect(posts).toBe(1));
    expect('codigo' in cuerpoDelUltimoPost()).toBe(false);
  });

  it('el mismo manejo del 409 aplica al alta de decisión', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      const u = String(url);
      if (init?.method === 'POST' && u.includes('/decisiones')) {
        return Promise.resolve(respuesta({
          detail: {
            detail: 'Ya existe un registro con el código D-DT-03',
            codigo_en_uso: 'D-DT-03',
            siguiente_codigo_libre: 'D-DT-04',
          },
        }, 409));
      }
      if (u.includes('/gerencias/DT')) return Promise.resolve(respuesta(FICHA));
      return Promise.resolve(respuesta([]));
    });

    montar();
    fireEvent.click(await screen.findByText('Nueva decisión'));
    const form = screen.getByText('Crear decisión').closest('form');
    fireEvent.change(form.querySelector('textarea'), { target: { value: '¿Migramos?' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/Ya existe un registro con el código D-DT-03/)).toBeTruthy();
    fireEvent.click(screen.getByText('Usar este código'));
    expect(form.querySelectorAll('input')[0].value).toBe('D-DT-04');
  });
});
