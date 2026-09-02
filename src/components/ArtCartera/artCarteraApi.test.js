// Tests de la capa de datos del módulo "Cartera ART" contra mocks del
// contrato real leído de aymaseguros-stack/ayma-portal-backend
// (app/api/v1/art_consultas.py + app/schemas/art_consultas.py +
// app/schemas/common.py). El sandbox de este entorno bloquea *.onrender.com,
// así que no hay forma de probar contra el backend real: estos tests fijan
// el contrato vía fetch mockeado, con la forma exacta de los Pydantic
// schemas (Page{total,items,limit,offset}, EmpresaARTListItem,
// EmpresaARTDetalleResponse, DesbloqueoItem, TecnicaVencidaItem,
// EstadoARTCreateResponse).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listarEmpresasArt, obtenerEmpresaArt, listarDesbloqueos, listarTecnicaVencida, registrarEstadoArt,
} from './artCarteraApi';

const TOKEN = 'token-de-prueba';

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

beforeEach(() => {
  globalThis.fetch = vi.fn();
});

describe('listarEmpresasArt - GET /art/empresas', () => {
  it('arma el querystring con los filtros y devuelve {items, total} del envelope Page', async () => {
    const page = {
      total: 9119,
      limit: 50,
      offset: 0,
      items: [
        {
          cuit: '30-12345678-9',
          razon_social: 'Acme SA',
          ciiu: '3710',
          provincia: 'Santa Fe',
          telefono: '3416952259',
          dotacion: 42,
          riesgo_suscripcion: 'NORMAL',
          estrategia_art: 'ATACAR_DESDE_BERKLEY',
          art_actual_srt: 'berkley',
          vigencia_srt: '2026-05-01',
          tarifa_pct_historica: '2.5',
          cantidad_estados_vigentes: 3,
          cantidad_cotizables: 9,
        },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(page));

    const resultado = await listarEmpresasArt(TOKEN, {
      ciiu: '37', provincia: 'Santa Fe', riesgo_suscripcion: 'NORMAL', limit: 50, offset: 0,
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/art/empresas?');
    expect(url).toContain('ciiu=37');
    expect(url).toContain('provincia=Santa+Fe');
    expect(url).toContain('riesgo_suscripcion=NORMAL');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);

    // total SIEMPRE sale del envelope, nunca de items.length (son 9.119
    // filas reales, la página trae 1).
    expect(resultado.total).toBe(9119);
    expect(resultado.items).toHaveLength(1);
    expect(resultado.items[0].razon_social).toBe('Acme SA');
  });

  it('no manda filtros vacíos como querystring literal', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ total: 0, items: [], limit: 50, offset: 0 }));
    await listarEmpresasArt(TOKEN, { ciiu: '', provincia: undefined, q: 'acme', limit: 50, offset: 0 });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).not.toContain('ciiu=');
    expect(url).not.toContain('provincia=');
    expect(url).toContain('q=acme');
  });

  it('propaga el detail de FastAPI en el mensaje de error cuando el backend responde 422', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: 'aseguradora inválida. Válidas: [...]' }, false, 422,
    ));
    await expect(listarEmpresasArt(TOKEN, { aseguradora: 'no-existe' })).rejects.toThrow(/422/);
  });
});

