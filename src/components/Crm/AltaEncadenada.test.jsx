// @vitest-environment jsdom
//
// Alta encadenada del CRM: desde un formulario de alta se crea la entidad
// relacionada sin salir, y al volver queda enlazada.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import AltaEncadenada from './AltaEncadenada';

const CUIT_VALIDO = '30-70000000-8';

let llamadas;
let respuestaBuscar;

const json = (data, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 400, json: async () => data });

beforeEach(() => {
  llamadas = [];
  respuestaBuscar = { personas: [], empresas: [], total: 0 };
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    llamadas.push({ url, metodo, body });

    if (url.includes('/crm/buscar')) return json(respuestaBuscar);
    if (url.includes('/crm/personas') && metodo === 'POST') {
      return json({ id: 'p-nueva', nombre: body.nombre, apellido: body.apellido });
    }
    if (url.includes('/crm/empresas') && metodo === 'POST') {
      return json({ id: 'e-nueva', razon_social: body.razon_social, cuit: body.cuit });
    }
    if (url.includes('/crm/vinculos') && metodo === 'POST') return json({ id: 'v1', ...body });
    if (url.includes('/crm/oportunidades') && metodo === 'POST') return json({ id: 'o-nueva' });
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

// Cada nivel de la pila es un modal propio: las consultas se acotan al modal
// para no confundir el botón de un nivel con el del de abajo.
const modal = (titulo) => screen.getByText(titulo, { selector: 'h3' }).closest('div.fixed');

const campo = (contenedor, etiqueta) => {
  const label = [...contenedor.querySelectorAll('label')].find((l) => l.textContent === etiqueta);
  if (!label) throw new Error(`No encontré el campo "${etiqueta}"`);
  return label.parentElement.querySelector('input, textarea, select');
};

const escribir = (contenedor, etiqueta, valor) =>
  fireEvent.change(campo(contenedor, etiqueta), { target: { value: valor } });

const boton = (contenedor, texto) => {
  const b = [...contenedor.querySelectorAll('button')].find((x) => x.textContent.trim() === texto);
  if (!b) throw new Error(`No encontré el botón "${texto}"`);
  return b;
};

const tieneBoton = (contenedor, texto) =>
  [...contenedor.querySelectorAll('button')].some((x) => x.textContent.trim() === texto);

const posts = (fragmento) => llamadas.filter((l) => l.metodo === 'POST' && l.url.includes(fragmento));

describe('flujos simples', () => {
  it('oportunidad -> nueva persona: vuelve con la persona ya seleccionada', async () => {
    const onResuelto = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={onResuelto} onCerrar={() => {}} />);

    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    const persona = modal('Nueva persona');
    escribir(persona, 'Nombre *', 'Ana');
    escribir(persona, 'Apellido', 'Díaz');
    fireEvent.click(boton(persona, 'Crear persona'));

    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());
    await waitFor(() => expect(modal('Nueva oportunidad').textContent).toContain('Ana Díaz'));
    const oportunidad = modal('Nueva oportunidad');
    fireEvent.change(campo(oportunidad, 'Track *'), { target: { value: 'ART' } });
    fireEvent.click(boton(oportunidad, 'Crear oportunidad'));
    await waitFor(() => expect(onResuelto).toHaveBeenCalled());
    expect(posts('/crm/oportunidades')[0].body.persona_id).toBe('p-nueva');
  });

  it('oportunidad -> nueva empresa: vuelve con la empresa ya seleccionada', async () => {
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);

    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva empresa'));
    const empresa = modal('Nueva empresa');
    escribir(empresa, 'Razón social *', 'ACME SRL');
    fireEvent.click(boton(empresa, 'Crear empresa'));

    await waitFor(() => expect(screen.queryByText('Nueva empresa', { selector: 'h3' })).toBeNull());
    await waitFor(() => expect(modal('Nueva oportunidad').textContent).toContain('ACME SRL'));
  });

  it('persona -> nueva empresa: la persona nace enlazada a esa empresa', async () => {
    const onResuelto = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'persona' }} onResuelto={onResuelto} onCerrar={() => {}} />);

    fireEvent.click(boton(modal('Nueva persona'), 'Nueva empresa'));
    escribir(modal('Nueva empresa'), 'Razón social *', 'ACME SRL');
    fireEvent.click(boton(modal('Nueva empresa'), 'Crear empresa'));

    await waitFor(() => expect(screen.queryByText('Nueva empresa', { selector: 'h3' })).toBeNull());
    await waitFor(() => expect(modal('Nueva persona').textContent).toContain('ACME SRL'));

    const persona = modal('Nueva persona');
    escribir(persona, 'Nombre *', 'Ana');
    fireEvent.click(boton(persona, 'Crear persona'));
    await waitFor(() => expect(onResuelto).toHaveBeenCalled());

    const vinculo = posts('/crm/vinculos')[0];
    expect(vinculo.body).toMatchObject({ persona_id: 'p-nueva', empresa_id: 'e-nueva', es_contacto_principal: true });
  });

  it('empresa -> nueva persona: queda enlazada como contacto', async () => {
    const onResuelto = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'empresa' }} onResuelto={onResuelto} onCerrar={() => {}} />);

    fireEvent.click(boton(modal('Nueva empresa'), 'Nueva persona'));
    escribir(modal('Nueva persona'), 'Nombre *', 'Ana');
    fireEvent.click(boton(modal('Nueva persona'), 'Crear persona'));

    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());
    await waitFor(() => expect(modal('Nueva empresa').textContent).toContain('Ana'));

    const empresa = modal('Nueva empresa');
    escribir(empresa, 'Razón social *', 'ACME SRL');
    fireEvent.click(boton(empresa, 'Crear empresa'));
    await waitFor(() => expect(onResuelto).toHaveBeenCalled());

    expect(posts('/crm/vinculos')[0].body).toMatchObject({
      persona_id: 'p-nueva', empresa_id: 'e-nueva', es_contacto_principal: true,
    });
  });
});

