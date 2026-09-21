// @vitest-environment jsdom
//
// La sub-pestaña "Puntos de contacto" (C-12B) contra el contrato real del
// backend (app/api/v1/comercial.py, PR #183).
//
// QUÉ DEFIENDE CADA BLOQUE, y por qué un "renderiza sin romper" no alcanzaría
// en ninguno:
//
// 1. LOS FILTROS VIAJAN AL BACKEND. Filtrarlos en el cliente sobre la página
//    ya traída es el bug que los filtros de Proveedores ya corrigieron una
//    vez: con el limit por default, "ninguno coincide" aparece cuando el
//    buscado está más atrás.
// 2. LAS MÉTRICAS SALEN DE /ranking. El listado NO las trae
//    (`PuntoContactoOut` no las declara), así que la tabla las cruza. Si ese
//    pedido falla, las celdas dicen "sin dato todavía" y NUNCA 0: un 0 hace
//    creer que se midió algo.
// 3. EL SLUG SE NORMALIZA A MINÚSCULAS antes de mandarse, porque es lo que
//    hace el backend y porque un QR se tipea a mano en mayúsculas.
// 4. EL PATCH NO MANDA `slug`. PuntoContactoPatch no lo declara: el slug
//    viaja impreso en un QR que ya está pegado en una pared.
// 5. EL QR NO SE PIDE COMO `<img src>`. El endpoint cuelga de require_admin
//    y un `<img>` no manda Authorization: volvería 401 y el navegador
//    mostraría el ícono de imagen rota.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import PuntosContactoPanel from './PuntosContactoPanel';

const respuesta = (data) => ({
  ok: true, status: 200, json: async () => data, clone: () => ({ json: async () => data }),
});
const blobPng = () => ({
  ok: true, status: 200, blob: async () => new Blob(['png'], { type: 'image/png' }),
  clone: () => ({ json: async () => ({}) }),
});

const PUNTO = {
  id: 'pc1', slug: 'jefa-auto', nombre: 'Mostrador de la jefa',
  tipo_punto: 'fisico', riesgo: 'AUTO', destino_tipo: 'landing_riesgo',
  destino_url: 'https://aymaseguros.com.ar/seguro-auto',
  proveedor_id: null, activo: true, vigente: true, vence_el: null,
  url_corta: 'https://aymaseguros.com.ar/r/jefa-auto',
  created_at: '2026-09-01T00:00:00', updated_at: '2026-09-01T00:00:00',
};

const METRICA = {
  punto_contacto_id: 'pc1', slug: 'jefa-auto', nombre: 'Mostrador de la jefa',
  escaneos: 40, leads: 6, conversion_pct: 15.0, cotizaciones: 3, emisiones: 1,
  emision_pct: 16.7, comision_estimada: '1200.00', comision_liquidada: '0.00',
  fuente: 'leads',
};

let pedidos;

const servidor = ({ rankingFalla = false } = {}) => vi.fn((url, init) => {
  const u = String(url);
  pedidos.push({ url: u, metodo: init?.method || 'GET', cuerpo: init?.body, headers: init?.headers });
  if (u.includes('/qr.png')) return Promise.resolve(blobPng());
  if (u.includes('/puntos-contacto/ranking')) {
    return rankingFalla
      ? Promise.resolve({ ok: false, status: 500, json: async () => ({ detail: 'boom' }), clone: () => ({ json: async () => ({ detail: 'boom' }) }) })
      : Promise.resolve(respuesta([METRICA]));
  }
  if (u.includes('/metricas')) return Promise.resolve(respuesta(METRICA));
  if (u.includes('/direccion/proveedores')) return Promise.resolve(respuesta([]));
  if (u.match(/\/puntos-contacto\/pc1(\?|$)/)) return Promise.resolve(respuesta(PUNTO));
  if (u.includes('/puntos-contacto')) return Promise.resolve(respuesta([PUNTO]));
  return Promise.resolve(respuesta([]));
});

