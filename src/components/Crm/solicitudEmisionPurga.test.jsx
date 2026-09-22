// @vitest-environment jsdom
//
// QR-EMI en el portal, segunda vuelta (C-6i) contra el contrato real del
// backend (app/api/v1/crm_solicitudes_emision.py, C-6h / 27cfd4d).
//
// QUÉ DEFIENDE CADA BLOQUE:
//
// 1. LA MINIATURA NO BAJA NADA HASTA QUE SE LA PIDE. Seis fotos de celular
//    son varios MB, y el detalle se abre muchas veces sólo para mirar el
//    estado. Un `<img src>` automático sería tráfico por algo que nadie
//    miró - y además no llevaría el Bearer, porque el binario está detrás
//    de un stream autenticado.
// 2. PURGAR SIN SIMULAR NO EXISTE. El backend exige un `simulacion_id` del
//    dry_run, así que un botón habilitado sin plan sólo puede devolver 409.
//    Y el botón tampoco se habilita con el plan si no se tipeó PURGAR.
// 3. UN SOLO POST ANTE DOBLE CLIC (H-66). La purga es irreversible: el
//    segundo POST gasta una credencial que ya no vale y muestra un 409
//    sobre algo que sí se borró.
// 4. EL COBRO SE LEE EN CASTELLANO. Con tarjeta y con débito, y sin el JSON
//    crudo al lado: es el dato con el que se manda el débito.
// 5. UN EMPLEADO NO VE "PURGAR DATOS" NI "ELIMINAR OPORTUNIDAD". Las dos
//    son de ADMIN en esta pantalla, y ofrecer un botón que rebota es
//    hacerle perder el viaje a quien revisa.
// 6. LA APROBACIÓN AVISA, PERO NO SE APAGA (C-6q punto 2). El aviso dice
//    POR QUÉ y qué hacer; el botón sigue habilitado y el que decide es el
//    409 del backend, que nombra cada archivo. Un botón deshabilitado sin
//    explicación a la vista se lee como una pantalla colgada.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import SolicitudesEmisionPanel from './SolicitudesEmisionPanel';
import OportunidadFichaModal from './OportunidadFichaModal';
import { cobroLegible, cuentaLegible } from './cobroLegible';

