// @vitest-environment jsdom
//
// QR-EMI en el portal (C-6c) contra el contrato real del backend
// (app/api/v1/crm_solicitudes_emision.py, PR #190 / 11755e3).
//
// QUÉ DEFIENDE CADA BLOQUE, y por qué un "renderiza sin romper" no alcanza:
//
// 1. GENERAR MUESTRA EL LINK Y EL QR. El token en claro sale UNA SOLA VEZ,
//    en la respuesta de ese POST: si la pantalla no lo pinta, se perdió y
//    hay que generar otro -revocando el que el cliente ya recibió-.
// 2. REGENERAR PIDE CONFIRMACIÓN. Generar sobre una oportunidad que ya
//    tiene un link vivo REVOCA el anterior, que puede estar circulando por
//    WhatsApp. Un clic no puede alcanzar para eso.
// 3. "VER DATOS" NO HACE EL GET HASTA EL CLIC. Ese endpoint devuelve el DNI
//    y el CBU descifrados y deja el acceso en `auditoria_accesos`: un GET
//    al montar llenaría la bitácora de accesos que nadie pidió.
// 4. UN SOLO POST ANTE DOBLE CLIC (H-66). Aprobar dos veces es un 409 en el
//    mejor caso y, en el peor, dos lecturas del checklist compitiendo.
// 5. UN EMPLEADO NO VE "VER DATOS". Cinco de los seis endpoints son
//    admin-o-agente; el detalle es ADMIN. La pantalla tiene que reflejar
//    ese reparto y no ofrecer un botón que devolvería 403.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SolicitudEmisionModal from './SolicitudEmisionModal';
import SolicitudesEmisionPanel from './SolicitudesEmisionPanel';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data,
  clone: () => ({ json: async () => data }),
});

const SOLICITUD = {
  id: 's1', oportunidad_id: 'opp1', estado: 'PENDIENTE_REVISION', ramo: 'AUTO',
  compania: null, vehiculo_marca: 'VW', vehiculo_modelo: 'Gol', vehiculo_anio: 2018,
  creada_por: 'u1', creada_en: '2026-09-20T10:00:00', vence_en: '2026-09-23T10:00:00',
  abierta_en: '2026-09-20T12:00:00', enviada_en: '2026-09-20T13:00:00',
  revisada_por: null, revisada_en: null, observacion: null,
  consentimiento_version: 'v1', consentimiento_fecha: '2026-09-20T13:00:00',
  hitos_aplicados_en: null, vencida: false, archivos: 2,
};

const VIVA = { ...SOLICITUD, id: 's0', estado: 'GENERADA', enviada_en: null };

const CREADA = {
  solicitud: { ...VIVA, id: 's2' },
  url: 'https://aymaseguros.com.ar/emision/abc123',
  qr_png_base64: 'aGVsbG8=',
  texto_whatsapp: 'Hola Juan, cargá tus datos acá',
  url_whatsapp: 'https://wa.me/5493416952259?text=Hola',
  revocadas: ['s0'],
};

let pedidos;

beforeEach(() => {
  pedidos = [];
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue() } });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const registrar = (url, init) => pedidos.push({
  url: String(url), metodo: init?.method || 'GET',
  cuerpo: init?.body ? JSON.parse(init.body) : null,
});

const posts = () => pedidos.filter((p) => p.metodo === 'POST');

describe('SolicitudEmisionModal — generar el link', () => {
  it('genera y muestra el link, el QR y el WhatsApp; nada se dispara al montar', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      registrar(url, init);
      if (init?.method === 'POST') return Promise.resolve(respuesta(CREADA, 201));
      return Promise.resolve(respuesta([]));   // sin solicitudes previas
    });

    render(<SolicitudEmisionModal token="t" oportunidad={{ id: 'opp1' }} onCerrar={() => {}} />);

    await waitFor(() => expect(pedidos.length).toBeGreaterThan(0));
    expect(posts()).toHaveLength(0);           // al montar, ni un POST

    fireEvent.click(screen.getByRole('button', { name: /Generar link/i }));

    await screen.findByText(CREADA.url);
    expect(posts()).toHaveLength(1);
    expect(posts()[0].url).toContain('/crm/oportunidades/opp1/solicitud-emision');
    // El QR viene en base64 en la misma respuesta: data: URI, no un <img>
    // contra un endpoint autenticado que volvería 401.
    expect(screen.getByAltText(/Código QR/i).getAttribute('src'))
      .toBe('data:image/png;base64,aGVsbG8=');
    expect(screen.getByRole('link', { name: /Abrir WhatsApp/i }).getAttribute('href'))
      .toBe(CREADA.url_whatsapp);

    fireEvent.click(screen.getByRole('button', { name: /Copiar link/i }));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(CREADA.url));
  });

  it('con un link vivo avisa que se invalida el anterior y pide confirmación', async () => {
    globalThis.fetch = vi.fn((url, init) => {
      registrar(url, init);
      if (init?.method === 'POST') return Promise.resolve(respuesta(CREADA, 201));
      return Promise.resolve(respuesta([VIVA]));
    });

    render(<SolicitudEmisionModal token="t" oportunidad={{ id: 'opp1' }} onCerrar={() => {}} />);

    await screen.findByText(/Generar uno nuevo invalida el anterior/i);

    // Primer clic: NO genera, pregunta.
    fireEvent.click(screen.getByRole('button', { name: /Generar un link nuevo/i }));
    await screen.findByText(/¿Confirmás\?/i);
    expect(posts()).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Confirmar y generar uno nuevo/i }));
    await screen.findByText(CREADA.url);
    expect(posts()).toHaveLength(1);
  });
});

