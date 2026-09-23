// @vitest-environment jsdom
//
// C-17 / D-C25 / D-C23 / D-C26 / L-2, desde la pantalla.
//
// LO QUE BLINDA:
//
// 1. EL FORMULARIO SE DIBUJA CON `campos` DEL BACKEND. Si alguien vuelve a
//    copiar el catálogo en el front, un campo nuevo del backend deja de
//    aparecer y este test se cae.
// 2. "Enviar a cotizar" está DESHABILITADO mientras la completitud sea < 100,
//    con los faltantes en el tooltip. Habilitarlo sería un 422 asegurado y,
//    peor, un 422 que no dice qué falta si la pantalla no lo lee.
// 3. El 422 del backend se muestra como LISTA de faltantes.
// 4. El PUT es un MERGE: viaja sólo lo tocado. Mandar el formulario entero
//    con los vacíos convertiría cada guardado en un borrado silencioso.
// 5. `gnc` es un desplegable de TRES opciones, no un checkbox: `null` cuenta
//    como faltante y `false` no.
// 6. "No colocable" sólo se ofrece en DATO/PROSPECTO, y OTRO pide detalle.
// 7. El selector de visibilidad (L-2) NO se le dibuja a un agente.
// 8. El reemplazo de documentos (D-C26) es un OFRECIMIENTO que aparece con la
//    subida y sólo cuando el backend manda `reemplazables`.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import RiesgoTab from './RiesgoTab';
import ExpedienteDocumentos from './ExpedienteDocumentos';
import SelectorVisibilidad from './SelectorVisibilidad';
import { VISIBILIDADES, ACTIVOS, TODOS } from './visibilidadListados';
import IdCorto from './IdCorto';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

// Un track inventado A PROPÓSITO: el front no puede tener opinión sobre qué
// campos existen. Si esta pantalla dibujara su propia lista, "Color del casco"
// no aparecería en ningún lado.
const FICHA_AUTO = {
  oportunidad_id: 'op-1',
  track: 'AUTO',
  completitud: 75,
  faltantes: ['Código postal de guarda', '¿Tiene GNC?'],
  valores: { marca: 'Citroën', modelo: 'C3', anio: 2015, gnc: null, cp: null },
  campos: [
    { clave: 'patente', titulo: 'Patente', tipo: 'patente', fuente: 'columna', requerido: true, opciones: [], editable: true, ayuda: null },
    { clave: 'marca', titulo: 'Marca', tipo: 'texto', fuente: 'json', requerido: true, opciones: [], editable: true, ayuda: null },
    { clave: 'cp', titulo: 'Código postal de guarda', tipo: 'texto', fuente: 'json', requerido: true, opciones: [], editable: true, ayuda: 'Dónde duerme el vehículo' },
    { clave: 'gnc', titulo: '¿Tiene GNC?', tipo: 'booleano', fuente: 'json', requerido: true, opciones: [], editable: true, ayuda: null },
    { clave: 'uso', titulo: 'Uso', tipo: 'opcion', fuente: 'json', requerido: true, opciones: ['PARTICULAR', 'COMERCIAL'], editable: true, ayuda: null },
    { clave: 'casco', titulo: 'Color del casco', tipo: 'texto', fuente: 'json', requerido: false, opciones: [], editable: true, ayuda: null },
    { clave: 'cuit', titulo: 'CUIT de la empresa', tipo: 'texto', fuente: 'empresa', requerido: true, opciones: [], editable: false, ayuda: 'Sale de la empresa vinculada' },
  ],
  actualizado_en: null,
  enviada_a_cotizar_en: null,
  riesgo_huella: null,
  cambios_sin_enviar: false,
};

const OPORTUNIDAD = { id: 'op-1', estado_crm: 'PROSPECTO', track: 'AUTO' };

const montarFicha = async (ficha = FICHA_AUTO, oportunidad = OPORTUNIDAD) => {
  render(<RiesgoTab token="t" oportunidad={oportunidad} onCambio={() => {}} />);
  await screen.findByText(/Completitud de la ficha/);
  return ficha;
};

