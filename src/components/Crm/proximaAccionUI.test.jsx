// @vitest-environment jsdom
//
// C-9d FE - la próxima acción en pantalla: el modal de "Registrar toque", las
// dos listas nuevas de "Seguimientos de hoy", la tarjeta ADMIN y la Agenda.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import SeguimientosHoyPanel from './SeguimientosHoyPanel';
import AgendaPanel from './AgendaPanel';
import { hoyAr, sumarDias, olvidarCatalogoProximaAccion } from './proximaAccion';

const CATALOGO = {
  tipos: ['WHATSAPP', 'LLAMAR', 'RECOTIZAR', 'PEDIR_DATOS', 'REUNION', 'EMITIR', 'SIN_ACCION_LOOP'],
  tipo_tarea_por_accion: {},
  loop_motivos: ['SIN_RESPUESTA', 'PRECIO', 'RENOVO_CON_ACTUAL', 'NO_INTERESADO', 'MAS_ADELANTE', 'OTRO'],
  canales_toque: ['WHATSAPP', 'LLAMADA'],
  plazo_max_accion_dias: 90,
  plazo_max_recontacto_dias: 365,
};

const SEG = {
  id: 's-1', oportunidad_id: 'o-1', oportunidad_token: 'OPO-0001', numero_de_toque: 1,
  programado_para: '2026-09-19T10:00:00', vencido: false, nombre: 'Juan Pérez',
  telefono: '+54 9 341 695-2259', vehiculo: 'Ford Focus 2019', compania: 'San Cristóbal',
  premio: '185000.00', estado_crm: 'POTENCIAL',
};

const IMPEDIMENTO = {
  impedida: true, motivo: 'ESTADO_ARCA:BAJA_OFICIO', como_revertir: 'x', empresa_id: 'e-1',
};

let llamadas;
let rutas;

const respuesta = (data, status = 200) => Promise.resolve({
  ok: status < 400, status, json: async () => data,
});

// [fragmento, método, cuerpo, status?]; la última que coincide gana.
const ruta = (frag, metodo, cuerpo, status = 200) => rutas.unshift([frag, metodo, cuerpo, status]);

