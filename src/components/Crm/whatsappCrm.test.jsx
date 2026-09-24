// @vitest-environment jsdom
//
// C-4c · WhatsApp en el CRM.
//
// QUÉ DEFIENDE CADA BLOQUE:
//
// 1. LA BANDEJA. Agrupada por número con cantidad, entrantes/salientes,
//    primero y último; las dos salidas CONFIRMAN antes de pegarle al backend
//    (cancelar = cero POST), y el estado vacío dice exactamente lo pedido.
// 2. LA SECCIÓN DE MENSAJES. Dirección, hora de Meta (UTC sin zona ->
//    hora argentina), tipo y link al Drive SÓLO con el adjunto SUBIDO.
//    NUNCA el texto, aunque el backend lo mandara por error.
// 3. EL TOGGLE. Sólo ADMIN lo mueve; el EMPLEADO lo ve como estado. Y la
//    marca "NO CONTACTAR" se ve en la cabecera de la ficha.
// 4. LA SALUD. Lo que falta va en rojo y por nombre.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import WhatsappBandeja from './WhatsappBandeja';
import WhatsappSeccion from './WhatsappSeccion';
import PersonasPanel from './PersonasPanel';
import WhatsappSaludCard from '../Direccion/WhatsappSaludCard';
import { horaMeta, instanteUTC, linkDrive } from './whatsappApi';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data, clone: () => ({ json: async () => data }),
  headers: { get: () => 'application/json' },
});

let pedidos = [];
const sesionComo = (rol) => localStorage.setItem('ayma_rol', rol);