describe('C-17 · la pestaña Riesgo', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('/riesgo')) return respuesta(FICHA_AUTO);
      if (String(url).includes('/catalogos/no-colocable')) {
        return respuesta({ motivos: ['SIN_MERCADO', 'OTRO'], estados_permitidos: ['DATO', 'PROSPECTO'] });
      }
      return respuesta({});
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('dibuja el formulario con los `campos` del backend, incluso uno que el front no conoce', async () => {
    await montarFicha();
    expect(screen.getByLabelText(/Color del casco/)).toBeTruthy();
    expect(screen.getByLabelText(/Marca/)).toBeTruthy();
  });

  it('el CUIT se muestra pero NO se edita: sale de la empresa vinculada', async () => {
    await montarFicha();
    const cuit = screen.getByLabelText(/CUIT de la empresa/);
    expect(cuit.disabled).toBe(true);
  });

  it('`gnc` es un desplegable de tres opciones y no un checkbox', async () => {
    await montarFicha();
    const gnc = screen.getByLabelText(/¿Tiene GNC\?/);
    expect(gnc.tagName).toBe('SELECT');
    // "Sin declarar" tiene que existir: null cuenta como faltante y false no,
    // y un checkbox no puede expresar la diferencia.
    expect([...gnc.options].map(o => o.value)).toEqual(['', 'true', 'false']);
  });

  it('muestra la completitud y la lista de faltantes', async () => {
    await montarFicha();
    expect(screen.getByText('75%')).toBeTruthy();
    // En la LISTA de faltantes (el <li>), no en la etiqueta del campo: el
    // título aparece en los dos lugares y lo que se verifica acá es que la
    // lista exista.
    expect(screen.getAllByRole('listitem').map(li => li.textContent))
      .toContain('Código postal de guarda');
  });

  it('"Enviar a cotizar" está deshabilitado con la ficha incompleta, con los faltantes en el tooltip', async () => {
    await montarFicha();
    const boton = screen.getByRole('button', { name: /Enviar a cotizar/ });
    expect(boton.disabled).toBe(true);
    // El title va en el CONTENEDOR: un botón deshabilitado no dispara eventos
    // de mouse, así que el tooltip puesto en el botón no aparecería justo
    // cuando hace falta.
    expect(boton.parentElement.getAttribute('title')).toContain('Código postal de guarda');
  });

  it('el PUT manda SÓLO lo tocado (merge), no el formulario entero', async () => {
    await montarFicha();
    fireEvent.change(screen.getByLabelText(/Código postal de guarda/), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar ficha/ }));

    await waitFor(() => {
      const put = globalThis.fetch.mock.calls.find(([, init]) => init?.method === 'PUT');
      expect(put).toBeTruthy();
      expect(JSON.parse(put[1].body)).toEqual({ valores: { cp: '2000' } });
    });
  });

  it('el 422 de ficha incompleta se muestra como lista de faltantes, no como "Error 422"', async () => {
    const completa = { ...FICHA_AUTO, completitud: 100, faltantes: [] };
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('enviar-a-cotizar')) {
        return respuesta({ detail: 'Ficha incompleta. Falta: Patente; ¿Tiene GNC?' }, 422);
      }
      if (String(url).includes('/riesgo')) return respuesta(completa);
      return respuesta({});
    });
    render(<RiesgoTab token="t" oportunidad={OPORTUNIDAD} onCambio={() => {}} />);
    await screen.findByText('100%');

    fireEvent.click(screen.getByRole('button', { name: /Enviar a cotizar/ }));
    await screen.findByText(/La ficha está incompleta/);
    expect(screen.getAllByRole('listitem').map(li => li.textContent))
      .toContain('¿Tiene GNC?');
  });

  it('con la ficha al 100% el envío sale y la respuesta dice a qué estado pasó', async () => {
    const completa = { ...FICHA_AUTO, completitud: 100, faltantes: [] };
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('enviar-a-cotizar')) {
        return respuesta({
          oportunidad_id: 'op-1', token: 'AYMA-OPP-1', cambio: true,
          estado_anterior: 'DATO', estado_crm: 'PROSPECTO', estado_cambio: true,
          puntos: 10, completitud: 100, riesgo_huella: 'abc',
        }, 201);
      }
      if (String(url).includes('/riesgo')) return respuesta(completa);
      return respuesta({});
    });
    render(<RiesgoTab token="t" oportunidad={OPORTUNIDAD} onCambio={() => {}} />);
    await screen.findByText('100%');
    fireEvent.click(screen.getByRole('button', { name: /Enviar a cotizar/ }));
    await screen.findByText(/pasa a PROSPECTO/);
  });
});

describe('D-C23 · no colocable', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async (url) => {
      if (String(url).includes('/catalogos/no-colocable')) {
        return respuesta({ motivos: ['SIN_MERCADO', 'OTRO'], estados_permitidos: ['DATO', 'PROSPECTO'] });
      }
      if (String(url).includes('/riesgo')) return respuesta(FICHA_AUTO);
      if (String(url).includes('/catalogos/companias')) return respuesta({ companias: [] });
      return respuesta({});
    });
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('se ofrece en PROSPECTO', async () => {
    await montarFicha();
    expect(screen.getByRole('button', { name: /No colocable/ })).toBeTruthy();
  });

  it('NO se ofrece en POTENCIAL: ahí ya hubo una cotización, o sea que el mercado sí lo colocó', async () => {
    render(<RiesgoTab token="t" oportunidad={{ ...OPORTUNIDAD, estado_crm: 'POTENCIAL' }} onCambio={() => {}} />);
    await screen.findByText(/Completitud de la ficha/);
    expect(screen.queryByRole('button', { name: /No colocable/ })).toBeNull();
  });

  it('el motivo OTRO exige detalle antes de mandar nada', async () => {
    await montarFicha();
    fireEvent.click(screen.getByRole('button', { name: /No colocable/ }));
    await screen.findByLabelText(/Motivo/);
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'OTRO' } });
    fireEvent.click(screen.getByRole('button', { name: /Marcar no colocable/ }));
    await screen.findByText(/pide un detalle/);
    // Nada se mandó: el POST ni se intentó. (El GET del catálogo termina en
    // la misma cadena, así que se mira el MÉTODO y no la URL.)
    expect(globalThis.fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
  });

  it('una ya marcada muestra el motivo y el botón de reabrir, no el de marcar', async () => {
    render(
      <RiesgoTab
        token="t"
        oportunidad={{ ...OPORTUNIDAD, no_colocable_en: '2026-09-20T10:00:00', no_colocable_motivo: 'SIN_MERCADO' }}
        onCambio={() => {}}
      />
    );
    await screen.findByText(/Sin mercado/);
    expect(screen.getByRole('button', { name: /Reabrir/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^No colocable$/ })).toBeNull();
  });
});

