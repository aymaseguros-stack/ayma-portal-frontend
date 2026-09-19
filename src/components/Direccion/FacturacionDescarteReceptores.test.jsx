// @vitest-environment jsdom
//
// Las dos cosas que cambian en esta pantalla (PR A1/A2 del backend), y lo
// que estos tests impiden que se vuelva atrás:
//
//  1. EL RECEPTOR SON LAS COMPAÑÍAS, NO EL CRM. El buscador pegaba a
//     /api/v1/crm/buscar, o sea a las empresas CLIENTE: a ésas no se les
//     factura. Tiene que pegarle a /facturas/receptores, que son las
//     aseguradoras y ART del padrón de proveedores.
//  2. DESCARTAR NO ES BORRAR. La confirmación tiene que decir, ANTES de que
//     el operador apriete, que primero se le consulta a ARCA y que si ARCA
//     lo tiene NO se descarta. Y las descartadas no se listan salvo que se
//     las pida.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import TabFacturacion from './DireccionFacturacion';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
});

const ESTADO_PRENDIDO = {
  habilitado: true, ambiente: 'homologacion', produccion: false, configurado: true,
  faltantes: [], condicion_emisor: 'MONOTRIBUTO',
  tipos_habilitados: ['FACTURA_C'], punto_venta: 1,
  cuit_emisor_ultimos_digitos: '014',
  certificado: { disponible: true, sujeto: 'CN=ayma', vence: '2027-01-01T00:00:00' },
  ticket: { existe: true, vigente: true, vigente_hasta: '2026-09-19T20:00:00', ambiente: 'homologacion' },
  arca: { consultado: true, appserver: 'OK', dbserver: 'OK', authserver: 'OK' },
  qr_disponible: true,
};

const RESUMEN = {
  anio: 2026, mes: 9, ambiente: 'homologacion', cantidad: 2,
  por_estado: { AUTORIZADA: 2 }, por_tipo: {},
  total_autorizado_neto_de_notas_de_credito: '20000.00',
};

const VACIO = { total: 0, limit: 50, offset: 0, items: [] };

const COMPANIAS = [
  {
    id: 'p1', nombre: 'SAN CRISTOBAL SEGUROS', cuit: '30500003701',
    tipo: 'ASEGURADORA', falta_cuit: false,
    receptor: {
      tipo_documento: 'CUIT', numero_documento: '30500003701',
      razon_social: 'SAN CRISTOBAL SEGUROS', condicion_iva: 'RESPONSABLE_INSCRIPTO',
      domicilio: null, email: null,
    },
  },
  {
    id: 'p2', nombre: 'PREVENCION ART', cuit: null, tipo: 'ART', falta_cuit: true,
    receptor: {
      tipo_documento: 'CUIT', numero_documento: '',
      razon_social: 'PREVENCION ART', condicion_iva: 'RESPONSABLE_INSCRIPTO',
      domicilio: null, email: null,
    },
  },
];

// La 0001-00000001 del incidente: ENVIANDO, con número y SIN CAE.
const COLGADA = {
  id: 'f1', estado: 'ENVIANDO', ambiente: 'homologacion',
  tipo_comprobante: 'FACTURA_C', numero: 1, numero_completo: '0001-00000001',
  fecha_comprobante: '2026-09-19', importe_total: '10000.00', moneda: 'PES',
  receptor_razon_social: 'SAN CRISTOBAL SEGUROS', receptor_tipo_documento: 'CUIT',
  receptor_numero_documento: '30500003701', cae: null, items: [],
  descartable: true,
};

let llamadas;

const base = (extra) => vi.fn((url, init) => {
  const u = String(url);
  llamadas.push({ url: u, init, metodo: init?.method || 'GET' });
  const propia = extra?.(u, init);
  if (propia) return propia;
  if (u.includes('/facturas/estado')) return Promise.resolve(respuesta(ESTADO_PRENDIDO));
  if (u.includes('/facturas/resumen/')) return Promise.resolve(respuesta(RESUMEN));
  if (u.includes('/facturas/parametros')) return Promise.resolve(respuesta({}));
  return Promise.resolve(respuesta(VACIO));
});