const respuesta = (data, status = 200) => ({
  ok: status < 400, status, json: async () => data,
  blob: async () => new Blob(['x'], { type: 'image/jpeg' }),
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
  oportunidad_referencia: 'AYMA-OPP-1', cliente_nombre: 'Juan Pérez',
  archivos_en_vuelo: 0, archivos_fallidos: 0, purgada_en: null, purga_motivo: null,
};

const FOTO = {
  id: 'a1', nombre_original: 'frente.jpg', mime: 'image/jpeg', tamano_bytes: 2900000,
  sha256: 'abc', categoria: 'FOTO_INSPECCION', creado_en: '2026-09-20T13:00:00',
  en_drive: true, subida_estado: 'OK', subida_error: null, purgado_en: null,
};

const DETALLE = {
  ...SOLICITUD,
  datos: {
    nombre: 'Juan', tarjeta: { marca: 'Visa', ultimos4: '1234', titular: 'JUAN PEREZ', vencimiento: '08/29' },
  },
  adjuntos: [FOTO],
};

const PLAN = {
  escritura: false, dry_run: true, solicitud_id: 's1', oportunidad_id: 'opp1',
  estado: 'PENDIENTE_REVISION', simulacion_id: 'sim-1',
  simulacion_vence_en: '2026-09-22T16:10:00',
  campos_cifrados: 2, campos: ['nombre', 'tarjeta'],
  consentimiento_ip_hash: true, consentimiento_user_agent: true,
  adjuntos: [{ id: 'a1', nombre_original: 'frente.jpg', tamano_bytes: 2900000,
    categoria: 'FOTO_INSPECCION', sha256: 'abc', en_drive: true, subida_estado: 'OK' }],
  adjuntos_a_purgar: 1, archivos_en_drive: 1, adjuntos_ya_purgados: 0,
  detalle: 'Corrida en seco: no se borró nada.',
};

let pedidos;

beforeEach(() => {
  pedidos = [];
  localStorage.clear();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:miniatura');
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const registrar = (url, init) => pedidos.push({
  url: String(url), metodo: init?.method || 'GET',
  cuerpo: init?.body ? JSON.parse(init.body) : null,
});

const posts = () => pedidos.filter((p) => p.metodo === 'POST');

const servidor = ({ listado = [SOLICITUD], detalle = DETALLE, purga = PLAN } = {}) =>
  vi.fn((url, init) => {
    registrar(url, init);
    const u = String(url);
    if (u.includes('/purgar')) return Promise.resolve(respuesta(purga));
    if (u.includes('/descargar')) return Promise.resolve(respuesta({}));
    if (/\/solicitudes-emision\/s1$/.test(u)) return Promise.resolve(respuesta(detalle));
    if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta(listado));
    return Promise.resolve(respuesta({}));
  });

const abrirDatos = async () => {
  await screen.findByText('AYMA-OPP-1');
  fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
  fireEvent.click(await screen.findByRole('button', { name: /Ver datos cargados/i }));
  await screen.findByText(/Tarjeta Visa/);
};

describe('el listado no pide la ficha de cada oportunidad (C-6i punto 4)', () => {
  it('pinta la referencia y el nombre con UNA sola consulta', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);

    await screen.findByText('AYMA-OPP-1');
    expect(screen.getByText('Juan Pérez')).toBeTruthy();
    // NI UN pedido a /oportunidades/{id}: eran N por tabla.
    expect(pedidos.filter((p) => /\/oportunidades\//.test(p.url))).toHaveLength(0);
    expect(pedidos).toHaveLength(1);
  });
});

describe('miniaturas de los adjuntos', () => {
  it('no baja el binario hasta que se la pide, y lo libera al cerrar', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirDatos();

    // El detalle ya está abierto y el binario NO viajó.
    expect(pedidos.filter((p) => p.url.includes('/descargar'))).toHaveLength(0);
    expect(globalThis.URL.createObjectURL).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Ver miniatura de frente.jpg/i }));
    await waitFor(() => expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1));
    expect(pedidos.filter((p) => p.url.includes('/descargar'))).toHaveLength(1);

    cleanup();
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:miniatura');
  });
});

describe('cobro legible (C-6i punto 1)', () => {
  it('escribe la tarjeta y el débito en castellano, y nunca muestra un número entero', () => {
    expect(cobroLegible({
      tarjeta: { marca: 'Visa', ultimos4: '1234', titular: 'JUAN PEREZ', vencimiento: '08/29' },
    })).toBe('Tarjeta Visa terminada en 1234 · JUAN PEREZ · vence 08/29');

    // Los campos PLANOS del catálogo del formulario se leen igual: cuál de
    // las dos formas mande la landing no puede decidir si el dato se ve.
    expect(cobroLegible({ tarjeta_marca: 'Amex', tarjeta_ultimos4: '9999' }))
      .toBe('Tarjeta Amex terminada en 9999');

    expect(cobroLegible({
      medio: 'DEBITO', cbu_o_alias: '0170099220000067797249', titular_cuenta: 'Juan Pérez',
    })).toBe('Débito · CBU ****7249 · Juan Pérez');

    // Un ALIAS no se enmascara: no es un número de cuenta.
    expect(cuentaLegible('juan.perez.mp')).toBe('juan.perez.mp');
    expect(cobroLegible({})).toBeNull();
  });

  it('en la ficha muestra la línea y no el JSON crudo', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirDatos();

    expect(screen.getByText('Tarjeta Visa terminada en 1234 · JUAN PEREZ · vence 08/29')).toBeTruthy();
    expect(screen.queryByText(/"ultimos4"/)).toBeNull();
  });
});