describe('D-C26 · documento reemplazado', () => {
  const POLIZA = { id: 'doc-2', tipo: 'POLIZA', nombre_archivo: 'poliza.pdf', reemplazables: [
    { id: 'doc-1', token: 't1', tipo: 'CERTIFICADO_PROVISORIO', nombre_archivo: 'provisorio.pdf', created_at: '2026-09-01T10:00:00' },
  ] };

  afterEach(() => { cleanup(); vi.restoreAllMocks(); });

  it('no ofrece nada cuando el backend no manda reemplazables', async () => {
    globalThis.fetch = vi.fn(async () => respuesta([]));
    render(<ExpedienteDocumentos token="t" oportunidadId="op-1" />);
    await screen.findByText(/Sin documentos en el expediente/);
    expect(screen.queryByText(/Deja histórico/)).toBeNull();
  });

  it('marca el reemplazo con un PATCH y NO borra nada', async () => {
    const patches = [];
    globalThis.fetch = vi.fn(async (url, init) => {
      if (init?.method === 'POST') return respuesta(POLIZA, 201);
      if (init?.method === 'PATCH') {
        patches.push({ url: String(url), body: JSON.parse(init.body) });
        return respuesta({ documento_id: 'doc-1', cambio: true, mensaje: 'Marcado' });
      }
      if (init?.method === "DELETE") throw new Error('el reemplazo NO puede borrar el documento viejo');
      return respuesta([
        { id: 'doc-1', tipo: 'CERTIFICADO_PROVISORIO', nombre_archivo: 'provisorio.pdf' },
      ]);
    });

    render(<ExpedienteDocumentos token="t" oportunidadId="op-1" />);
    await screen.findByText('provisorio.pdf');

    fireEvent.click(screen.getByRole('button', { name: /Subir documento/ }));
    const input = await screen.findByLabelText(/Archivo/);
    fireEvent.change(input, { target: { files: [new File(['x'], 'poliza.pdf')] } });
    fireEvent.click(screen.getByRole('button', { name: /^Subir$/ }));

    const boton = await screen.findByRole('button', { name: /Marcar el certificado provisorio como reemplazado/ });
    fireEvent.click(boton);

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0].url).toContain('/documentos/doc-1/reemplazado-por');
    expect(patches[0].body).toEqual({ reemplazado_por_id: 'doc-2' });
  });
});

describe('L-2 · visibilidad de los listados', () => {
  afterEach(cleanup);

  it('el vocabulario es uno solo y en el orden en que se muestra', () => {
    expect(VISIBILIDADES.map(v => v.valor)).toEqual(['activos', 'inactivos', 'anulados', 'todos']);
  });

  it('NO se le dibuja a un agente (D-C22)', () => {
    render(<SelectorVisibilidad valor={ACTIVOS} onCambio={() => {}} esAdmin={false} />);
    expect(screen.queryByLabelText('Ver')).toBeNull();
  });

  it('al ADMIN sí, y "Todos" aclara que las dadas de baja NO vuelven ahí', () => {
    render(<SelectorVisibilidad valor={TODOS} onCambio={() => {}} esAdmin />);
    expect(screen.getByLabelText('Ver')).toBeTruthy();
    expect(screen.getByText(/no vuelven acá/i)).toBeTruthy();
  });
});

describe('C-6m · el id corto', () => {
  afterEach(cleanup);

  it('usa el `id_corto` del backend y no lo recalcula', () => {
    render(<IdCorto valor="82ab6070" idCompleto="82ab6070-ffff-ffff" />);
    expect(screen.getByRole('button', { name: /Copiar el ID 82ab6070/ })).toBeTruthy();
  });

  it('cae a los 8 primeros sólo si el backend no lo mandó', () => {
    render(<IdCorto idCompleto="abcdefgh-1111" />);
    expect(screen.getByText('abcdefgh')).toBeTruthy();
  });
});