describe('encadenado de tres niveles', () => {
  it('oportunidad -> persona -> empresa desapila al revés, con cada enlace hecho', async () => {
    const onResuelto = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={onResuelto} onCerrar={() => {}} />);

    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    fireEvent.click(boton(modal('Nueva persona'), 'Nueva empresa'));

    // Tercer nivel: ya no se ofrece seguir anidando.
    const empresa = modal('Nueva empresa');
    expect(tieneBoton(empresa, 'Nueva persona')).toBe(false);

    escribir(empresa, 'Razón social *', 'ACME SRL');
    fireEvent.click(boton(empresa, 'Crear empresa'));
    await waitFor(() => expect(screen.queryByText('Nueva empresa', { selector: 'h3' })).toBeNull());

    await waitFor(() => expect(modal('Nueva persona').textContent).toContain('ACME SRL'));
    const persona = modal('Nueva persona');
    escribir(persona, 'Nombre *', 'Ana');
    fireEvent.click(boton(persona, 'Crear persona'));
    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());

    await waitFor(() => expect(modal('Nueva oportunidad').textContent).toContain('Ana'));
    const oportunidad = modal('Nueva oportunidad');
    fireEvent.change(campo(oportunidad, 'Track *'), { target: { value: 'ART' } });
    fireEvent.click(boton(oportunidad, 'Crear oportunidad'));
    await waitFor(() => expect(onResuelto).toHaveBeenCalled());

    expect(posts('/crm/empresas')).toHaveLength(1);
    expect(posts('/crm/personas')).toHaveLength(1);
    expect(posts('/crm/vinculos')[0].body).toMatchObject({ persona_id: 'p-nueva', empresa_id: 'e-nueva' });
    expect(posts('/crm/oportunidades')[0].body.persona_id).toBe('p-nueva');
  });
});

describe('cancelar', () => {
  it('cancelar en el tercer nivel vuelve al segundo sin crear nada', async () => {
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    escribir(modal('Nueva persona'), 'Nombre *', 'Ana');
    fireEvent.click(boton(modal('Nueva persona'), 'Nueva empresa'));

    fireEvent.click(boton(modal('Nueva empresa'), 'Cancelar'));
    await waitFor(() => expect(screen.queryByText('Nueva empresa', { selector: 'h3' })).toBeNull());

    // Vuelve al nivel 2 con lo tipeado intacto y sin empresa enlazada.
    const persona = modal('Nueva persona');
    expect(campo(persona, 'Nombre *').value).toBe('Ana');
    expect(persona.textContent).toContain('Sin empresa vinculada');
    expect(posts('/crm/empresas')).toHaveLength(0);
  });

  it('cancelar en el segundo nivel vuelve al primero sin crear nada', async () => {
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    fireEvent.click(boton(modal('Nueva persona'), 'Cancelar'));

    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());
    expect(modal('Nueva oportunidad')).toBeTruthy();
    expect(posts('/crm/personas')).toHaveLength(0);
  });

  it('cancelar en el nivel raíz cierra la pila', () => {
    const onCerrar = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'persona' }} onResuelto={() => {}} onCerrar={onCerrar} />);
    fireEvent.click(boton(modal('Nueva persona'), 'Cancelar'));
    expect(onCerrar).toHaveBeenCalled();
  });
});

describe('el formulario de origen no se pierde', () => {
  it('lo tipeado en la oportunidad sigue ahí al volver del nivel de arriba', async () => {
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    const oportunidad = modal('Nueva oportunidad');
    fireEvent.change(campo(oportunidad, 'Track *'), { target: { value: 'ART' } });
    escribir(oportunidad, 'Origen', 'referido');
    escribir(oportunidad, 'Notas', 'llamar el lunes');

    fireEvent.click(boton(oportunidad, 'Nueva persona'));
    escribir(modal('Nueva persona'), 'Nombre *', 'Ana');
    fireEvent.click(boton(modal('Nueva persona'), 'Crear persona'));
    await waitFor(() => expect(screen.queryByText('Nueva persona', { selector: 'h3' })).toBeNull());

    const vuelta = modal('Nueva oportunidad');
    expect(campo(vuelta, 'Track *').value).toBe('ART');
    expect(campo(vuelta, 'Origen').value).toBe('referido');
    expect(campo(vuelta, 'Notas').value).toBe('llamar el lunes');
  });
});

