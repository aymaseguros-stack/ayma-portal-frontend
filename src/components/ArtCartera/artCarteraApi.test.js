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
  obtenerReferencialTarifas, listarLeadsSinCobertura,
  listarDocumentosArt, subirDocumentoArt, marcarDocumentoArtConseguido,
  obtenerColaAlicuotas, registrarCargaRapidaAlicuotas,
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
  it('devuelve la ficha completa con la matriz de 13 aseguradoras y el historial', async () => {
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

  it('pasa historial_contratos y contrato_actual tal cual los manda el backend', async () => {
    const detalle = {
      empresa: { id: 'emp-1', cuit: '30-12345678-9', razon_social: 'Acme SA' },
      aseguradoras: [],
      historial: [],
      historial_contratos: [
        {
          aseguradora: 'BERKLEY INTERNATIONAL ART S.A.', aseguradora_normalizada: 'berkley',
          numero_contrato: '123', fecha_inicio: '2024-03-01', fecha_fin: null, motivo_baja: null,
        },
      ],
      contrato_actual: { aseguradora: 'BERKLEY INTERNATIONAL ART S.A.', fecha_inicio: '2024-03-01' },
      calculo: null,
      calculo_bloqueado_por: 'dotacion',
    };
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(detalle));

    const resultado = await obtenerEmpresaArt(TOKEN, '30-12345678-9');

    expect(resultado.historial_contratos).toHaveLength(1);
    expect(resultado.historial_contratos[0].aseguradora_normalizada).toBe('berkley');
    expect(resultado.contrato_actual).toEqual({ aseguradora: 'BERKLEY INTERNATIONAL ART S.A.', fecha_inicio: '2024-03-01' });
  });

  it('contrato_actual null (ninguno vigente): se devuelve tal cual, no se inventa un default', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      empresa: { id: 'emp-1', cuit: '30-12345678-9', razon_social: 'Acme SA' },
      aseguradoras: [],
      historial: [],
      historial_contratos: [],
      contrato_actual: null,
      calculo: null,
      calculo_bloqueado_por: 'dotacion',
    }));

    const resultado = await obtenerEmpresaArt(TOKEN, '30-12345678-9');

    expect(resultado.contrato_actual).toBeNull();
    expect(resultado.historial_contratos).toEqual([]);
  });
});

describe('listarDocumentosArt - GET /art/empresas/{cuit}/documentos', () => {
  it('devuelve el array tal cual (no es un envelope Page)', async () => {
    const documentos = [
      {
        id: 'doc-1', empresa_id: 'emp-1', tipo: 'FORM_931', archivo_drive_id: 'drive-1',
        nombre_archivo: 'form931.pdf', mime_type: 'application/pdf', conseguido: true,
        fecha_carga: '2026-01-01T00:00:00', subido_por: 'user-1',
        created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
      },
    ];
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(documentos));

    const resultado = await listarDocumentosArt(TOKEN, '30-12345678-9');

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(resultado).toEqual(documentos);
  });

  it('agrega el filtro `tipo` al querystring cuando se pasa', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([]));
    await listarDocumentosArt(TOKEN, '30-12345678-9', { tipo: 'FORM_931' });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/documentos?tipo=FORM_931');
  });

  it('sin filtro: no manda querystring', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse([]));
    await listarDocumentosArt(TOKEN, '30-12345678-9');
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).not.toContain('?');
  });
});

describe('subirDocumentoArt - POST /art/empresas/{cuit}/documentos (multipart)', () => {
  it('manda un FormData con tipo + archivo, sin forzar Content-Type', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      id: 'doc-1', empresa_id: 'emp-1', tipo: 'POLIZA_ACTUAL', archivo_drive_id: 'drive-1',
      nombre_archivo: 'poliza.pdf', mime_type: 'application/pdf', conseguido: true,
      fecha_carga: '2026-01-01T00:00:00', subido_por: 'user-1',
      created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    }, true, 201));

    const archivo = new File(['contenido'], 'poliza.pdf', { type: 'application/pdf' });
    const resultado = await subirDocumentoArt(TOKEN, '30-12345678-9', { tipo: 'POLIZA_ACTUAL', archivo });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    // El browser arma el boundary del multipart solo si NO seteamos
    // Content-Type a mano - forzarlo a JSON rompería el upload.
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('tipo')).toBe('POLIZA_ACTUAL');
    expect(init.body.get('archivo')).toBe(archivo);
    expect(resultado.nombre_archivo).toBe('poliza.pdf');
  });

  it('propaga el detail de FastAPI cuando el tipo es inválido (422)', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: "tipo inválido. Válidos: ['FORM_931', 'POLIZA_ACTUAL', 'OTRO']" }, false, 422,
    ));
    const archivo = new File(['x'], 'x.pdf', { type: 'application/pdf' });
    await expect(subirDocumentoArt(TOKEN, '30-12345678-9', { tipo: 'NO_EXISTE', archivo })).rejects.toThrow(/tipo inválido/);
  });
});

describe('marcarDocumentoArtConseguido - PATCH /art/empresas/{cuit}/documentos/{tipo}/conseguido', () => {
  it('hace PATCH sin body al endpoint con el tipo en el path', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      id: 'doc-2', empresa_id: 'emp-1', tipo: 'FORM_931', archivo_drive_id: null,
      nombre_archivo: null, mime_type: null, conseguido: true, fecha_carga: null,
      subido_por: 'user-1', created_at: '2026-01-01T00:00:00', updated_at: '2026-01-01T00:00:00',
    }));

    const resultado = await marcarDocumentoArtConseguido(TOKEN, '30-12345678-9', 'FORM_931');

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/empresas/30-12345678-9/documentos/FORM_931/conseguido');
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).toBeUndefined();
    expect(resultado.conseguido).toBe(true);
    expect(resultado.archivo_drive_id).toBeNull();
  });

  it('propaga el detail de FastAPI cuando el tipo es inválido (422)', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: "tipo inválido. Válidos: ['FORM_931', 'POLIZA_ACTUAL', 'OTRO']" }, false, 422,
    ));
    await expect(marcarDocumentoArtConseguido(TOKEN, '30-12345678-9', 'NO_EXISTE')).rejects.toThrow(/tipo inválido/);
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