beforeEach(() => {
  pedidos = [];
  globalThis.fetch = servidor();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:qr');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const listados = () => pedidos.filter((p) => /\/puntos-contacto(\?|$)/.test(p.url));

// ---------------------------------------------------------------------------
// 1. Los filtros
// ---------------------------------------------------------------------------

describe('filtros de puntos de contacto', () => {
  it('el tipo se manda como query al backend', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'fisico' } });
    await waitFor(() => expect(listados().some((p) => p.url.includes('tipo_punto=fisico'))).toBe(true));
  });

  it('el riesgo se manda como query al backend', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.change(screen.getByLabelText('Riesgo'), { target: { value: 'ART' } });
    await waitFor(() => expect(listados().some((p) => p.url.includes('riesgo=ART'))).toBe(true));
  });

  it('sin filtros no se manda ninguno: el contrato por default queda intacto', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    const primera = listados()[0].url;
    expect(primera).not.toMatch(/tipo_punto=/);
    expect(primera).not.toMatch(/riesgo=/);
    expect(primera).not.toMatch(/activo=/);
  });

  it('"Sólo apagados" manda activo=false y no se traga el false como vacío', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.change(screen.getByLabelText('Activo'), { target: { value: 'false' } });
    await waitFor(() => expect(listados().some((p) => p.url.includes('activo=false'))).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// 2. Las métricas
// ---------------------------------------------------------------------------

describe('métricas de la tabla', () => {
  it('se cruzan desde /ranking, porque el listado no las trae', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    expect(pedidos.some((p) => p.url.includes('/puntos-contacto/ranking'))).toBe(true);
    expect(await screen.findByText('40')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('si /ranking falla, las celdas dicen "sin dato todavía" y NUNCA 0', async () => {
    globalThis.fetch = servidor({ rankingFalla: true });
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    // La tabla sigue en pie (el punto se ve) y las métricas no inventan un cero.
    await waitFor(() => expect(screen.getAllByText('sin dato todavía').length).toBeGreaterThan(0));
    expect(screen.queryByText('40')).toBeNull();
  });

  it('un fallo del ranking no se lleva puesta la tabla', async () => {
    globalThis.fetch = servidor({ rankingFalla: true });
    render(<PuntosContactoPanel token="t" />);
    expect(await screen.findByText('Mostrador de la jefa')).toBeTruthy();
    expect(await screen.findByText('jefa-auto')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 3. El slug
// ---------------------------------------------------------------------------

describe('el slug', () => {
  const abrirAlta = async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.click(screen.getByText('Nuevo punto de contacto'));
    await screen.findByText('Nuevo punto de contacto', { selector: 'h3' });
  };

  it('se normaliza a minúsculas antes de mandarse', async () => {
    await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('jefa-auto'), { target: { value: 'JEFA-MOTO' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Jefa moto' } });
    fireEvent.change(screen.getByPlaceholderText('https://aymaseguros.com.ar/seguro-auto'),
      { target: { value: 'https://aymaseguros.com.ar/moto' } });
    fireEvent.click(screen.getByText('Crear punto'));

    await waitFor(() => {
      const post = pedidos.find((p) => p.metodo === 'POST');
      expect(post).toBeTruthy();
      expect(JSON.parse(post.cuerpo).slug).toBe('jefa-moto');
    });
  });

  it('un slug inválido no llega a mandarse: se avisa antes de llenar el resto', async () => {
    await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('jefa-auto'), { target: { value: 'con espacio' } });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'X' } });
    fireEvent.change(screen.getByPlaceholderText('https://aymaseguros.com.ar/seguro-auto'),
      { target: { value: 'https://a.com' } });
    fireEvent.click(screen.getByText('Crear punto'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(pedidos.some((p) => p.metodo === 'POST')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. El detalle: PATCH sin slug, y el QR con token
// ---------------------------------------------------------------------------

describe('detalle del punto', () => {
  const abrirDetalle = async () => {
    render(<PuntosContactoPanel token="t" />);
    fireEvent.click(await screen.findByText('jefa-auto'));
    await screen.findByText('QR y URL corta');
  };

  it('el PATCH de edición NO manda slug: viaja impreso en el QR', async () => {
    await abrirDetalle();
    fireEvent.click(screen.getByText('Editar'));
    await screen.findByText('Editar punto de contacto', { selector: 'h3' });
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Otro nombre' } });
    fireEvent.click(screen.getByText('Guardar cambios'));

    await waitFor(() => {
      const patch = pedidos.find((p) => p.metodo === 'PATCH');
      expect(patch).toBeTruthy();
      expect(JSON.parse(patch.cuerpo)).not.toHaveProperty('slug');
    });
  });

  it('el campo slug está deshabilitado al editar', async () => {
    await abrirDetalle();
    fireEvent.click(screen.getByText('Editar'));
    await screen.findByText('Editar punto de contacto', { selector: 'h3' });
    expect(screen.getByDisplayValue('jefa-auto').disabled).toBe(true);
  });

  it('el QR se pide con Authorization, no como <img src>', async () => {
    await abrirDetalle();
    await waitFor(() => {
      const qr = pedidos.find((p) => p.url.includes('/qr.png'));
      expect(qr).toBeTruthy();
      expect(qr.headers.Authorization).toBe('Bearer t');
    });
    // Y lo que termina en el <img> es una object URL, nunca la del endpoint.
    const img = await screen.findByAltText('Código QR del punto de contacto jefa-auto');
    expect(img.getAttribute('src')).toBe('blob:qr');
  });

  it('la descarga para imprenta pide el tamaño máximo que el backend acota', async () => {
    await abrirDetalle();
    await screen.findByAltText('Código QR del punto de contacto jefa-auto');
    fireEvent.click(screen.getByText('Descargar QR'));
    await waitFor(() =>
      expect(pedidos.some((p) => p.url.includes('/qr.png?size=2000'))).toBe(true));
  });

  it('el embudo declara que cuenta por el estado del lead, no por pólizas', async () => {
    await abrirDetalle();
    expect(await screen.findByText(/estado del lead/)).toBeTruthy();
  });

  it('no ofrece un rango de fechas: el endpoint de métricas no lo acepta', async () => {
    await abrirDetalle();
    await screen.findByText('Embudo');
    expect(screen.getByText(/no acepta un rango de fechas/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. El ranking
// ---------------------------------------------------------------------------

describe('ranking', () => {
  it('el orden lo resuelve el backend, no un sort en el cliente', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.click(screen.getByText('Ranking'));
    await screen.findByText('Ranking de puntos');
    fireEvent.change(screen.getByLabelText('Ordenar por'), { target: { value: 'conversion' } });
    await waitFor(() =>
      expect(pedidos.some((p) => p.url.includes('orden=conversion'))).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// 6. La baja
// ---------------------------------------------------------------------------

describe('baja lógica', () => {
  it('confirma y usa DELETE, que en el backend no borra la fila', async () => {
    render(<PuntosContactoPanel token="t" />);
    await screen.findByText('Mostrador de la jefa');
    fireEvent.click(screen.getByText('Dar de baja'));
    await screen.findByText('Dar de baja el punto de contacto');
    // El aviso del slug que no se libera es parte de la decisión, no adorno.
    expect(screen.getByText(/no se libera/)).toBeTruthy();
    fireEvent.click(screen.getAllByText('Dar de baja').at(-1));
    await waitFor(() => expect(pedidos.some((p) => p.metodo === 'DELETE')).toBe(true));
  });
});
