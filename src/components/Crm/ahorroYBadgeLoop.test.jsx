// @vitest-environment jsdom
//
// D-B8 - dónde se LEE el valor que generaron los NO.
//
// 1. La tarjeta del Dashboard trae el total, el denominador y lo que NO pudo
//    contar. Un total suelto se lee como si hubiera contado todo.
// 2. Si la métrica falla, dice "Sin medir". NUNCA un 0: un 0 acá se lee como
//    "este período no generamos valor", que es lo contrario.
// 3. El Kanban marca "con efecto" en la columna LOOP. Sin el badge, la
//    cuenta que defendimos hasta hacerle bajar la tarifa se ve igual que la
//    que dijo "no me interesa".
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import AhorroGeneradoCard from './AhorroGeneradoCard';
import PipelineKanban from './PipelineKanban';

const respuesta = (data, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => data,
  clone: () => ({ json: async () => data }),
  text: async () => JSON.stringify(data),
});

beforeEach(() => { globalThis.fetch = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('AhorroGeneradoCard', () => {
  it('muestra el total, cuántos con efecto y sobre cuántos', async () => {
    globalThis.fetch.mockResolvedValue(respuesta({
      desde: null, hasta: null,
      total_ahorro: '1250000',
      cantidad_con_efecto: 3,
      cantidad_sin_efecto: 37,
      con_efecto_sin_ahorro: 0,
      detalle: [],
    }));
    render(<AhorroGeneradoCard token="tok" />);

    await waitFor(() => expect(screen.getByText(/1\.250\.000/)).toBeTruthy());
    expect(globalThis.fetch.mock.calls[0][0]).toContain('/crm/metricas/ahorro-generado');
    // El denominador va SIEMPRE: 3 de 40 y 3 de 4 son dos negocios distintos.
    expect(screen.getByText(/3 con efecto de 40 NO declarados/)).toBeTruthy();
  });

  it('declara cuántos CON_EFECTO no tienen importe cargado', async () => {
    globalThis.fetch.mockResolvedValue(respuesta({
      total_ahorro: '0', cantidad_con_efecto: 2, cantidad_sin_efecto: 1,
      con_efecto_sin_ahorro: 2, detalle: [],
    }));
    render(<AhorroGeneradoCard token="tok" />);
    await waitFor(() => expect(screen.getByText(/2 con efecto sin importe cargado/i)).toBeTruthy());
  });

  it('con la métrica caída dice "Sin medir", nunca 0', async () => {
    globalThis.fetch.mockResolvedValue(respuesta({ detail: 'no autorizado' }, 403));
    render(<AhorroGeneradoCard token="tok" />);
    await waitFor(() => expect(screen.getByText('Sin medir')).toBeTruthy());
    expect(screen.queryByText('$0')).toBeNull();
  });
});

describe('PipelineKanban — el badge "con efecto" en LOOP', () => {
  const pipeline = {
    columnas: [{
      estado_crm: 'LOOP',
      cantidad: 2,
      prima_estimada_total: 100,
      oportunidades: [
        {
          id: 'o1', track: 'ART', nombre_vinculado: 'Metalúrgica SA', prima_estimada: 50,
          estado_crm: 'LOOP', resultado_loop: 'CON_EFECTO', ahorro_anual_generado: '450000',
          patente: null, updated_at: new Date().toISOString(),
        },
        {
          id: 'o2', track: 'AUTO', nombre_vinculado: 'Juan Pérez', prima_estimada: 50,
          estado_crm: 'LOOP', resultado_loop: 'SIN_EFECTO',
          patente: 'HAC394', updated_at: new Date().toISOString(),
        },
      ],
    }],
  };

  it('marca sólo la que dejó efecto, y muestra la patente de la otra', async () => {
    globalThis.fetch.mockResolvedValue(respuesta(pipeline));
    render(<PipelineKanban token="tok" />);

    await waitFor(() => expect(screen.getByText('Metalúrgica SA')).toBeTruthy());
    expect(screen.getAllByText('con efecto')).toHaveLength(1);
    // C-15: la patente se reconoce sin abrir la ficha.
    expect(screen.getByText('HAC394')).toBeTruthy();
  });
});
