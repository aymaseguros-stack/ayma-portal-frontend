// @vitest-environment jsdom
//
// OPERACIONES-0016 · @PAZ - "Fuentes de datos" en Dirección → Proveedores.
// Cubren: el listado con estado permitida/prohibida y sin ningún botón para
// habilitar una prohibida; la provincia como selector de las 24; el código
// sin prefijo con la vista de cómo queda guardado; y el flujo PROC-2:
// Previsualizar = dry_run=true (no escribe), Confirmar = dry_run=false sólo
// después del ConfirmarModal.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent, within } from '@testing-library/react';
import FuentesDatos from './FuentesDatos';
import DireccionProveedores from './DireccionProveedores';
import {
  PROVINCIAS_AR, bodyDirectorio, codigoGuardado, erroresDirectorio, slugDirectorio,
} from './fuentesDatosConstantes';

afterEach(cleanup);

const TOKEN = 't';

const fuente = (over = {}) => ({
  id: 1, codigo: 'WEB_CORPORATIVA', fuente: 'WEB_CORPORATIVA', nombre: 'Web corporativa',
  permitida_worker: true, prohibida_por_codigo: false, es_plantilla: false,
  tipos_permitidos: ['TELEFONO', 'EMAIL', 'WEB'], confianza_max: 'MEDIA',
  licencia: null, url_semilla: null, terminos_url: null, robots_ok: null, requiere_login: null,
  decision_ref: 'D-OP16-2', nota: null, delay_min_s: null, max_paginas_corrida: null,
  localidad_default: null, provincia_default: null, creado_en: '2026-09-27T15:00:00Z', creado_por: null,
  ...over,
});

const FUENTES = {
  total: 3,
  items: [
    fuente(),
    fuente({ id: 2, codigo: 'MATER_II', fuente: 'MATER_II', nombre: 'Mater II', permitida_worker: false, prohibida_por_codigo: true }),
    fuente({
      id: 3, codigo: 'DIRECTORIO_CAMARA', fuente: 'DIRECTORIO', nombre: 'Cámara de Comercio', confianza_max: 'BAJA',
      tipos_permitidos: ['TELEFONO', 'WEB'], terminos_url: 'https://camara.org.ar/terminos',
      delay_min_s: 30, max_paginas_corrida: 5, localidad_default: 'Rosario', provincia_default: 'SANTA FE',
    }),
  ],
};

let altas = [];

const mockFetch = () => {
  altas = [];
  globalThis.fetch = vi.fn(async (url, opts = {}) => {
    const u = new URL(String(url));
    const metodo = (opts.method || 'GET').toUpperCase();
    if (metodo === 'GET' && u.pathname === '/api/v1/art/fuentes-datos') {
      return { ok: true, status: 200, json: async () => FUENTES };
    }
    if (metodo === 'POST' && u.pathname === '/api/v1/art/fuentes-datos/directorios') {
      const body = JSON.parse(opts.body);
      const dry = u.searchParams.get('dry_run') === 'true';
      altas.push({ dry, body });
      return {
        ok: true, status: 200,
        json: async () => ({
          ...fuente({ id: dry ? null : 9, codigo: `DIRECTORIO_${body.codigo}`, fuente: 'DIRECTORIO', nombre: body.nombre, confianza_max: 'BAJA' }),
          tipos_permitidos: body.tipos_permitidos, url_semilla: body.url_semilla, terminos_url: body.terminos_url,
          provincia_default: body.provincia_default ?? null, localidad_default: body.localidad_default ?? null,
          escritura: !dry, dry_run: dry,
        }),
      };
    }
    // Lo que carga la vista de proveedores al montar.
    return { ok: true, status: 200, json: async () => [] };
  });
};

beforeEach(() => { vi.restoreAllMocks(); mockFetch(); });

describe('helpers', () => {
  it('el código se tipea sin prefijo y se guarda con DIRECTORIO_', () => {
    expect(slugDirectorio(' camara_rosario ')).toBe('CAMARA_ROSARIO');
    expect(slugDirectorio('DIRECTORIO_CAMARA')).toBe('CAMARA');
    expect(codigoGuardado('camara')).toBe('DIRECTORIO_CAMARA');
  });

  it('las 24 provincias canónicas del backend', () => {
    expect(PROVINCIAS_AR).toHaveLength(24);
    expect(PROVINCIAS_AR).toContain('CABA');
    expect(PROVINCIAS_AR).toContain('SANTIAGO DEL ESTERO');
  });

  it('valida lo obvio y arma el body sin campos vacíos', () => {
    const base = {
      codigo: 'ca', nombre: '', url_semilla: 'x', terminos_url: 'https://a.com', robots_ok: false,
      requiere_login: true, tipos_permitidos: [], delay_min_s: '4000', max_paginas_corrida: '0',
    };
    expect(Object.keys(erroresDirectorio(base)).sort()).toEqual([
      'codigo', 'delay_min_s', 'max_paginas_corrida', 'nombre', 'requiere_login', 'robots_ok', 'tipos_permitidos', 'url_semilla',
    ]);
    expect(bodyDirectorio({
      codigo: 'cam', nombre: ' Cámara ', url_semilla: 'https://a.com/s', terminos_url: 'https://a.com/t',
      robots_ok: true, requiere_login: false, tipos_permitidos: ['WEB'], licencia: '', nota: '',
      delay_min_s: '', max_paginas_corrida: '5', localidad_default: ' ', provincia_default: 'CABA',
    })).toEqual({
      codigo: 'CAM', nombre: 'Cámara', url_semilla: 'https://a.com/s', terminos_url: 'https://a.com/t',
      robots_ok: true, requiere_login: false, tipos_permitidos: ['WEB'], max_paginas_corrida: 5, provincia_default: 'CABA',
    });
  });
});