beforeEach(() => {
  olvidarCatalogoProximaAccion();
  llamadas = [];
  rutas = [];
  ruta('/catalogos/proxima-accion', 'GET', CATALOGO);
  ruta('/seguimientos/hoy', 'GET', {
    fecha: '2026-09-27', total: 1, seguimientos: [SEG], proximas_acciones: [], loop_a_recontactar: [],
  });
  ruta('/registrar', 'POST', {
    seguimiento_id: 's-1', estado: 'HECHO', interaccion_id: 'i-1', propone_loop: false,
    seguimientos_cancelados: 0, proxima_accion: null,
  });
  globalThis.fetch = vi.fn((url, opts = {}) => {
    const texto = String(url);
    const metodo = opts.method || 'GET';
    llamadas.push({ url: texto, metodo, body: opts.body ? JSON.parse(opts.body) : null });
    const r = rutas.find(([frag, m]) => texto.includes(frag) && m === metodo);
    return r ? respuesta(r[2], r[3]) : respuesta({});
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const boton = (texto) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === texto);
const posts = (frag) => llamadas.filter((l) => l.metodo !== 'GET' && l.url.includes(frag));
const gets = (frag) => llamadas.filter((l) => l.metodo === 'GET' && l.url.includes(frag));
const grupo = (nombre) => screen.getByRole('radiogroup', { name: nombre });
const elegir = (nombre, opcion) => fireEvent.click(within(grupo(nombre)).getByRole('radio', { name: opcion }));

const abrirRegistrar = async (seg = SEG) => {
  ruta('/seguimientos/hoy', 'GET', {
    fecha: '2026-09-27', total: 1, seguimientos: [seg], proximas_acciones: [], loop_a_recontactar: [],
  });
  render(<SeguimientosHoyPanel token="t" />);
  await screen.findByText('Juan Pérez');
  fireEvent.click(boton('Registrar'));
  fireEvent.change(screen.getByLabelText(/Resultado/), { target: { value: 'Hablamos' } });
};

describe('Registrar toque · ¿hubo respuesta? sin default', () => {
  it('Confirmar está deshabilitado y no se envía nada hasta elegir', async () => {
    await abrirRegistrar();
    expect(within(grupo('¿Hubo respuesta?')).getAllByRole('radio')
      .every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);
    expect(boton('Confirmar').disabled).toBe(true);
    fireEvent.submit(boton('Confirmar').closest('form'));
    await new Promise((r) => setTimeout(r, 20));
    expect(posts('/registrar')).toHaveLength(0);
  });

  it('toques 1 y 2 sin respuesta: el formulario de próxima acción NO se muestra', async () => {
    await abrirRegistrar({ ...SEG, numero_de_toque: 2 });
    elegir('¿Hubo respuesta?', 'No');
    expect(screen.queryByRole('radiogroup', { name: 'Próxima acción' })).toBeNull();
  });

  it('con respuesta: la próxima acción es obligatoria y viaja con fecha a las 10:00', async () => {
    await abrirRegistrar();
    elegir('¿Hubo respuesta?', 'Sí');
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    elegir('Canal', 'Llamada');
    elegir('Próxima acción', 'Recotizar');
    fireEvent.click(within(screen.getByRole('group', { name: 'Cuándo' })).getByRole('button', { name: '5 días' }));
    fireEvent.change(screen.getByLabelText(/Nota/), { target: { value: 'pide franquicia' } });
    fireEvent.click(boton('Confirmar'));

    await waitFor(() => expect(posts('/registrar')).toHaveLength(1));
    expect(posts('/registrar')[0].body).toEqual({
      resultado: 'Hablamos',
      hubo_respuesta: true,
      canal: 'LLAMADA',
      proxima_accion: {
        tipo: 'RECOTIZAR', fecha: `${sumarDias(hoyAr(), 5)}T10:00:00`, nota: 'pide franquicia',
      },
    });
  });

  it('con respuesta y sin elegir la acción no se envía', async () => {
    await abrirRegistrar();
    elegir('¿Hubo respuesta?', 'Sí');
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    fireEvent.click(boton('Confirmar'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(posts('/registrar')).toHaveLength(0);
  });

  it('un 422 deja el modal abierto con el texto del backend', async () => {
    ruta('/registrar', 'POST', {
      detail: 'La `fecha` de la próxima acción tiene que ser futura (hora argentina)',
    }, 422);
    await abrirRegistrar();
    elegir('¿Hubo respuesta?', 'Sí');
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    elegir('Próxima acción', 'WhatsApp');
    fireEvent.click(within(screen.getByRole('group', { name: 'Cuándo' })).getByRole('button', { name: '3 días' }));
    fireEvent.click(boton('Confirmar'));

    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toContain('tiene que ser futura (hora argentina)');
    expect(screen.getByLabelText(/Resultado/).value).toBe('Hablamos');
    expect(boton('Confirmar')).toBeTruthy();
  });
});

describe('Registrar toque · LOOP', () => {
  const irALoop = async ({ track = 'AUTO', status = 200 } = {}) => {
    ruta('/crm/oportunidades/o-1', 'GET', { id: 'o-1', track }, status);
    await abrirRegistrar({ ...SEG, numero_de_toque: 3 });
    elegir('¿Hubo respuesta?', 'No');
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    elegir('Próxima acción', 'Sin próxima acción → LOOP');
  };

  it('toque 3 sin respuesta: LOOP con motivo, recontacto y resultado_loop sin default', async () => {
    await irALoop();
    await waitFor(() => expect(gets('/crm/oportunidades/o-1')).toHaveLength(1));
    expect(within(grupo('Resultado del LOOP')).getAllByRole('radio')
      .every((r) => r.getAttribute('aria-checked') === 'false')).toBe(true);

    fireEvent.change(screen.getByLabelText(/Motivo del LOOP/), { target: { value: 'OTRO' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Recontacto' })).getByRole('button', { name: '60 días' }));
    elegir('Resultado del LOOP', 'Sin efecto');
    fireEvent.click(boton('Confirmar'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/detalle/);

    fireEvent.change(screen.getByLabelText(/Detalle del motivo/), { target: { value: 'se va del país' } });
    fireEvent.click(boton('Confirmar'));
    await waitFor(() => expect(posts('/registrar')).toHaveLength(1));
    expect(posts('/registrar')[0].body.proxima_accion).toEqual({
      tipo: 'SIN_ACCION_LOOP', fecha_recontacto: sumarDias(hoyAr(), 60), loop_motivo: 'OTRO',
      loop_motivo_detalle: 'se va del país', resultado_loop: 'SIN_EFECTO',
    });
    // Una sola lectura del track por modal.
    expect(gets('/crm/oportunidades/o-1')).toHaveLength(1);
  });

  it('fuera de ART las alícuotas no se muestran, aun con CON_EFECTO', async () => {
    await irALoop({ track: 'AUTO' });
    await waitFor(() => expect(gets('/crm/oportunidades/o-1')).toHaveLength(1));
    elegir('Resultado del LOOP', 'Con efecto');
    expect(screen.queryByLabelText(/Alícuota previa/)).toBeNull();
  });

  it('en ART las alícuotas aparecen con CON_EFECTO', async () => {
    await irALoop({ track: 'ART' });
    await waitFor(() => expect(screen.queryByText(/Leyendo el ramo/)).toBeNull());
    elegir('Resultado del LOOP', 'Con efecto');
    expect(screen.getByLabelText(/Alícuota previa/)).toBeTruthy();
  });

  it('si falla la lectura del track: SIN_EFECTO se envía; CON_EFECTO pide reintentar', async () => {
    await irALoop({ status: 500 });
    await screen.findByText(/No se pudo leer el ramo/);
    fireEvent.change(screen.getByLabelText(/Motivo del LOOP/), { target: { value: 'PRECIO' } });
    fireEvent.click(within(screen.getByRole('group', { name: 'Recontacto' })).getByRole('button', { name: '30 días' }));
    elegir('Resultado del LOOP', 'Con efecto');
    expect(screen.queryByLabelText(/Alícuota previa/)).toBeNull();
    fireEvent.click(boton('Confirmar'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/Reintentá/);
    expect(posts('/registrar')).toHaveLength(0);

    fireEvent.click(boton('Reintentar'));
    await waitFor(() => expect(gets('/crm/oportunidades/o-1')).toHaveLength(2));

    elegir('Resultado del LOOP', 'Sin efecto');
    fireEvent.click(boton('Confirmar'));
    await waitFor(() => expect(posts('/registrar')).toHaveLength(1));
  });
});

describe('Seguimientos de hoy · listas nuevas', () => {
  const PA = (extra = {}) => ({
    tarea_id: 't-1', oportunidad_id: 'o-1', oportunidad_token: 'OPO-0001', tipo_accion: 'WHATSAPP',
    tipo_tarea: 'WHATSAPP', titulo: 'Próxima acción: escribir por WhatsApp', nota: null,
    fecha_programada: '2026-09-27T13:00:00', vencida: false, nombre: 'Ana', telefono: '+54 9 341 695-2259',
    track: 'AUTO', impedimento: null, ...extra,
  });

  beforeEach(() => {
    ruta('/seguimientos/hoy', 'GET', {
      fecha: '2026-09-27', total: 0, seguimientos: [],
      proximas_acciones: [
        PA({ tarea_id: 't-1', nombre: 'Ana' }),
        PA({ tarea_id: 't-2', nombre: 'Beto', tipo_accion: 'LLAMAR', vencida: true, fecha_programada: '2026-09-25T13:00:00' }),
        PA({ tarea_id: 't-3', nombre: 'Caro', track: 'ART', tipo_accion: 'RECOTIZAR', impedimento: IMPEDIMENTO }),
      ],
      loop_a_recontactar: [{
        oportunidad_id: 'o-9', oportunidad_token: 'OPO-0009', track: 'AUTO', fecha_recontacto: '2026-09-20',
        dias_vencido: 7, loop_motivo: 'PRECIO', loop_motivo_detalle: null, nombre: 'Dani',
        telefono: '3416952259', impedimento: null,
      }],
    });
  });

  it('próximas acciones: vencidas primero, badge del tipo, WhatsApp, tel: e impedimento', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    const filas = await screen.findAllByTestId('fila-proxima-accion');
    expect(filas.map((f) => f.textContent)).toEqual([
      expect.stringContaining('Beto'), expect.stringContaining('Ana'), expect.stringContaining('Caro'),
    ]);
    expect(filas[0].textContent).toContain('Vencida');
    expect(within(filas[0]).getByText('Llamar')).toBeTruthy();
    expect(within(filas[0]).getByRole('link', { name: /Llamar/ }).getAttribute('href')).toBe('tel:+5493416952259');
    expect(within(filas[1]).getByRole('link', { name: /Abrir WhatsApp/ }).getAttribute('href'))
      .toContain('wa.me/5493416952259');
    expect(within(filas[2]).getByTestId('badge-impedida')).toBeTruthy();
    expect(within(filas[2]).queryByRole('link')).toBeNull();
  });

  it('LOOP a recontactar: días vencido, motivo y WhatsApp', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    const fila = await screen.findByTestId('fila-loop');
    expect(fila.textContent).toContain('Vencido hace 7 días');
    expect(fila.textContent).toContain('Motivo: Precio');
    expect(within(fila).getByRole('link', { name: /Abrir WhatsApp/ })).toBeTruthy();
  });

  it('Completar desde la lista usa el track de la fila (sin pedir la oportunidad) y manda la siguiente', async () => {
    ruta('/tareas/t-3/completar', 'PATCH', { id: 't-3', proxima_accion: { tipo: 'LLAMAR', fecha_programada: '2026-10-02T13:00:00' } });
    render(<SeguimientosHoyPanel token="t" />);
    const filas = await screen.findAllByTestId('fila-proxima-accion');
    fireEvent.click(within(filas[2]).getByRole('button', { name: /Completar/ }));
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    elegir('Próxima acción', 'Sin próxima acción → LOOP');
    elegir('Resultado del LOOP', 'Con efecto');
    // ART conocido por la fila: alícuotas visibles sin GET de la oportunidad.
    expect(screen.getByLabelText(/Alícuota previa/)).toBeTruthy();
    expect(gets('/crm/oportunidades/')).toHaveLength(0);

    elegir('Próxima acción', 'Llamar');
    fireEvent.click(within(screen.getByRole('group', { name: 'Cuándo' })).getByRole('button', { name: '7 días' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Completar' }).find((b) => b.type === 'submit'));
    await waitFor(() => expect(posts('/tareas/t-3/completar')).toHaveLength(1));
    expect(posts('/tareas/t-3/completar')[0].body).toEqual({
      proxima_accion: { tipo: 'LLAMAR', fecha: `${sumarDias(hoyAr(), 7)}T10:00:00`, nota: null },
    });
  });
});

describe('Tarjeta ADMIN · sin próxima acción', () => {
  it('ADMIN ve el total y el detalle desplegable con link a la ficha', async () => {
    ruta('/metricas/sin-proxima-accion', 'GET', {
      universo: 'x', total: 2, por_track_y_estado: [], detalle_truncado: false,
      detalle: [
        { oportunidad_id: 'o-5', token: 'OPO-5', id_corto: 'abcd1234', nombre: 'Eva', track: 'AUTO', estado_crm: 'DATO' },
        { oportunidad_id: 'o-6', token: 'OPO-6', id_corto: 'ef567890', nombre: 'Fede', track: 'ART', estado_crm: 'POTENCIAL' },
      ],
    });
    render(<SeguimientosHoyPanel token="t" esAdmin />);
    const card = await screen.findByTestId('sin-proxima-accion');
    expect(card.textContent).toContain('Oportunidades sin próxima acción: 2');
    expect(within(card).queryByText('Eva')).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: /sin próxima acción/ }));
    expect(within(card).getByText('Eva')).toBeTruthy();
    expect(within(card).getByText('ART · POTENCIAL')).toBeTruthy();
  });

  it('sin ADMIN no se pide ni se muestra', async () => {
    render(<SeguimientosHoyPanel token="t" />);
    await screen.findByText('Juan Pérez');
    expect(gets('/metricas/sin-proxima-accion')).toHaveLength(0);
    expect(screen.queryByTestId('sin-proxima-accion')).toBeNull();
  });
});

describe('Agenda · completar', () => {
  const tarea = (extra = {}) => ({
    id: 't-1', titulo: 'Llamar al contador', tipo: 'LLAMADA', prioridad: 'MEDIA', estado: 'PENDIENTE',
    fecha_programada: '2026-09-28T13:00:00', oportunidad_id: 'o-1', origen: null, ...extra,
  });

  it('una tarea libre se completa con PATCH de cuerpo vacío y sin modal (tras confirmar, C-9g)', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    ruta('/crm/tareas/agenda', 'GET', { vencidas: [], dias: { '2026-09-28': [tarea()] } });
    render(<AgendaPanel token="t" />);
    fireEvent.click(await screen.findByLabelText('Completar Llamar al contador'));
    await waitFor(() => expect(posts('/tareas/t-1/completar')).toHaveLength(1));
    expect(posts('/tareas/t-1/completar')[0].body).toEqual({});
    expect(screen.queryByRole('radiogroup', { name: 'Próxima acción' })).toBeNull();
    confirmar.mockRestore();
  });

  it('una tarea PROXIMA_ACCION abre el formulario y lee el track sólo al elegir LOOP', async () => {
    ruta('/crm/tareas/agenda', 'GET', {
      vencidas: [], dias: { '2026-09-28': [tarea({ titulo: 'Próxima acción: llamar', origen: 'PROXIMA_ACCION' })] },
    });
    ruta('/crm/oportunidades/o-1', 'GET', { id: 'o-1', track: 'ART' });
    ruta('/tareas/t-1/completar', 'PATCH', { id: 't-1', proxima_accion: null });
    render(<AgendaPanel token="t" />);
    fireEvent.click(await screen.findByLabelText('Completar Próxima acción: llamar'));
    await screen.findByRole('radiogroup', { name: 'Próxima acción' });
    expect(posts('/completar')).toHaveLength(0);
    expect(gets('/crm/oportunidades/o-1')).toHaveLength(0);

    elegir('Próxima acción', 'Sin próxima acción → LOOP');
    await waitFor(() => expect(gets('/crm/oportunidades/o-1')).toHaveLength(1));
  });
});
