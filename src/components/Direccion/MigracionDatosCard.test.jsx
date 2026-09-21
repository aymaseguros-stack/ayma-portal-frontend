// @vitest-environment jsdom
//
// Las tres migraciones de datos de C-15 / C-16 / D-B8, corridas desde la
// pantalla con la sesión del admin.
//
// LO QUE BLINDA, y cada punto es una forma conocida de escribir en
// producción sin querer:
//
// 1. "Simular" pega con `dry_run=true`. Siempre explícito en la query
//    string, nunca confiado al default del backend.
// 2. "Ejecutar en firme" NACE DESHABILITADO: sin una simulación en esta
//    misma pantalla no se habilita.
// 3. Ni con la simulación alcanza: hay que TIPEAR EJECUTAR, exacto.
// 4. La ejecución en firme manda `dry_run=false` y después ofrece "Simular
//    de nuevo" -que es cómo se verifica que quedó en 0-, con la simulación
//    vieja ya descartada.
// 5. `sin_mapeo` sale RESALTADO y con el cartel de que no se tocó: es lo que
//    decide una persona.
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import MigracionDatosCard from './MigracionDatosCard';
import { MIGRACIONES_DATOS } from './diagnosticosCatalogo';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

const RESULTADO = (dryRun) => ({
  dry_run: dryRun,
  operacion: 'normalizar_listas_cerradas',
  filas_afectadas: 7,
  detalle: {
    mapeo_origen: { verificacion_srt: 'VERIFICACION_SRT' },
    sin_mapeo_origen: { fb: 3, 'boca a boca': 1 },
  },
  verificacion: { origenes_fuera_del_enum: 4 },
});

const MIGRACION = {
  id: 'prueba',
  titulo: 'Normalizar listas cerradas (C-16)',
  descripcion: 'Descripción de prueba',
  ejecutar: vi.fn(),
};

beforeEach(() => { MIGRACION.ejecutar = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const montar = () => render(<MigracionDatosCard token="tok" migracion={MIGRACION} />);

const simular = async () => {
  MIGRACION.ejecutar.mockResolvedValueOnce(RESULTADO(true));
  fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));
  await waitFor(() => expect(screen.getByText(/no se escribió nada/i)).toBeTruthy());
};

describe('MigracionDatosCard', () => {
  it('antes de simular no hay botón de ejecutar en firme', () => {
    montar();
    expect(screen.queryByRole('button', { name: /Ejecutar en firme/i })).toBeNull();
    expect(screen.getByText(/Todavía no se corrió/i)).toBeTruthy();
  });

  it('simular corre en seco y muestra las filas que afectaría', async () => {
    montar();
    await simular();
    expect(MIGRACION.ejecutar).toHaveBeenCalledWith('tok', true);
    expect(screen.getByText(/7/)).toBeTruthy();
  });

  it('con la simulación hecha, ejecutar sigue deshabilitado hasta tipear EJECUTAR', async () => {
    montar();
    await simular();

    const boton = screen.getByRole('button', { name: /Ejecutar en firme/i });
    expect(boton.disabled).toBe(true);

    const campo = screen.getByLabelText(/Escribí EJECUTAR/i);
    // La comparación es EXACTA: si el cartel pide EJECUTAR, aceptar
    // "ejecutar" enseña que el texto del cartel es aproximado.
    fireEvent.change(campo, { target: { value: 'ejecutar' } });
    expect(screen.getByRole('button', { name: /Ejecutar en firme/i }).disabled).toBe(true);

    fireEvent.change(campo, { target: { value: 'EJECUTAR' } });
    expect(screen.getByRole('button', { name: /Ejecutar en firme/i }).disabled).toBe(false);
  });

  it('ejecutar en firme manda dry_run=false y ofrece simular de nuevo', async () => {
    montar();
    await simular();
    fireEvent.change(screen.getByLabelText(/Escribí EJECUTAR/i), { target: { value: 'EJECUTAR' } });

    MIGRACION.ejecutar.mockResolvedValueOnce({ ...RESULTADO(false), filas_afectadas: 7 });
    fireEvent.click(screen.getByRole('button', { name: /Ejecutar en firme/i }));

    await waitFor(() => expect(screen.getByText(/Ejecutada en firme/i)).toBeTruthy());
    expect(MIGRACION.ejecutar).toHaveBeenLastCalledWith('tok', false);
    // La simulación se descartó: la próxima en firme necesita la suya.
    expect(screen.queryByRole('button', { name: /Ejecutar en firme/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Simular de nuevo/i })).toBeTruthy();
  });

  it('sin_mapeo sale resaltado y avisando que no se tocó', async () => {
    montar();
    await simular();
    expect(screen.getByText(/sin_mapeo_origen — NO se tocó/i)).toBeTruthy();
    expect(screen.getByText('fb')).toBeTruthy();
  });

  it('un error del pedido no se confunde con una corrida vacía', async () => {
    montar();
    MIGRACION.ejecutar.mockRejectedValueOnce(new Error('403 Forbidden'));
    fireEvent.click(screen.getByRole('button', { name: /^Simular$/i }));

    await waitFor(() => expect(screen.getByText(/403 Forbidden/)).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Ejecutar en firme/i })).toBeNull();
  });
});

describe('El catálogo trae las tres migraciones del PR #187', () => {
  it('normalizar-listas-cerradas, backfill-riesgo y backfill-resultado-loop', () => {
    expect(MIGRACIONES_DATOS.map((m) => m.id)).toEqual([
      'normalizar-listas-cerradas', 'backfill-riesgo', 'backfill-resultado-loop',
    ]);
    MIGRACIONES_DATOS.forEach((m) => expect(typeof m.ejecutar).toBe('function'));
  });

  it('cada una pega a su endpoint admin con el dry_run en la query string', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(respuesta({ dry_run: true, filas_afectadas: 0 }));
    const rutas = [
      'normalizar-listas-cerradas', 'backfill-riesgo', 'backfill-resultado-loop',
    ];
    for (const [i, m] of MIGRACIONES_DATOS.entries()) {
      await m.ejecutar('tok', true);
      const [url, opciones] = globalThis.fetch.mock.calls[i];
      expect(url).toContain(`/api/v1/admin/crm/oportunidades/${rutas[i]}?dry_run=true`);
      expect(opciones.method).toBe('POST');
    }
  });
});