describe('obtenerEmpresaArt - GET /art/empresas/{cuit}', () => {
  it('devuelve la ficha completa con la matriz de 12 aseguradoras y el historial', async () => {
    const detalle = {
      empresa: {
        id: 'emp-1', token: 'tok-1', cuit: '30-12345678-9', razon_social: 'Acme SA',
        activo: true, created_at: '2025-01-01T00:00:00', updated_at: '2025-01-01T00:00:00',
        art_verificacion_pendiente: false, art_intentos_verificacion: 0,
      },
      aseguradoras: [
        { aseguradora: 'plus', estado_efectivo: null, tipo_ultimo: null },
        {
          aseguradora: 'berkley', estado_efectivo: 'COTIZABLE', tipo_ultimo: 'BLOQUEADA',
          fecha_evento: '2025-01-01', fecha_caducidad: '2025-01-31', dias_restantes: -10,
        },
      ],
      historial: [
        {
          id: 1, aseguradora: 'berkley', tipo: 'BLOQUEADA', fecha_evento: '2025-01-01',
          fuente: 'PLANILLA_2025', activo: true,
        },
      ],
      calculo: null,
      calculo_bloqueado_por: 'dotacion',
    };
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(detalle));

    const resultado = await obtenerEmpresaArt(TOKEN, '30-12345678-9');

    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9');
    expect(resultado.empresa.razon_social).toBe('Acme SA');
    expect(resultado.aseguradoras).toHaveLength(2);
    // Un estado caducado ES cotizable: la celda trae tipo_ultimo (histórico)
    // Y estado_efectivo (vigente hoy) por separado, nunca uno pisa al otro.
    expect(resultado.aseguradoras[1].estado_efectivo).toBe('COTIZABLE');
    expect(resultado.aseguradoras[1].tipo_ultimo).toBe('BLOQUEADA');
    expect(resultado.calculo).toBeNull();
    expect(resultado.calculo_bloqueado_por).toBe('dotacion');
  });

  it('lanza un error legible cuando el CUIT no existe (404)', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: 'No existe una empresa con CUIT 20-00000000-0' }, false, 404,
    ));
    await expect(obtenerEmpresaArt(TOKEN, '20-00000000-0')).rejects.toThrow(/404/);
  });
});

describe('listarDesbloqueos - GET /art/desbloqueos', () => {
  it('usa dias=7 por default y devuelve {items, total} aunque total sea 0', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ total: 0, items: [], limit: 50, offset: 0 }));
    const resultado = await listarDesbloqueos(TOKEN);
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('dias=7');
    // 0 resultados es un estado válido, no debe lanzar ni transformarse en error.
    expect(resultado).toEqual({ items: [], total: 0 });
  });

  it('respeta un `dias` explícito', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ total: 1, items: [{
      cuit: '30-1-9', razon_social: 'Acme SA', dotacion: 10, aseguradora: 'berkley',
      productor_bloqueante: 'productor X', fecha_caducidad: '2026-01-01', dias_restantes: 12, telefono: null,
    }], limit: 50, offset: 0 }));
    const resultado = await listarDesbloqueos(TOKEN, { dias: 30 });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('dias=30');
    expect(resultado.total).toBe(1);
    expect(resultado.items[0].aseguradora).toBe('berkley');
  });
});

describe('listarTecnicaVencida - GET /art/tecnica-vencida', () => {
  it('devuelve {items, total} del envelope Page', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      total: 2,
      limit: 50,
      offset: 0,
      items: [
        { cuit: '30-1-9', razon_social: 'Acme SA', aseguradora: 'smg', fecha_evento: '2025-01-01', dias_sla: 10, dias_en_tecnica: 25, dias_excedidos: 15 },
        { cuit: null, razon_social: 'Sin CUIT SA', aseguradora: 'omint', fecha_evento: '2025-02-01', dias_sla: 5, dias_en_tecnica: 20, dias_excedidos: 15 },
      ],
    }));
    const resultado = await listarTecnicaVencida(TOKEN);
    expect(resultado.total).toBe(2);
    expect(resultado.items[1].cuit).toBeNull();
  });
});

describe('registrarEstadoArt - POST /art/estado', () => {
  it('hace POST con el body serializado y devuelve {registro, riesgo_suscripcion}', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      registro: {
        id: 99, aseguradora: 'berkley', tipo: 'ALICUOTA', alicuota: '4.5',
        fecha_evento: '2026-01-01', fuente: 'MANUAL', activo: true,
      },
      riesgo_suscripcion: 'NORMAL',
    }, true, 201));

    const payload = { cuit: '30-1-9', aseguradora: 'berkley', tipo: 'ALICUOTA', alicuota: 4.5, fuente: 'MANUAL' };
    const resultado = await registrarEstadoArt(TOKEN, payload);

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/estado');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual(payload);
    expect(resultado.riesgo_suscripcion).toBe('NORMAL');
    expect(resultado.registro.id).toBe(99);
  });

  it('propaga el detail de validación (422) tal cual lo manda FastAPI', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: 'alicuota debe estar en el rango (0, 10]' }, false, 422,
    ));
    await expect(registrarEstadoArt(TOKEN, {
      cuit: '30-1-9', aseguradora: 'berkley', tipo: 'ALICUOTA', alicuota: 15,
    })).rejects.toThrow(/alicuota debe estar en el rango/);
  });
});
