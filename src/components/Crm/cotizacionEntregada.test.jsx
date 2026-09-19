// @vitest-environment jsdom
//
// "Registrar cotización entregada" y el estado como consecuencia del acto.
//
// LOS TRES INVARIANTES QUE FIJAN ESTOS TESTS:
//
//   1. **La Idempotency-Key viaja, y es LA MISMA en el reintento.** Es el
//      único lugar donde un bug no se ve: si cada "Confirmar" generara una
//      clave nueva, un reintento sobre una conexión cortada entrega la misma
//      cotización dos veces, suma 26 puntos y deja DOS cadencias corriendo
//      sobre el mismo prospecto. En pantalla se ve igual de bien.
//   2. **El estado se relee del backend.** Después de confirmar, la ficha
//      vuelve a pedir la oportunidad en vez de pintar POTENCIAL por su cuenta:
//      el estado es del servidor.
//   3. **No hay ningún control para elegir `estado_crm`.** Ni en la ficha ni en
//      el formulario. El día que vuelva un `<select>` de estado, este test
//      falla.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import OportunidadFichaModal from './OportunidadFichaModal';

const detalle = (extra = {}) => ({
  id: 'o-1', token: 'OPO-0001', track: 'AUTO', estado_crm: 'PROSPECTO',
  resultado: 'EN_CURSO', prima_estimada: null, nombre_vinculado: 'Juan Pérez',
  persona_id: 'p-1', empresa_id: null, tareas: [], adjuntos_count: 0,
  etapa_saida: null, origen: 'landing', notas: null,
  ...extra,
});

let llamadas;
let detalleActual;
let respuestaCotizacion;
let fallarCotizacion;

const json = (data, ok = true, status = 200) => Promise.resolve({
  ok, status, json: async () => data,
});

beforeEach(() => {
  llamadas = [];
  detalleActual = detalle();
  fallarCotizacion = false;
  respuestaCotizacion = {
    oportunidad_id: 'o-1', token: 'OPO-0001', estado_anterior: 'PROSPECTO',
    estado_crm: 'POTENCIAL', estado_cambio: true, puntos: '13',
    interaccion_id: 'i-1', seguimiento_id: 's-1', adjunto_id: null,
    idempotente: false, detalle: null,
  };
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const metodo = opts.method || 'GET';
    const texto = String(url);
    llamadas.push({ url: texto, metodo, headers: opts.headers || {}, body: opts.body });
    if (texto.includes('/cotizacion-entregada')) {
      if (fallarCotizacion) return json({ detail: 'se cayó la red' }, false, 500);
      // El acto movió el estado: el siguiente GET del detalle lo refleja.
      detalleActual = detalle({ estado_crm: 'POTENCIAL', prima_estimada: '185000.00' });
      return json(respuestaCotizacion, true, 201);
    }
    if (texto.includes('/transicion')) {
      detalleActual = detalle({ estado_crm: 'LOOP' });
      return json({
        oportunidad_id: 'o-1', token: 'OPO-0001', estado_anterior: 'PROSPECTO',
        estado_crm: 'LOOP', estado_cambio: true, puntos: '0', interaccion_id: 'i-2',
        seguimientos_cancelados: 1,
      });
    }
    if (texto.includes('/crm/oportunidades/o-1') && metodo === 'GET') return json(detalleActual);
    if (texto.includes('/crm/adjuntos')) return json({ adjuntos: [], duplicados: [] });
    return json({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const boton = (texto) => [...document.querySelectorAll('button')]
  .find((b) => b.textContent.trim() === texto);
const esperarFicha = async () => waitFor(() => expect(screen.getByText('OPO-0001')).toBeTruthy());
const postsCotizacion = () => llamadas.filter(
  (l) => l.metodo === 'POST' && l.url.includes('/cotizacion-entregada'),
);

const completarModal = () => {
  fireEvent.change(screen.getByLabelText('Compañía *'), { target: { value: 'San Cristóbal' } });
  fireEvent.change(screen.getByLabelText('Premio *'), { target: { value: '185000' } });
  fireEvent.change(screen.getByLabelText('Vehículo'), { target: { value: 'Ford Focus 2019' } });
};

describe('ficha de oportunidad · cotización entregada', () => {
  it('manda compañía, premio, vehículo y la Idempotency-Key', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Registrar cotización entregada'));
    completarModal();
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(postsCotizacion()).toHaveLength(1));
    const post = postsCotizacion()[0];
    expect(post.headers['Idempotency-Key']).toBeTruthy();
    // multipart: el Content-Type lo pone el navegador con su boundary, nunca
    // se setea a mano (si se setea, el backend no puede parsear el form).
    expect(post.headers['Content-Type']).toBeUndefined();
    expect(post.body.get('compania')).toBe('San Cristóbal');
    expect(post.body.get('premio')).toBe('185000');
    expect(post.body.get('vehiculo')).toBe('Ford Focus 2019');
  });

  it('el reintento tras un error reusa LA MISMA Idempotency-Key', async () => {
    fallarCotizacion = true;
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Registrar cotización entregada'));
    completarModal();
    fireEvent.click(boton('Confirmar'));
    await waitFor(() => expect(postsCotizacion()).toHaveLength(1));
    await waitFor(() => expect(document.body.textContent).toContain('se cayó la red'));

    fallarCotizacion = false;
    fireEvent.click(boton('Confirmar'));
    await waitFor(() => expect(postsCotizacion()).toHaveLength(2));

    const [primero, segundo] = postsCotizacion();
    expect(segundo.headers['Idempotency-Key']).toBe(primero.headers['Idempotency-Key']);
  });

  it('al confirmar relee la ficha y el estado pasa a POTENCIAL', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();
    expect(screen.getByText('PROSPECTO')).toBeTruthy();

    fireEvent.click(boton('Registrar cotización entregada'));
    completarModal();
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(screen.getByText('POTENCIAL')).toBeTruthy());
    expect(screen.queryByText('PROSPECTO')).toBeNull();
    // El GET del detalle se repitió: el estado se lee del backend.
    expect(llamadas.filter((l) => l.metodo === 'GET' && l.url.includes('/crm/oportunidades/o-1')).length)
      .toBeGreaterThan(1);
    expect(document.body.textContent).toContain('+13 puntos');
    expect(document.body.textContent).toContain('primer seguimiento programado');
  });

  it('un reintento idempotente no vuelve a sumar puntos y lo dice', async () => {
    respuestaCotizacion = {
      ...respuestaCotizacion, estado_cambio: false, puntos: '13', idempotente: true,
      detalle: 'Ya se había registrado esta cotización con la misma Idempotency-Key',
    };
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Registrar cotización entregada'));
    completarModal();
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(document.body.textContent).toContain('ya estaba registrada con la misma clave'));
  });

  it('NO hay ningún control para elegir estado_crm', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    const opcionesDeEstado = ['DATO', 'PROSPECTO', 'POTENCIAL', 'CLIENTE', 'LOOP', 'RECUPERABLE'];
    for (const select of document.querySelectorAll('select')) {
      const valores = [...select.options].map((o) => o.value);
      const pisa = valores.filter((v) => opcionesDeEstado.includes(v));
      expect(pisa).toEqual([]);
    }
  });
});