describe('precarga cruzada', () => {
  it('la persona abierta desde una oportunidad con empresa elegida nace con esa empresa', async () => {
    respuestaBuscar = {
      personas: [],
      empresas: [{ tipo: 'empresa', id: 'e-existente', token: 'tk', razon_social: 'ACME SRL', cuit: null, email: null, telefono: null }],
      total: 1,
    };
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    const oportunidad = modal('Nueva oportunidad');

    fireEvent.change(oportunidad.querySelector('input[placeholder="Buscar persona o empresa..."]'), { target: { value: 'acme' } });
    await waitFor(() => expect(screen.getByText('ACME SRL')).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(screen.getByText('ACME SRL'));

    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva persona'));
    const persona = modal('Nueva persona');
    expect(persona.textContent).toContain('ACME SRL');
    escribir(persona, 'Nombre *', 'Ana');
    fireEvent.click(boton(persona, 'Crear persona'));
    await waitFor(() => expect(posts('/crm/vinculos')).toHaveLength(1));
    expect(posts('/crm/vinculos')[0].body).toMatchObject({ persona_id: 'p-nueva', empresa_id: 'e-existente' });
  });

  it('la empresa abierta desde una oportunidad con persona elegida nace con esa persona', async () => {
    respuestaBuscar = {
      personas: [{ tipo: 'persona', id: 'p-existente', token: 'tk', nombre: 'Ana', apellido: 'Díaz', numero_documento: null, email: null, telefono: null, celular: null }],
      empresas: [],
      total: 1,
    };
    render(<AltaEncadenada token="t" raiz={{ tipo: 'oportunidad', preset: null }} onResuelto={() => {}} onCerrar={() => {}} />);
    const oportunidad = modal('Nueva oportunidad');

    fireEvent.change(oportunidad.querySelector('input[placeholder="Buscar persona o empresa..."]'), { target: { value: 'ana' } });
    await waitFor(() => expect(screen.getByText('Ana Díaz')).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(screen.getByText('Ana Díaz'));

    fireEvent.click(boton(modal('Nueva oportunidad'), 'Nueva empresa'));
    const empresa = modal('Nueva empresa');
    expect(empresa.textContent).toContain('Ana Díaz');

    escribir(empresa, 'Razón social *', 'ACME SRL');
    fireEvent.click(boton(empresa, 'Crear empresa'));
    await waitFor(() => expect(posts('/crm/vinculos')).toHaveLength(1));
    expect(posts('/crm/vinculos')[0].body).toMatchObject({ persona_id: 'p-existente', empresa_id: 'e-nueva' });
  });
});

describe('aviso de duplicado', () => {
  it('una empresa con el mismo CUIT se avisa y se puede usar la existente', async () => {
    respuestaBuscar = {
      personas: [],
      empresas: [{ tipo: 'empresa', id: 'e-existente', token: 'tk', razon_social: 'ACME S.R.L.', cuit: '30700000008', email: null, telefono: null }],
      total: 1,
    };
    const onResuelto = vi.fn();
    render(<AltaEncadenada token="t" raiz={{ tipo: 'empresa' }} onResuelto={onResuelto} onCerrar={() => {}} />);
    const empresa = modal('Nueva empresa');
    escribir(empresa, 'Razón social *', 'ACME SRL');
    escribir(empresa, 'CUIT', CUIT_VALIDO);
    fireEvent.click(boton(empresa, 'Crear empresa'));

    await waitFor(() => expect(screen.getByText('Usar la existente')).toBeTruthy());
    expect(modal('Nueva empresa').textContent).toContain('mismo CUIT');
    expect(posts('/crm/empresas')).toHaveLength(0);

    fireEvent.click(screen.getByText('Usar la existente'));
    await waitFor(() => expect(onResuelto).toHaveBeenCalled());
    expect(onResuelto.mock.calls[0][0].id).toBe('e-existente');
    expect(posts('/crm/empresas')).toHaveLength(0);
  });

  it('una persona con el mismo documento se avisa, y "Crear de todas formas" la crea', async () => {
    respuestaBuscar = {
      personas: [{ tipo: 'persona', id: 'p-existente', token: 'tk', nombre: 'Ana', apellido: 'Díaz', numero_documento: '20123456', email: null, telefono: null, celular: null }],
      empresas: [],
      total: 1,
    };
    render(<AltaEncadenada token="t" raiz={{ tipo: 'persona' }} onResuelto={() => {}} onCerrar={() => {}} />);
    const persona = modal('Nueva persona');
    escribir(persona, 'Nombre *', 'Ana');
    escribir(persona, 'Número de documento', '20.123.456');
    fireEvent.click(boton(persona, 'Crear persona'));

    await waitFor(() => expect(screen.getByText('mismo documento')).toBeTruthy());
    expect(posts('/crm/personas')).toHaveLength(0);

    fireEvent.click(screen.getByText('Crear de todas formas'));
    await waitFor(() => expect(posts('/crm/personas')).toHaveLength(1));
  });
});