describe('aprobar con archivos en vuelo (C-6h punto 2 / C-6q punto 2)', () => {
  // EL BOTÓN YA NO SE DESHABILITA. Estaba apagado sin decir por qué y la
  // pantalla se leía como colgada. Avisa antes y deja intentar; el que
  // decide es el backend con su 409, que nombra cada archivo.
  it('avisa qué falta pero deja tocar Aprobar, y muestra el 409 con los nombres', async () => {
    const base = servidor({ listado: [{ ...SOLICITUD, archivos_en_vuelo: 1 }] });
    globalThis.fetch = vi.fn((url, init) => {
      if (String(url).includes('/aprobar')) {
        registrar(url, init);
        return Promise.resolve(respuesta(
          { detail: 'No se puede aprobar: 1 archivo(s) de esta solicitud no terminaron de subir a Drive -> frente.jpg (EN_CURSO).' },
          409,
        ));
      }
      return base(url, init);
    });
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));

    const boton = await screen.findByRole('button', { name: 'Aprobar' });
    expect(boton.disabled).toBe(false);
    expect(screen.getByText(/todavía subiendo a Drive/i)).toBeTruthy();

    fireEvent.click(boton);
    await screen.findByText(/frente\.jpg \(EN_CURSO\)/);
    expect(posts().filter((p) => p.url.includes('/aprobar'))).toHaveLength(1);
  });

  it('con una subida FALLIDA manda a pedir el archivo de nuevo', async () => {
    globalThis.fetch = servidor({
      listado: [{ ...SOLICITUD, archivos_fallidos: 1 }],
      detalle: { ...DETALLE, adjuntos: [{ ...FOTO, en_drive: false, subida_estado: 'FALLIDA' }] },
    });
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await screen.findByText(/no van a llegar solos/i);
    expect((await screen.findByRole('button', { name: 'Aprobar' })).disabled).toBe(false);
  });
});

describe('purga de datos (C-6i punto 2)', () => {
  const abrirPurga = async () => {
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.click(await screen.findByRole('button', { name: /Purgar datos/i }));
    await screen.findByText(/no se puede deshacer/i);
  };

  it('sin simulación no hay botón de purgar, y con plan pide tipear PURGAR', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirPurga();

    // El botón firme NO EXISTE hasta que hay plan: el backend exige el
    // `simulacion_id` y sin él sólo hay un 409 esperando.
    expect(screen.queryByRole('button', { name: /Purgar definitivamente/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
    await screen.findByText(/2 campo\(s\) del formulario/);
    // El dry_run lista los NOMBRES, nunca los valores.
    expect(screen.getByText('nombre, tarjeta')).toBeTruthy();
    expect(posts().filter((p) => p.url.includes('dry_run=true'))).toHaveLength(1);

    const firme = screen.getByRole('button', { name: /Purgar definitivamente/i });
    expect(firme.disabled).toBe(true);           // falta tipear PURGAR

    fireEvent.change(screen.getByLabelText(/Escribí PURGAR/i), { target: { value: 'purgar' } });
    expect(screen.getByRole('button', { name: /Purgar definitivamente/i }).disabled).toBe(false);
  });

  it('un doble clic en purgar manda UN solo POST firme, con el simulacion_id', async () => {
    let resolver;
    globalThis.fetch = vi.fn((url, init) => {
      registrar(url, init);
      const u = String(url);
      if (u.includes('dry_run=false')) {
        return new Promise((r) => {
          resolver = () => r(respuesta({
            ...PLAN, dry_run: false, escritura: true, completa: true,
            estado: 'PURGADA', adjuntos_purgados: ['a1'], archivos_no_borrados: [],
          }));
        });
      }
      if (u.includes('/purgar')) return Promise.resolve(respuesta(PLAN));
      if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta([SOLICITUD]));
      return Promise.resolve(respuesta({}));
    });

    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirPurga();
    fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
    await screen.findByText(/2 campo\(s\) del formulario/);
    fireEvent.change(screen.getByLabelText(/Escribí PURGAR/i), { target: { value: 'PURGAR' } });

    const firme = screen.getByRole('button', { name: /Purgar definitivamente/i });
    fireEvent.click(firme);
    fireEvent.click(firme);

    await waitFor(() => expect(posts().filter((p) => p.url.includes('dry_run=false'))).toHaveLength(1));
    const firmePost = posts().find((p) => p.url.includes('dry_run=false'));
    expect(firmePost.cuerpo.simulacion_id).toBe('sim-1');
    expect(firmePost.cuerpo.motivo).toBe('PRUEBA');
    // `dry_run` va en la query string y NUNCA en el cuerpo (422 del backend).
    expect(firmePost.cuerpo).not.toHaveProperty('dry_run');
    resolver();
  });

  it('con motivo OTRO no simula sin detalle', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin />);
    await abrirPurga();

    fireEvent.change(screen.getByLabelText(/^Motivo/i), { target: { value: 'OTRO' } });
    fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
    await screen.findByText(/Con motivo "Otro" hay que decir/i);
    expect(posts()).toHaveLength(0);
  });

  it('un EMPLEADO no ve "Purgar datos"', async () => {
    globalThis.fetch = servidor();
    render(<SolicitudesEmisionPanel token="t" esAdmin={false} />);
    await screen.findByText('AYMA-OPP-1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await screen.findByText(/Datos cargados por el cliente/i);

    expect(screen.queryByRole('button', { name: /Purgar datos/i })).toBeNull();
  });
});