describe('ficha de oportunidad · LOOP y RECUPERABLE', () => {
  it('LOOP no manda nada sin fecha de recontacto', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Pasar a LOOP'));
    const recontacto = screen.getByLabelText('Fecha de recontacto *');
    // `required` en el input: el campo es obligatorio para el navegador, no
    // sólo para un `if` que se puede olvidar de agregar.
    expect(recontacto.required).toBe(true);

    fireEvent.click(boton('Confirmar LOOP'));
    // Lo que importa no es el cartel: es que NO salió el request. Un LOOP sin
    // fecha de recontacto es un dato que nadie vuelve a tocar, y el backend
    // igual lo rechazaría con 409.
    await new Promise((r) => setTimeout(r, 0));
    expect(llamadas.some((l) => l.url.includes('/transicion'))).toBe(false);
  });

  it('con fecha de recontacto manda LOOP y refresca el estado', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Pasar a LOOP'));
    fireEvent.change(screen.getByLabelText('Fecha de recontacto *'), { target: { value: '2026-12-01' } });
    fireEvent.change(screen.getByLabelText('Nota'), { target: { value: 'NO_COLOCABLE: Ford F100 1976' } });
    fireEvent.click(boton('Confirmar LOOP'));

    await waitFor(() => {
      const post = llamadas.find((l) => l.url.includes('/transicion'));
      expect(post).toBeTruthy();
      expect(JSON.parse(post.body)).toMatchObject({
        estado_crm: 'LOOP',
        fecha_recontacto: '2026-12-01',
        nota: 'NO_COLOCABLE: Ford F100 1976',
      });
    });
    await waitFor(() => expect(screen.getByText('LOOP')).toBeTruthy());
    expect(document.body.textContent).toContain('1 seguimiento(s) cancelado(s)');
  });

  it('"Marcar recuperable" sólo aparece si la oportunidad está en CLIENTE', async () => {
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();
    expect(boton('Marcar recuperable')).toBeUndefined();

    cleanup();
    detalleActual = detalle({ estado_crm: 'CLIENTE' });
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();
    expect(boton('Marcar recuperable')).toBeTruthy();
  });

  it('RECUPERABLE exige fecha de baja, motivo y recontacto, y el motivo sale del enum del backend', async () => {
    detalleActual = detalle({ estado_crm: 'CLIENTE' });
    render(<OportunidadFichaModal token="t" oportunidadId="o-1" onClose={() => {}} />);
    await esperarFicha();

    fireEvent.click(boton('Marcar recuperable'));

    // Los tres son obligatorios para el navegador. `fecha_baja` viene con el
    // día de hoy precargado (es el caso normal: la baja se registra el día que
    // ocurre), los otros dos se piden.
    expect(screen.getByLabelText('Fecha de baja *').required).toBe(true);
    expect(screen.getByLabelText('Motivo de la baja *').required).toBe(true);
    expect(screen.getByLabelText('Fecha de recontacto *').required).toBe(true);

    fireEvent.click(boton('Confirmar RECUPERABLE'));
    await new Promise((r) => setTimeout(r, 0));
    expect(llamadas.some((l) => l.url.includes('/transicion'))).toBe(false);

    const motivos = [...screen.getByLabelText('Motivo de la baja *').options]
      .map((o) => o.value).filter(Boolean);
    expect(motivos).toEqual([
      'PRECIO', 'SERVICIO', 'SINIESTRO', 'COMPANIA', 'VENTA_BIEN', 'MUDANZA',
      'SIN_CONTACTO', 'OTRO',
    ]);
    // NO_COLOCABLE todavía no existe en `MotivoBaja` del backend: ofrecerlo
    // sería un 422 al confirmar.
    expect(motivos).not.toContain('NO_COLOCABLE');
  });
});