describe('obtenerReferencialTarifas - GET /art/referencial-tarifas', () => {
  it('arma el querystring con los filtros y devuelve {items, total, resumen_global}', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      total: 1,
      items: [{
        ciiu: '3710', tramo_dotacion: '1-10', provincia: 'SANTA FE',
        cantidad_observaciones: 4, alicuota_promedio: '5.500',
      }],
      resumen_global: { total_registros: 4, alicuota_promedio_global: '5.500', alicuota_mediana_global: '5.250' },
    }));

    const resultado = await obtenerReferencialTarifas(TOKEN, { ciiu: '37', tramo_dotacion: '1-10' });

    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/art/referencial-tarifas?');
    expect(url).toContain('ciiu=37');
    expect(url).toContain('tramo_dotacion=1-10');
    expect(resultado.total).toBe(1);
    expect(resultado.items[0].provincia).toBe('SANTA FE');
    expect(resultado.resumen_global.total_registros).toBe(4);
  });

  it('no manda filtros vacíos y trae resumen_global null si el backend no lo manda', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ total: 0, items: [] }));
    const resultado = await obtenerReferencialTarifas(TOKEN, { ciiu: '', provincia: undefined });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).not.toContain('ciiu=');
    expect(url).not.toContain('provincia=');
    expect(resultado.resumen_global).toBeNull();
  });

  it('propaga el detail de FastAPI en el mensaje de error cuando el backend responde 422', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(
      { detail: "tramo_dotacion inválido: 'no-existe'." }, false, 422,
    ));
    await expect(obtenerReferencialTarifas(TOKEN, { tramo_dotacion: 'no-existe' })).rejects.toThrow(/422/);
  });
});

describe('listarLeadsSinCobertura - GET /art/leads-sin-cobertura', () => {
  it('devuelve {items, total} del envelope Page y respeta motivo_fin', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      total: 1,
      limit: 50,
      offset: 0,
      items: [{
        cuit: '30-1-9', razon_social: 'Acme SA', tiene_historial: true, ultima_art: 'PLUS ART S.A.',
        fecha_baja: '2026-01-01', motivo_baja: 'FALTA_DE_PAGO', dias_desde_baja: 245, dotacion: 12, ciiu: '3710',
      }],
    }));
    const resultado = await listarLeadsSinCobertura(TOKEN, { motivo_fin: 'falta de pago' });
    const [url] = globalThis.fetch.mock.calls[0];
    expect(url).toContain('motivo_fin=falta+de+pago');
    expect(resultado.total).toBe(1);
    expect(resultado.items[0].tiene_historial).toBe(true);
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

describe('obtenerColaAlicuotas - GET /art/cola-alicuotas', () => {
  it('manda el limit por querystring y devuelve la respuesta tal cual (no es un Page normalizable)', async () => {
    const respuesta = {
      total: 137,
      items: [
        {
          empresa_id: 'emp-1', cuit: '30123456789', cuit_formateado: '30-12345678-9',
          razon_social: 'Acme SA', art_actual: 'Asociart ART S.A.', ciiu: '3710',
          dotacion: 42, dotacion_confianza: 'ALTA', ultima_alicuota_conocida: null,
        },
      ],
    };
    globalThis.fetch.mockResolvedValueOnce(jsonResponse(respuesta));

    const resultado = await obtenerColaAlicuotas(TOKEN, { limit: 20 });

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/cola-alicuotas?limit=20');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    // total es el tamaño real del universo pendiente, SIN el recorte de limit.
    expect(resultado.total).toBe(137);
    expect(resultado.items).toHaveLength(1);
    expect(resultado.items[0].cuit_formateado).toBe('30-12345678-9');
  });

  it('propaga un error de la API sin romper', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'Internal Server Error' }, false, 500));
    await expect(obtenerColaAlicuotas(TOKEN, { limit: 20 })).rejects.toThrow(/Error 500/);
  });
});

describe('registrarCargaRapidaAlicuotas - POST /art/alicuotas/carga-rapida', () => {
  it('hace POST con {items} serializado y devuelve el resumen del lote', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({
      total: 2, escritos: 1, sin_dato: 1, ya_registrados: 0, errores: 0,
      items: [
        { empresa_id: 'emp-1', escrito: true, ya_registrado_hoy: false, error: null },
        { empresa_id: 'emp-2', escrito: true, ya_registrado_hoy: false, error: null },
      ],
    }, true, 201));

    const items = [
      { empresa_id: 'emp-1', alicuota_pct: 5.96, sin_dato: false },
      { empresa_id: 'emp-2', sin_dato: true },
    ];
    const resultado = await registrarCargaRapidaAlicuotas(TOKEN, items);

    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toBe('https://ayma-portal-backend.onrender.com/api/v1/art/alicuotas/carga-rapida');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ items });
    expect(resultado.escritos).toBe(1);
    expect(resultado.sin_dato).toBe(1);
  });

  it('propaga un error de validación de la API', async () => {
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ detail: 'empresa_id inválido' }, false, 422));
    await expect(registrarCargaRapidaAlicuotas(TOKEN, [{ empresa_id: 'x', sin_dato: true }]))
      .rejects.toThrow(/empresa_id inválido/);
  });
});