// A partir de C-6l la ficha resuelve el rol de la SESIÓN, no de una prop:
// el Pipeline no la pasaba y a un admin le escondía el botón.
const sesionComo = (rol) => localStorage.setItem('ayma_rol', rol);

describe('baja de la oportunidad (C-6l punto 2)', () => {
  const OPORTUNIDAD = {
    id: 'opp1', token: 'AYMA-OPP-1', track: 'AUTO', estado_crm: 'CLIENTE',
    resultado: 'EN_CURSO', prima_estimada: 41000, origen: 'REFERIDO',
    interacciones: [], tareas: [], adjuntos_count: 0,
  };

  const servidorFicha = (solicitudes = []) => vi.fn((url, init) => {
    registrar(url, init);
    const u = String(url);
    if (u.includes('/solicitudes-emision')) return Promise.resolve(respuesta(solicitudes));
    if (init?.method === 'DELETE') return Promise.resolve(respuesta({ mensaje: 'Oportunidad dada de baja' }));
    if (/\/oportunidades\/opp1$/.test(u)) return Promise.resolve(respuesta(OPORTUNIDAD));
    return Promise.resolve(respuesta([]));
  });

  it('un EMPLEADO no ve "Eliminar oportunidad"', async () => {
    sesionComo('EMPLEADO');
    globalThis.fetch = servidorFicha();
    render(<OportunidadFichaModal token="t" oportunidadId="opp1" onClose={() => {}} />);
    await screen.findByRole('button', { name: /Registrar interacción/i });
    expect(screen.queryByRole('button', { name: /Eliminar oportunidad/i })).toBeNull();
  });

  it('un ADMIN elige motivo, confirma por escrito y recién ahí sale el DELETE', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorFicha();
    const onClose = vi.fn();
    render(<OportunidadFichaModal token="t" oportunidadId="opp1" onClose={onClose} />);

    fireEvent.click(await screen.findByRole('button', { name: /Eliminar oportunidad/i }));
    const confirmar = await screen.findByRole('button', { name: /^Confirmar baja$/ });
    expect(confirmar.disabled).toBe(true);
    expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Prueba' }));
    fireEvent.change(screen.getByLabelText(/Escribí ELIMINAR/i), { target: { value: 'ELIMINAR' } });
    fireEvent.click(screen.getByRole('button', { name: /^Confirmar baja$/ }));
    await waitFor(() => expect(pedidos.filter((p) => p.metodo === 'DELETE')).toHaveLength(1));
    expect(onClose).toHaveBeenCalled();
  });

  it('avisa que primero hay que purgar cuando queda una solicitud con datos', async () => {
    sesionComo('ADMIN');
    globalThis.fetch = servidorFicha([{ ...SOLICITUD, estado: 'APROBADA' }]);
    render(<OportunidadFichaModal token="t" oportunidadId="opp1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Eliminar oportunidad/i }));
    await screen.findByText(/Primero purgá los datos de la solicitud/i);
  });

  it('una solicitud ya purgada no dispara el aviso', async () => {
    globalThis.fetch = servidorFicha([
      { ...SOLICITUD, estado: 'PURGADA', purgada_en: '2026-09-22T15:00:00' },
    ]);
    sesionComo('ADMIN');
    render(<OportunidadFichaModal token="t" oportunidadId="opp1" onClose={() => {}} />);

    fireEvent.click(await screen.findByRole('button', { name: /Eliminar oportunidad/i }));
    await screen.findByLabelText(/Escribí ELIMINAR/i);
    expect(screen.queryByText(/Primero purgá los datos/i)).toBeNull();
  });
});