describe('SolicitudesEmisionPanel — la cola de revisión', () => {
  const servidor = (extra = {}) => vi.fn((url, init) => {
    registrar(url, init);
    const u = String(url);
    if (init?.method === 'POST') return Promise.resolve(respuesta(extra.post || { solicitud: SOLICITUD }));
    if (u.includes('/solicitudes-emision/s1')) {
      return Promise.resolve(respuesta({
        ...SOLICITUD,
        datos: { dni: '30111222', cbu_o_alias: 'juan.mp' },
        adjuntos: [
          { id: 'a1', nombre_original: 'dni.jpg', mime: 'image/jpeg', tamano_bytes: 10,
            sha256: 'x', categoria: 'DNI_CEDULA', creado_en: '2026-09-20T13:00:00', en_drive: true },
        ],
      }));
    }
    if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta([SOLICITUD]));
    if (u.includes('/oportunidades/opp1')) {
      return Promise.resolve(respuesta({ id: 'opp1', token: 'AYMA-OPP-1', nombre_vinculado: 'Juan Pérez' }));
    }
    return Promise.resolve(respuesta({}));
  });

  const abrirDetalle = async () => {
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await screen.findByText(/Datos cargados por el cliente/i);
  };

  it('lista con PENDIENTE_REVISION por default y no pide los datos en claro hasta el clic', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);

    await waitFor(() => expect(pedidos[0].url).toContain('estado=PENDIENTE_REVISION'));
    await screen.findByText('Juan Pérez');

    await abrirDetalle();
    // El detalle está abierto y el GET auditado NO salió.
    expect(pedidos.some((p) => /\/solicitudes-emision\/s1$/.test(p.url))).toBe(false);
    expect(screen.queryByText('30111222')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ver datos cargados/i }));
    await screen.findByText('30111222');
    expect(pedidos.filter((p) => /\/solicitudes-emision\/s1$/.test(p.url))).toHaveLength(1);
    expect(screen.getByText('dni.jpg')).toBeTruthy();
  });

  it('un doble clic en Aprobar manda UN solo POST', async () => {
    let resolver;
    globalThis.fetch = vi.fn((url, init) => {
      registrar(url, init);
      const u = String(url);
      if (init?.method === 'POST') {
        return new Promise((r) => { resolver = () => r(respuesta({ solicitud: SOLICITUD, hitos_aplicados: true })); });
      }
      if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta([SOLICITUD]));
      if (u.includes('/oportunidades/opp1')) {
        return Promise.resolve(respuesta({ id: 'opp1', token: 'AYMA-OPP-1', nombre_vinculado: 'Juan Pérez' }));
      }
      return Promise.resolve(respuesta({}));
    });

    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirDetalle();

    const boton = screen.getByRole('button', { name: 'Aprobar' });
    fireEvent.click(boton);
    fireEvent.click(boton);
    await waitFor(() => expect(posts().filter((p) => p.url.includes('/aprobar'))).toHaveLength(1));
    resolver();
  });

  it('observar exige motivo y lo manda con regenerar_link', async () => {
    globalThis.fetch = servidor({
      post: { solicitud: { ...SOLICITUD, estado: 'OBSERVADA' }, link: CREADA, detalle: 'Link nuevo' },
    });
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirDetalle();

    fireEvent.click(screen.getByRole('button', { name: 'Observar' }));
    // Sin motivo no sale ningún POST: el cliente rehace lo mismo y rebota.
    fireEvent.click(screen.getByRole('button', { name: /Confirmar observación/i }));
    await screen.findByText(/El motivo es obligatorio/i);
    expect(posts()).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(/Qué hay que corregir/i), {
      target: { value: 'Falta la foto del tablero' },
    });
    fireEvent.click(screen.getByLabelText(/Generar un link nuevo/i));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar observación/i }));

    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].cuerpo).toEqual({
      motivo: 'Falta la foto del tablero', regenerar_link: true,
    });
    // El link nuevo se muestra en el acto: el token en claro no se repite.
    await screen.findByText(CREADA.url);
  });

  it('un EMPLEADO no ve "Ver datos cargados"', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin={false} />);
    await abrirDetalle();

    expect(screen.queryByRole('button', { name: /Ver datos cargados/i })).toBeNull();
    expect(screen.getByText(/Sólo un ADMIN puede abrirlos/i)).toBeTruthy();
    // Aprobar y observar SÍ: son admin-o-agente en el backend.
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeTruthy();
  });
});