beforeEach(() => { llamadas = []; globalThis.fetch = base(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const abrirNueva = async () => {
  fireEvent.click(await screen.findByText('+ Nueva factura'));
  await screen.findByText('Receptor');
};

// ---------------------------------------------------------------------------
// A2 - el receptor
// ---------------------------------------------------------------------------

describe('Buscador del receptor: compañías, no el CRM', () => {
  it('le pega a /facturas/receptores y NUNCA a /crm/buscar', async () => {
    globalThis.fetch = base((u) => (
      u.includes('/facturas/receptores') ? Promise.resolve(respuesta(COMPANIAS)) : null
    ));

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirNueva();

    // El rótulo dice a quién se busca: no es "empresa del CRM".
    const campo = screen.getByLabelText('Buscar compañía (aseguradora o ART)');
    fireEvent.change(campo, { target: { value: 'cristobal' } });
    fireEvent.click(screen.getByText('Buscar'));

    await screen.findByText('SAN CRISTOBAL SEGUROS');
    const buscada = llamadas.find((l) => l.url.includes('/facturas/receptores'));
    expect(buscada).toBeTruthy();
    expect(buscada.url).toContain('q=cristobal');
    // EL ARREGLO, literal: el CRM no se consulta más para esto.
    expect(llamadas.some((l) => l.url.includes('/crm/buscar'))).toBe(false);
  });

  it('elegir una compañía completa el receptor con el snapshot del backend', async () => {
    globalThis.fetch = base((u) => (
      u.includes('/facturas/receptores') ? Promise.resolve(respuesta(COMPANIAS)) : null
    ));

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirNueva();
    fireEvent.change(screen.getByLabelText('Buscar compañía (aseguradora o ART)'),
      { target: { value: 'cristobal' } });
    fireEvent.click(screen.getByText('Buscar'));

    fireEvent.click(await screen.findByText('SAN CRISTOBAL SEGUROS'));

    await waitFor(() => {
      expect(screen.getByLabelText('Razón social').value).toBe('SAN CRISTOBAL SEGUROS');
    });
    expect(screen.getByLabelText('Número de documento').value).toBe('30500003701');
    expect(screen.getByLabelText('Condición frente al IVA').value).toBe('RESPONSABLE_INSCRIPTO');
  });

  it('la compañía sin CUIT se muestra marcada, se puede elegir, y avisa dónde cargarlo', async () => {
    globalThis.fetch = base((u) => (
      u.includes('/facturas/receptores') ? Promise.resolve(respuesta(COMPANIAS)) : null
    ));

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirNueva();
    fireEvent.change(screen.getByLabelText('Buscar compañía (aseguradora o ART)'),
      { target: { value: 'a' } });
    fireEvent.click(screen.getByText('Buscar'));

    // NO SE ESCONDE: esconderla llevaría a cargar la compañía duplicada.
    await screen.findByText('PREVENCION ART');
    expect(screen.getByText(/SIN CUIT CARGADO/)).toBeTruthy();

    fireEvent.click(screen.getByText('PREVENCION ART'));
    const aviso = await screen.findByRole('alert');
    expect(aviso.textContent).toMatch(/no tiene CUIT cargado/);
    expect(aviso.textContent).toMatch(/Proveedores/);
    // Y el campo queda vacío para tipearlo: el backend no lo inventa.
    expect(screen.getByLabelText('Número de documento').value).toBe('');
    expect(screen.getByLabelText('Razón social').value).toBe('PREVENCION ART');
  });

  it('el atajo Consumidor Final y la carga a mano siguen estando', async () => {
    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await abrirNueva();

    fireEvent.click(screen.getByText('Consumidor Final'));
    await waitFor(() => {
      expect(screen.getByLabelText('Razón social').value).toBe('Consumidor Final');
    });

    fireEvent.change(screen.getByLabelText('Razón social'), { target: { value: 'A MANO SRL' } });
    expect(screen.getByLabelText('Razón social').value).toBe('A MANO SRL');
  });
});

// ---------------------------------------------------------------------------
// A1 - el descarte
// ---------------------------------------------------------------------------

describe('Descartar un comprobante colgado', () => {
  const conColgada = (extra) => base((u, init) => {
    const propia = extra?.(u, init);
    if (propia) return propia;
    if (u.match(/\/facturas\/f1$/)) return Promise.resolve(respuesta(COLGADA));
    if (u.match(/\/facturas(\?|$)/) && init?.method !== 'POST') {
      return Promise.resolve(respuesta({ total: 1, limit: 50, offset: 0, items: [COLGADA] }));
    }
    return null;
  });

  const abrirDetalle = async () => {
    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    fireEvent.click(await screen.findByText('Ver detalle'));
    await screen.findByText('Descargar PDF');
  };

  it('la confirmación explica que PRIMERO se consulta a ARCA y que si la tiene no se descarta', async () => {
    globalThis.fetch = conColgada();
    await abrirDetalle();

    fireEvent.click(screen.getByText('Descartar'));

    // LO QUE HAY QUE LEER ANTES DE APRETAR. El párrafo entero, porque el
    // texto está partido por los <strong> que le dan el énfasis.
    const explicacion = (await screen.findByText(/Primero se le/)).closest('p');
    expect(explicacion.textContent).toMatch(/consulta a ARCA/i);
    expect(explicacion.textContent).toMatch(/no se descarta/i);
    expect(explicacion.textContent).toMatch(/adopta su CAE/i);
    expect(screen.getByText(/No se borra nada/i)).toBeTruthy();

    // El botón lo dice también: no dice "Borrar".
    expect(screen.getByText('Consultar a ARCA y descartar')).toBeTruthy();
    expect(screen.queryByText(/^Borrar/)).toBeNull();
  });

  it('no deja descartar sin motivo y manda el motivo al backend', async () => {
    globalThis.fetch = conColgada((u, init) => (
      u.includes('/descartar') && init?.method === 'POST'
        ? Promise.resolve(respuesta({
          descartada: true, consultado_arca: true,
          detalle: 'ARCA no tiene el comprobante 0001-00000001: quedó DESCARTADA.',
          factura: { ...COLGADA, estado: 'DESCARTADA', numero_completo: null, descartable: false },
        }))
        : null
    ));
    await abrirDetalle();
    fireEvent.click(screen.getByText('Descartar'));

    const confirmar = screen.getByText('Consultar a ARCA y descartar');
    expect(confirmar.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText(/Motivo \(queda guardado/),
      { target: { value: 'Basura del bug de lock' } });
    expect(confirmar.disabled).toBe(false);
    fireEvent.click(confirmar);

    await waitFor(() => {
      const post = llamadas.find((l) => l.url.includes('/descartar') && l.metodo === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(post.init.body)).toEqual({ motivo: 'Basura del bug de lock' });
    });
  });

  it('si ARCA LO TIENE avisa que se adoptó su CAE y NO lo muestra como error rojo', async () => {
    globalThis.fetch = conColgada((u, init) => {
      if (u.includes('/descartar') && init?.method === 'POST') {
        return Promise.resolve(respuesta({
          detail: {
            error: 'operacion_no_permitida', motivo: 'arca_lo_tiene', reconciliado: true,
            mensaje: 'ARCA SÍ tiene el comprobante 0001-00000001: no se descartó nada. '
              + 'Se adoptó su CAE (75123456789012) y el comprobante quedó AUTORIZADA.',
          },
        }, 409));
      }
      return null;
    });
    await abrirDetalle();
    fireEvent.click(screen.getByText('Descartar'));
    fireEvent.change(screen.getByLabelText(/Motivo \(queda guardado/),
      { target: { value: 'creí que era basura' } });
    fireEvent.click(screen.getByText('Consultar a ARCA y descartar'));

    // AVISO (role=status), no error rojo: no falló nada, el comprobante
    // quedó mejor de lo que estaba. `findAllByRole` porque el cartel de
    // ambiente también es un role=status, y con razón.
    const aviso = await screen.findByText(/ARCA SÍ tiene el comprobante/);
    expect(aviso.getAttribute('role')).toBe('status');
    expect(aviso.textContent).toMatch(/AUTORIZADA/);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('una AUTORIZADA no ofrece Descartar: se anula con nota de crédito', async () => {
    const autorizada = {
      ...COLGADA, id: 'f9', estado: 'AUTORIZADA', cae: '75123456789012',
      numero_completo: '0001-00000002', descartable: false,
    };
    globalThis.fetch = base((u, init) => {
      if (u.match(/\/facturas\/f9$/)) return Promise.resolve(respuesta(autorizada));
      if (u.match(/\/facturas(\?|$)/) && init?.method !== 'POST') {
        return Promise.resolve(respuesta({ total: 1, limit: 50, offset: 0, items: [autorizada] }));
      }
      return null;
    });

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    fireEvent.click(await screen.findByText('Ver detalle'));
    await screen.findByText('Descargar PDF');

    expect(screen.queryByText('Descartar')).toBeNull();
    expect(screen.getByText('Anular')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// A1 - el listado y el conteo
// ---------------------------------------------------------------------------

describe('Las descartadas fuera del listado', () => {
  const DESCARTADA = {
    id: 'fd', estado: 'DESCARTADA', ambiente: 'homologacion',
    tipo_comprobante: 'FACTURA_C', numero_completo: null,
    fecha_comprobante: '2026-09-19', importe_total: '10000.00',
    receptor_razon_social: 'SAN CRISTOBAL SEGUROS', receptor_numero_documento: '30500003701',
    cae: null, motivo_descarte: 'Basura del bug de lock', descartada_en: '2026-09-19T12:00:00',
  };

  it('no se piden salvo tildar "Incluir descartadas", y ahí salen en gris con su motivo', async () => {
    globalThis.fetch = base((u, init) => {
      if (u.match(/\/facturas\?/) && init?.method !== 'POST') {
        return Promise.resolve(respuesta(
          u.includes('incluir_descartadas=true')
            ? { total: 1, limit: 50, offset: 0, items: [DESCARTADA] }
            : VACIO,
        ));
      }
      return null;
    });

    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    await waitFor(() => expect(
      llamadas.some((l) => l.url.match(/\/facturas\?/)),
    ).toBe(true));

    // Por default NO se piden: el backend ya las excluye y el front no
    // pide lo contrario.
    const primera = llamadas.find((l) => l.url.match(/\/facturas\?/));
    expect(primera.url).not.toContain('incluir_descartadas=true');

    fireEvent.click(screen.getByLabelText('Incluir descartadas'));

    const fila = await screen.findByText(/Basura del bug de lock/);
    // Con su motivo A LA VISTA: verla apagada sin saber por qué está
    // apagada es peor que no verla.
    expect(fila.textContent).toMatch(/^Descartada el /);
    const tr = fila.closest('tr');
    expect(tr.getAttribute('data-descartada')).toBe('si');
    expect(tr.className).toMatch(/opacity-50/);
  });

  it('el resumen no las cuenta: muestra lo que devuelve el backend', async () => {
    render(<TabFacturacion token="t" />);
    await screen.findByLabelText('Ambiente HOMOLOGACIÓN');
    // El backend ya excluye las DESCARTADAS de `cantidad` y de `por_estado`;
    // la pantalla no vuelve a sumar nada por su cuenta.
    const rotulo = await screen.findByText('Comprobantes');
    expect(rotulo.nextSibling.textContent).toBe('2');
    // Y no se informa un DESCARTADA: 0 al lado. Un estado con cero invita a
    // preguntar por él, y la respuesta no pertenece a un resumen.
    expect(screen.queryByText(/Descartada:/)).toBeNull();
  });
});