beforeEach(() => { pedidos = []; localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const NUMERO = {
  wa_id: '5493415550001', telefono_e164: '+5493415550001', cantidad: 5,
  entrantes: 3, salientes: 2,
  primer_mensaje_en: '2026-09-20T13:00:00', ultimo_mensaje_en: '2026-09-23T18:30:00',
  persona_en_padron_id: null, telefono_ambiguo: false,
};

const servidor = (rutas) => vi.fn((url, init) => {
  const u = String(url);
  const metodo = init?.method || 'GET';
  pedidos.push({ url: u, metodo, body: init?.body ? JSON.parse(init.body) : undefined });
  for (const [patron, resp] of rutas) {
    if ((patron.metodo || 'GET') === metodo && patron.re.test(u)) {
      return Promise.resolve(typeof resp === 'function' ? resp(u, init) : resp);
    }
  }
  return Promise.resolve(respuesta([]));
});

const GET = (re) => ({ re });
const POST = (re) => ({ re, metodo: 'POST' });
const PATCH = (re) => ({ re, metodo: 'PATCH' });

// ---------------------------------------------------------------------------
describe('utilidades', () => {
  it('la hora de Meta llega en UTC sin zona y se muestra en hora argentina', () => {
    expect(instanteUTC('2026-09-23T18:30:00').toISOString()).toBe('2026-09-23T18:30:00.000Z');
    expect(horaMeta('2026-09-23T18:30:00')).toMatch(/23\/09\/2026.*15:30/);
    // Un valor con zona no se toca.
    expect(instanteUTC('2026-09-23T18:30:00+00:00').toISOString()).toBe('2026-09-23T18:30:00.000Z');
  });

  it('link al Drive sólo con el adjunto SUBIDO', () => {
    expect(linkDrive({ estado_media: 'SUBIDO', media_storage_ref: 'abc' }))
      .toBe('https://drive.google.com/file/d/abc/view');
    expect(linkDrive({ estado_media: 'PENDIENTE', media_storage_ref: 'abc' })).toBeNull();
    expect(linkDrive({ estado_media: 'SUBIDO', media_storage_ref: null })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('bandeja "WhatsApp sin clasificar"', () => {
  it('estado vacío con el texto pedido', async () => {
    globalThis.fetch = servidor([[GET(/sin-clasificar/), respuesta({ total: 0, items: [] })]]);
    render(<WhatsappBandeja token="t" />);
    expect(await screen.findByText(
      'Sin mensajes pendientes. La integración se activa cuando Meta esté conectado.')).toBeTruthy();
  });

  it('muestra el número agrupado: cantidad, entrantes/salientes, primero y último', async () => {
    globalThis.fetch = servidor([[GET(/sin-clasificar/), respuesta({ total: 1, items: [NUMERO] })]]);
    render(<WhatsappBandeja token="t" />);
    const fila = await screen.findByTestId(`bandeja-${NUMERO.wa_id}`);
    expect(within(fila).getByText('+5493415550001')).toBeTruthy();
    expect(within(fila).getByText('5')).toBeTruthy();
    expect(within(fila).getByText(/↓ 3/)).toBeTruthy();
    expect(within(fila).getByText(/↑ 2/)).toBeTruthy();
    expect(within(fila).getByText(/20\/09\/2026/)).toBeTruthy();
    expect(within(fila).getByText(/23\/09\/2026/)).toBeTruthy();
  });

  it('"Alta como lead" confirma: cancelar no pega al backend; confirmar hace UN POST sin campos vacíos', async () => {
    let items = [NUMERO];
    const onClasificado = vi.fn();
    globalThis.fetch = servidor([
      [GET(/sin-clasificar/), () => respuesta({ total: items.length, items })],
      [POST(/sin-clasificar\/5493415550001\/alta$/), () => {
        items = [];
        return respuesta({ wa_id: NUMERO.wa_id, clasificacion: 'ALTA', persona_id: 'p9',
          lead_id: 'l9', persona_creada: true, mensajes_vinculados: 5 });
      }],
    ]);
    render(<WhatsappBandeja token="t" onClasificado={onClasificado} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Alta como lead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Alta como lead' }));
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Juan ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alta' }));
    await screen.findByText(/alta como lead \(persona nueva\)/);
    const posts = pedidos.filter((p) => p.metodo === 'POST');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ nombre: 'Juan' });
    expect(onClasificado).toHaveBeenCalledWith('alta', expect.objectContaining({ persona_id: 'p9' }));
    expect(await screen.findByText(/Sin mensajes pendientes/)).toBeTruthy();
  });

  it('"Personal · excluir" confirma y muestra el 409 del backend tal cual', async () => {
    globalThis.fetch = servidor([
      [GET(/sin-clasificar/), respuesta({ total: 1, items: [NUMERO] })],
      [POST(/\/personal$/), respuesta({ detail: 'Ese número ya está en el padrón' }, 409)],
    ]);
    render(<WhatsappBandeja token="t" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Personal · excluir' }));
    expect(screen.getByText(/sólo metadata/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar: es personal' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/ya está en el padrón/);
    expect(pedidos.filter((p) => p.metodo === 'POST')).toHaveLength(1);
  });

  it('un número que ya está en el padrón no ofrece "Personal" (sería esconder cartera)', async () => {
    globalThis.fetch = servidor([[GET(/sin-clasificar/), respuesta({
      total: 1, items: [{ ...NUMERO, persona_en_padron_id: 'p1' }] })]]);
    render(<WhatsappBandeja token="t" />);
    expect((await screen.findByRole('button', { name: 'Personal · excluir' })).disabled).toBe(true);
    expect(screen.getByText('Ya en el padrón')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
const MENSAJES = {
  total: 3, limit: 100, offset: 0,
  items: [
    { id: 'm1', direccion: 'IN', origen: 'WEBHOOK', tipo: 'image', enviado_en: '2026-09-23T18:30:00',
      estado_media: 'SUBIDO', media_storage_ref: 'drive123', estado_texto: 'NO_APLICA',
      // Si el backend alguna vez mandara el texto, NO se muestra.
      texto: 'MI DNI ES 30111222' },
    { id: 'm2', direccion: 'OUT', origen: 'ECO_APP', tipo: 'text', enviado_en: '2026-09-23T18:31:00',
      estado_media: 'NO_APLICA', estado_texto: 'SUBIDO', texto_sha256: 'abc' },
    { id: 'm3', direccion: 'IN', origen: 'WEBHOOK', tipo: 'document', enviado_en: '2026-09-23T18:32:00',
      estado_media: 'PENDIENTE', media_storage_ref: null, estado_texto: 'NO_APLICA' },
  ],
};

describe('sección WhatsApp de las fichas', () => {
  it('oportunidad: pide por oportunidad_id y muestra dirección, hora, tipo y el link sólo si está SUBIDO', async () => {
    globalThis.fetch = servidor([[GET(/whatsapp\/mensajes/), respuesta(MENSAJES)]]);
    render(<WhatsappSeccion token="t" oportunidadId="opp1" />);
    const m1 = await screen.findByTestId('wa-m1');
    expect(pedidos[0].url).toMatch(/oportunidad_id=opp1/);
    expect(within(m1).getByText(/Entrante/)).toBeTruthy();
    expect(within(m1).getByText(/15:30/)).toBeTruthy();
    expect(within(m1).getByText('Imagen')).toBeTruthy();
    expect(within(m1).getByRole('link', { name: /Adjunto en Drive/ }).getAttribute('href'))
      .toBe('https://drive.google.com/file/d/drive123/view');
    expect(within(screen.getByTestId('wa-m2')).getByText(/Saliente/)).toBeTruthy();
    expect(within(screen.getByTestId('wa-m3')).queryByRole('link')).toBeNull();
    expect(within(screen.getByTestId('wa-m3')).getByText(/Adjunto: Subiendo/)).toBeTruthy();
    // Nunca el texto.
    expect(screen.queryByText(/30111222/)).toBeNull();
    // La ficha de oportunidad no tiene toggle.
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('sin mensajes lo dice', async () => {
    globalThis.fetch = servidor([[GET(/whatsapp\/mensajes/), respuesta({ total: 0, items: [] })]]);
    render(<WhatsappSeccion token="t" personaId="p1" />);
    expect(await screen.findByText('Sin mensajes de WhatsApp registrados.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
describe('ficha de persona: toggle "Excluir WhatsApp" y marca NO CONTACTAR', () => {
  const PERSONA = { id: 'p1', nombre: 'Juan', apellido: 'Pérez', token: 'AYMA-PER-1' };
  const ficha = (extra = {}) => ({
    ...PERSONA, empresas: [], grupos: [], oportunidades: [], interacciones: [], adjuntos_count: 0,
    excluir_whatsapp: false, no_contactar: false, ...extra,
  });

  const servidorPersona = (f) => servidor([
    [GET(/whatsapp\/mensajes/), respuesta({ total: 0, items: [] })],
    [GET(/\/personas\/p1\/ficha/), respuesta(f)],
    [PATCH(/\/personas\/p1$/), (u, init) => respuesta({ ...PERSONA, ...JSON.parse(init.body) })],
    [GET(/\/personas/), respuesta([PERSONA])],
  ]);

  const abrirWhatsapp = async () => {
    fireEvent.click(await screen.findByText(/Pérez/));
    await screen.findByText('AYMA-PER-1');
    fireEvent.click(screen.getByRole('button', { name: 'WhatsApp' }));
  };

  it('ADMIN: el toggle confirma y hace UN PATCH con excluir_whatsapp', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPersona(ficha());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<PersonasPanel token="t" />);
    await abrirWhatsapp();
    const sw = await screen.findByRole('switch', { name: /Excluir WhatsApp/ });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(sw);
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    const patches = pedidos.filter((p) => p.metodo === 'PATCH');
    expect(patches).toHaveLength(1);
    expect(patches[0].body).toEqual({ excluir_whatsapp: true });
    // Y la marca aparece en la cabecera.
    expect(screen.getByText('WhatsApp: sólo metadata')).toBeTruthy();
  });

  it('ADMIN que cancela la confirmación: cero PATCH', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorPersona(ficha());
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PersonasPanel token="t" />);
    await abrirWhatsapp();
    fireEvent.click(await screen.findByRole('switch', { name: /Excluir WhatsApp/ }));
    expect(pedidos.filter((p) => p.metodo === 'PATCH')).toHaveLength(0);
  });

  it('EMPLEADO: no hay control, sólo el estado', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorPersona(ficha({ excluir_whatsapp: true }));
    render(<PersonasPanel token="t" />);
    await abrirWhatsapp();
    expect(await screen.findByText(/Activo · sólo ADMIN lo cambia/)).toBeTruthy();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('la marca NO CONTACTAR se ve en la cabecera con su motivo', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorPersona(ficha({ no_contactar: true, no_contactar_motivo: 'Pidió que no lo llamen' }));
    render(<PersonasPanel token="t" />);
    fireEvent.click(await screen.findByText(/Pérez/));
    const marcas = await screen.findByTestId('marcas-contacto');
    expect(within(marcas).getByText(/NO CONTACTAR/)).toBeTruthy();
    expect(within(marcas).getByText(/Pidió que no lo llamen/)).toBeTruthy();
  });

  it('sin marcas no se dibuja nada', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorPersona(ficha());
    render(<PersonasPanel token="t" />);
    fireEvent.click(await screen.findByText(/Pérez/));
    await screen.findByText('AYMA-PER-1');
    expect(screen.queryByTestId('marcas-contacto')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('tarjeta de salud', () => {
  const SALUD = {
    estado: 'ALERTA',
    alertas: ['WHATSAPP_ENABLED sin WHATSAPP_APP_SECRET: el webhook contesta 503'],
    configuracion: {
      WHATSAPP_ENABLED: true, WHATSAPP_APP_SECRET: false, WHATSAPP_VERIFY_TOKEN: true,
      WHATSAPP_ACCESS_TOKEN: false, WHATSAPP_PHONE_NUMBER_ID: true,
    },
    faltan: ['WHATSAPP_APP_SECRET', 'WHATSAPP_ACCESS_TOKEN'],
    ultimo_mensaje_recibido_en: null,
    ultimas_24h_por_origen: {}, texto_por_estado: {}, media_por_estado: { FALLIDO: 2 },
    textos_en_cola: 0, mensajes_sin_persona: 1, numeros_sin_clasificar: 4, evidencias_emitidas: 0,
    webhook_path: '/api/v1/whatsapp/webhook', campos_a_suscribir: ['messages', 'smb_message_echoes'],
  };

  it('los faltantes van en rojo y por nombre; lo cargado, no', async () => {
    globalThis.fetch = servidor([[GET(/admin\/whatsapp\/salud/), respuesta(SALUD)]]);
    render(<WhatsappSaludCard token="t" />);
    const secreto = await screen.findByTestId('cfg-WHATSAPP_APP_SECRET');
    expect(secreto.dataset.falta).toBe('si');
    expect(secreto.className).toMatch(/red/);
    expect(within(secreto).getByText('FALTA')).toBeTruthy();
    expect(screen.getByTestId('cfg-WHATSAPP_ACCESS_TOKEN').dataset.falta).toBe('si');
    const verify = screen.getByTestId('cfg-WHATSAPP_VERIFY_TOKEN');
    expect(verify.dataset.falta).toBe('no');
    expect(verify.className).not.toMatch(/red/);
    expect(screen.getByText('ALERTA')).toBeTruthy();
    expect(screen.getByText(/webhook contesta 503/)).toBeTruthy();
    expect(screen.getByText('smb_message_echoes', { exact: false })).toBeTruthy();
  });

  it('un 403 se muestra como error del pedido', async () => {
    globalThis.fetch = servidor([[GET(/admin\/whatsapp\/salud/), respuesta({ detail: 'Sólo admin' }, 403)]]);
    render(<WhatsappSaludCard token="t" />);
    expect(await screen.findByText(/Sólo admin/)).toBeTruthy();
  });
});