const completar = () => {
  const form = screen.getByRole('form', { name: 'Alta de directorio' });
  const input = (label) => within(form).getByLabelText(label, { exact: false });
  fireEvent.change(input('Código (sin prefijo)'), { target: { value: 'camara_funes' } });
  fireEvent.change(input('Nombre'), { target: { value: 'Cámara de Funes' } });
  fireEvent.change(input('URL semilla'), { target: { value: 'https://camarafunes.org.ar/socios' } });
  fireEvent.change(input('URL de términos'), { target: { value: 'https://camarafunes.org.ar/terminos' } });
  fireEvent.change(input('Provincia por defecto'), { target: { value: 'SANTA FE' } });
  fireEvent.click(input('El robots.txt permite leer la página'));
  return form;
};

describe('Fuentes de datos', () => {
  it('lista con estado; las prohibidas no tienen cómo habilitarse', async () => {
    render(<FuentesDatos token={TOKEN} />);
    await screen.findByText('Mater II');
    const filas = screen.getAllByTestId('fila-fuente');
    const mater = filas.find((f) => f.textContent.includes('MATER_II'));
    expect(mater.dataset.permitida).toBe('false');
    expect(mater.textContent).toContain('Prohibida (código)');
    expect(within(mater).queryByRole('button')).toBeNull();
    const camara = filas.find((f) => f.textContent.includes('DIRECTORIO_CAMARA'));
    expect(camara.textContent).toContain('Rosario');
    expect(camara.textContent).toContain('SANTA FE');
    expect(camara.textContent).toContain('30');
    expect(camara.textContent).toContain('BAJA');
    expect(screen.queryByRole('button', { name: /Habilitar/i })).toBeNull();
  });

  it('provincia es un selector de las 24 y el código muestra cómo se guarda', async () => {
    render(<FuentesDatos token={TOKEN} />);
    await screen.findByText('Mater II');
    const select = screen.getByLabelText('Provincia por defecto', { exact: false });
    expect(select.tagName).toBe('SELECT');
    expect(within(select).getAllByRole('option')).toHaveLength(25);
    fireEvent.change(screen.getByLabelText('Código (sin prefijo)', { exact: false }), { target: { value: 'camara' } });
    expect(screen.getByTestId('codigo-guardado').textContent).toBe('DIRECTORIO_CAMARA');
  });

  it('Previsualizar es dry_run=true y no escribe; Confirmar pide ConfirmarModal', async () => {
    render(<FuentesDatos token={TOKEN} />);
    await screen.findByText('Mater II');
    const confirmarBtn = screen.getByRole('button', { name: 'Confirmar alta' });
    expect(confirmarBtn.disabled).toBe(true);

    completar();
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    const previa = await screen.findByTestId('previa-directorio');
    expect(previa.textContent).toContain('no se escribió nada');
    expect(previa.textContent).toContain('DIRECTORIO_CAMARA_FUNES');
    expect(altas).toHaveLength(1);
    expect(altas[0].dry).toBe(true);
    expect(altas[0].body).toMatchObject({ codigo: 'CAMARA_FUNES', provincia_default: 'SANTA FE', robots_ok: true, requiere_login: false });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alta' }));
    const dialogo = screen.getByRole('alertdialog', { name: 'Confirmar alta de directorio' });
    expect(altas).toHaveLength(1);
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Dar de alta' }));
    await waitFor(() => expect(altas).toHaveLength(2));
    expect(altas[1].dry).toBe(false);
    expect(altas[1].body).toEqual(altas[0].body);
    expect((await screen.findByRole('status')).textContent).toContain('DIRECTORIO_CAMARA_FUNES');
  });

  it('cambiar el formulario después de previsualizar descarta la previsualización', async () => {
    render(<FuentesDatos token={TOKEN} />);
    await screen.findByText('Mater II');
    completar();
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    await screen.findByTestId('previa-directorio');
    fireEvent.change(screen.getByLabelText('Nombre', { exact: false }), { target: { value: 'Otro' } });
    expect(screen.queryByTestId('previa-directorio')).toBeNull();
    expect(screen.getByRole('button', { name: 'Confirmar alta' }).disabled).toBe(true);
  });

  it('un formulario incompleto no llama al backend', async () => {
    render(<FuentesDatos token={TOKEN} />);
    await screen.findByText('Mater II');
    fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
    expect(altas).toHaveLength(0);
    expect(screen.getByText('3 a 40 caracteres: A-Z, 0-9 o _.')).toBeTruthy();
  });

  it('es la tercera vista de Dirección → Proveedores', async () => {
    render(<DireccionProveedores token={TOKEN} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fuentes de datos' }));
    expect(await screen.findByText('Mater II')).toBeTruthy();
  });
});
